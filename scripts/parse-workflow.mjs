#!/usr/bin/env node
/**
 * WORKFLOW/TASK 파서: 마크다운 체크박스를 파싱하여 JSON 생성.
 * Usage: node parse-workflow.mjs <docs-dir> <repo-name> <output-json>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'

const [docsDir, repoName, outputPath] = process.argv.slice(2)
if (!docsDir || !repoName || !outputPath) {
  console.error('Usage: node parse-workflow.mjs <docs-dir> <repo-name> <output-json>')
  process.exit(1)
}

function parseCheckboxes(content) {
  const checks = []
  const re = /^(\s*)- \[([ x])\]\s+(.+)$/gm
  let match
  while ((match = re.exec(content)) !== null) {
    checks.push({ done: match[2] === 'x', text: match[3].trim() })
  }
  return checks
}

function parseWorkflowFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
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

function parseTaskFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const ownerMatch = content.match(/^# TASK: @(.+)$/m)
  return { owner: ownerMatch ? ownerMatch[1] : 'unknown' }
}

// WORKFLOW 파일 수집
const workflowDir = join(docsDir, 'workflow')
const taskDir = join(docsDir, 'task')

if (!existsSync(workflowDir)) {
  console.error(`Workflow dir not found: ${workflowDir}`)
  process.exit(1)
}

const workflowFiles = readdirSync(workflowDir).filter(f => f.startsWith('WORKFLOW_') && f.endsWith('.md'))

// 트랙별 그룹핑
const trackMap = new Map()
for (const file of workflowFiles) {
  const match = file.match(/^WORKFLOW_(.+)_(W\d+)\.md$/)
  if (!match) continue
  const [, trackName, week] = match
  if (!trackMap.has(trackName)) trackMap.set(trackName, new Map())
  trackMap.get(trackName).set(week, join(workflowDir, file))
}

// config에서 ownerMap 구성
const configPath = join(dirname(outputPath), 'config.json')
const ownerMap = {}
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  for (const repo of config.repos) {
    for (const track of repo.tracks) {
      ownerMap[track.name] = track.owner
    }
  }
}

// trackAliasMap — config의 명시적 매핑으로 대체
const trackAliasMap = {}

const periodMap = {
  W1: '05-12~05-16', W2: '05-19~05-23', W3: '05-26~05-29',
  W4: '06-01~06-05', W5: '06-08~06-12',
}

const tracks = []
for (const [rawTrackName, weekFiles] of trackMap) {
  const trackName = trackAliasMap[rawTrackName] || rawTrackName
  const taskFile = join(taskDir, `TASK_${rawTrackName}.md`)
  const taskInfo = existsSync(taskFile) ? parseTaskFile(taskFile) : { owner: 'unknown' }

  const weeks = []
  for (const [week, filePath] of [...weekFiles].sort()) {
    const steps = parseWorkflowFile(filePath)
    weeks.push({
      week,
      period: periodMap[week] || '',
      steps,
      totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
      doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
    })
  }

  tracks.push({ name: trackName, owner: ownerMap[trackName] || taskInfo.owner, weeks })
}

// 이전 JSON 로드 + diff → changelog
let oldData = null
if (existsSync(outputPath)) {
  oldData = JSON.parse(readFileSync(outputPath, 'utf-8'))
}

function computeChangelog(oldData, newTracks) {
  if (!oldData) return []
  const changes = []
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) || 'local'
  const author = process.env.GITHUB_ACTOR || 'unknown'

  for (const newTrack of newTracks) {
    const oldTrack = oldData.tracks?.find(t => t.name === newTrack.name)
    if (!oldTrack) continue

    for (const newWeek of newTrack.weeks) {
      const oldWeek = oldTrack.weeks?.find(w => w.week === newWeek.week)
      if (!oldWeek) continue

      if (newWeek.steps.length > (oldWeek.steps?.length || 0)) {
        const addedSteps = newWeek.steps.slice(oldWeek.steps?.length || 0)
        for (const s of addedSteps) {
          changes.push({
            type: 'step_added',
            target: `${newWeek.week} > ${s.name}`,
            detail: `${newWeek.week}에 Step 추가 (${oldWeek.steps?.length || 0}개 → ${newWeek.steps.length}개)`,
          })
        }
      }

      for (let si = 0; si < Math.min(newWeek.steps.length, oldWeek.steps?.length || 0); si++) {
        const newStep = newWeek.steps[si]
        const oldStep = oldWeek.steps[si]
        const doneDiff = newStep.doneChecks - (oldStep?.doneChecks || 0)
        if (doneDiff > 0) {
          changes.push({
            type: 'check_done',
            target: `${newWeek.week} > ${newStep.name}`,
            detail: `${doneDiff}개 항목 완료 (${oldStep?.doneChecks || 0} → ${newStep.doneChecks})`,
          })
        } else if (doneDiff < 0) {
          changes.push({
            type: 'check_undone',
            target: `${newWeek.week} > ${newStep.name}`,
            detail: `${-doneDiff}개 항목 해제 (${oldStep?.doneChecks || 0} → ${newStep.doneChecks})`,
          })
        }
      }
    }
  }

  if (changes.length === 0) return []
  return [{
    date: new Date().toISOString(),
    commit: commitSha,
    author,
    file: `WORKFLOW_*`,
    changes,
  }]
}

const newChangelog = computeChangelog(oldData, tracks)

// history 업데이트
const today = new Date().toISOString().slice(0, 10)
const totalChecks = tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
const doneChecks = tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)

const oldHistory = oldData?.history || []
const todayIdx = oldHistory.findIndex(h => h.date === today)
const historyEntry = { date: today, totalChecks, doneChecks }
const history = todayIdx >= 0
  ? [...oldHistory.slice(0, todayIdx), historyEntry, ...oldHistory.slice(todayIdx + 1)]
  : [...oldHistory, historyEntry]

const prd = oldData?.prd || []
const changelog = [...(oldData?.changelog || []), ...newChangelog]

const output = {
  repo: repoName,
  updatedAt: new Date().toISOString(),
  tracks,
  prd,
  history,
  changelog,
}

writeFileSync(outputPath, JSON.stringify(output, null, 2))
console.log(`Parsed: ${repoName} → ${outputPath}`)
console.log(`  Tracks: ${tracks.map(t => t.name).join(', ')}`)
console.log(`  Total: ${totalChecks} checks, ${doneChecks} done (${totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0}%)`)
console.log(`  New changelog entries: ${newChangelog.length}`)
