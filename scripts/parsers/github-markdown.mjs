#!/usr/bin/env node
/**
 * GitHub Markdown parser — parses WORKFLOW_*.md and PRD_*.md files
 * from a local docs directory into the dashboard TrackData format.
 *
 * Interface: { name, validate, fetch, transform }
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const name = 'github-markdown'

/**
 * Validate source config has required fields.
 * @param {object} config - { type, repo, path }
 */
function validate(config) {
  if (!config.repo) return { valid: false, error: 'source.repo is required (e.g., "org/repo-name")' }
  if (!config.path) return { valid: false, error: 'source.path is required (e.g., "docs/project-management")' }
  return { valid: true }
}

/**
 * Fetch raw data from a local docs directory.
 * In GitHub Actions context, the directory is already checked out.
 * @param {object} config - source config from config.json
 * @param {object} options - { docsDir: string } local path to docs
 * @returns {object} { workflowFiles, prdFiles, taskFiles }
 */
function fetch(config, options = {}) {
  const docsDir = options.docsDir
  if (!docsDir) throw new Error('options.docsDir is required for github-markdown parser')

  const workflowDir = join(docsDir, 'workflow')
  const prdDir = join(docsDir, 'prd')
  const taskDir = join(docsDir, 'task')

  const result = { workflowFiles: [], prdFiles: [], taskFiles: [] }

  if (existsSync(workflowDir)) {
    result.workflowFiles = readdirSync(workflowDir)
      .filter(f => f.startsWith('WORKFLOW_') && f.endsWith('.md'))
      .map(f => ({ name: f, path: join(workflowDir, f) }))
  }

  if (existsSync(prdDir)) {
    result.prdFiles = readdirSync(prdDir)
      .filter(f => /^PRD_W\d+\.md$/.test(f))
      .map(f => ({ name: f, path: join(prdDir, f) }))
  }

  if (existsSync(taskDir)) {
    result.taskFiles = readdirSync(taskDir)
      .filter(f => f.startsWith('TASK_') && f.endsWith('.md'))
      .map(f => ({ name: f, path: join(taskDir, f) }))
  }

  return result
}

// --- Internal helpers (ported from parse-workflow.mjs) ---

function parseCheckboxes(content) {
  const checks = []
  const re = /^(\s*)- \[([ x])\]\s+(.+)$/gm
  let match
  while ((match = re.exec(content)) !== null) {
    checks.push({ done: match[2] === 'x', text: match[3].trim() })
  }
  return checks
}

function parseWorkflowContent(content) {
  const steps = []
  const stepParts = content.split(/^## Step \d+: /m).slice(1)
  const stepNames = [...content.matchAll(/^## Step (\d+): (.+)$/gm)].map(m => m[2])

  stepParts.forEach((part, i) => {
    const phases = []
    const phaseParts = part.split(/^### \d+\.\d+ /m).slice(1)
    const phaseNames = [...part.matchAll(/^### (\d+\.\d+) (.+)$/gm)].map(m => m[2])

    phaseParts.forEach((pp, j) => {
      const checks = parseCheckboxes(pp)
      phases.push({
        name: phaseNames[j] || `Phase ${j + 1}`,
        total: checks.length,
        done: checks.filter(c => c.done).length,
        items: checks.map(c => ({ text: c.text, done: c.done })),
      })
    })

    const totalChecks = phases.reduce((s, p) => s + p.total, 0)
    const doneChecks = phases.reduce((s, p) => s + p.done, 0)
    const status = totalChecks === 0 ? 'Not Started'
      : doneChecks === totalChecks ? 'Done'
      : doneChecks > 0 ? 'In Progress' : 'Not Started'

    steps.push({ name: stepNames[i] || `Step ${i + 1}`, status, phases, totalChecks, doneChecks })
  })

  return steps
}

function parseTaskContent(content) {
  const ownerMatch = content.match(/^# TASK: @(.+)$/m)
  return { owner: ownerMatch ? ownerMatch[1] : 'unknown' }
}

function parsePrdContent(content, allowedPrefixes) {
  const items = []
  const re = /\|\s*(FR-[A-Z0-9]+-\d+)\s*\|\s*(.+?)\s*\|/g
  let match
  while ((match = re.exec(content)) !== null) {
    const id = match[1]
    const title = match[2].trim()
    if (title === '유저 스토리' || title.startsWith('---')) continue
    if (allowedPrefixes.length > 0 && !id.startsWith('FR-ALL') && !allowedPrefixes.some(p => id.startsWith(p))) continue
    items.push({ id, title, status: 'not_started' })
  }
  return items
}

/**
 * Transform raw fetched data into TrackData format.
 * @param {object} raw - output from fetch()
 * @param {object} options - { ownerMap, periodMap, prdPrefixes }
 * @returns {object} { tracks, prd }
 */
function transform(raw, options = {}) {
  const { ownerMap = {}, periodMap = {}, prdPrefixes = [] } = options

  // Group workflow files by track and week
  const trackMap = new Map()
  for (const file of raw.workflowFiles) {
    const match = file.name.match(/^WORKFLOW_(.+)_(W\d+)\.md$/)
    if (!match) continue
    const [, trackName, week] = match
    if (!trackMap.has(trackName)) trackMap.set(trackName, new Map())
    trackMap.get(trackName).set(week, file.path)
  }

  // Parse task files for owner info
  const taskOwners = {}
  for (const file of raw.taskFiles) {
    const match = file.name.match(/^TASK_(.+)\.md$/)
    if (!match) continue
    const content = readFileSync(file.path, 'utf-8')
    const info = parseTaskContent(content)
    taskOwners[match[1]] = info.owner
  }

  // Build tracks
  const tracks = []
  for (const [rawTrackName, weekFiles] of trackMap) {
    const weeks = []
    for (const [week, filePath] of [...weekFiles].sort()) {
      const content = readFileSync(filePath, 'utf-8')
      const steps = parseWorkflowContent(content)
      weeks.push({
        week,
        period: periodMap[week] || '',
        steps,
        totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
        doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
      })
    }
    tracks.push({
      name: rawTrackName,
      owner: ownerMap[rawTrackName] || taskOwners[rawTrackName] || 'unknown',
      weeks,
    })
  }

  // Parse PRD files
  const prd = []
  for (const file of raw.prdFiles) {
    const weekMatch = file.name.match(/PRD_(W\d+)/)
    if (!weekMatch) continue
    const content = readFileSync(file.path, 'utf-8')
    const items = parsePrdContent(content, prdPrefixes)
    if (items.length > 0) {
      prd.push({ week: weekMatch[1], items })
    }
  }

  return { tracks, prd }
}

export default { name, validate, fetch, transform }
export { parseCheckboxes, parseWorkflowContent, parseTaskContent, parsePrdContent }
