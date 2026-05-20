# `/project-dashboard` Skill Phase 2: Sync Module + Parser System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `sync` subcommand and a pluggable parser system so `/project-dashboard sync` can pull data from GitHub markdown, Notion, and Linear into the dashboard's JSON data files.

**Architecture:** A parser registry (`scripts/parsers/index.mjs`) maps source type strings to parser modules. Each parser implements the same interface: `validate(config) → boolean`, `fetch(config) → RawData`, `transform(raw, columns) → TrackData`. The `sync` skill module instructs Claude to run the parsers via Node.js scripts. The existing `parse-workflow.mjs` is refactored into the `github-markdown` parser.

**Tech Stack:** Node.js 22 (ESM), Claude Code skill (Markdown), Notion MCP tools, Linear GraphQL API

---

## File Structure

```
scripts/parsers/
├── index.mjs                  # Parser registry — maps type string → parser module
├── github-markdown.mjs        # Refactored from parse-workflow.mjs + parse-prd.mjs
├── notion.mjs                 # Notion parser (uses Notion MCP tools)
├── linear.mjs                 # Linear parser (uses Linear API)
└── __fixtures__/
    ├── github-markdown/
    │   ├── input/
    │   │   └── WORKFLOW_testtrack_W1.md
    │   └── expected.json
    ├── notion/
    │   ├── input.json
    │   └── expected.json
    └── linear/
        ├── input.json
        └── expected.json

scripts/
├── sync.mjs                   # CLI entry point: reads config, runs parsers, writes data
├── parse-workflow.mjs          # (kept for backward compat, delegates to parsers/github-markdown.mjs)
└── parse-prd.mjs               # (kept for backward compat)

skills/project-dashboard/
└── modules/
    └── sync.md                 # Sync skill module instructions
```

---

### Task 1: Parser Registry

**Files:**
- Create: `scripts/parsers/index.mjs`

- [ ] **Step 1: Create the parser registry**

```javascript
#!/usr/bin/env node
/**
 * Parser registry — maps source type strings to parser modules.
 * Each parser must export: { name, validate, fetch, transform }
 */

const registry = new Map()

export function registerParser(name, parser) {
  if (!parser.validate || !parser.fetch || !parser.transform) {
    throw new Error(`Parser "${name}" must export validate, fetch, and transform functions`)
  }
  registry.set(name, parser)
}

export function getParser(sourceType) {
  const parser = registry.get(sourceType)
  if (!parser) {
    const available = [...registry.keys()].join(', ')
    throw new Error(`Unknown source type: "${sourceType}". Available: ${available}`)
  }
  return parser
}

export function listParsers() {
  return [...registry.keys()]
}

// Auto-register built-in parsers
async function loadBuiltins() {
  const builtins = [
    ['github-markdown', './github-markdown.mjs'],
    ['notion', './notion.mjs'],
    ['linear', './linear.mjs'],
  ]

  for (const [name, path] of builtins) {
    try {
      const mod = await import(path)
      registerParser(name, mod.default || mod)
    } catch (e) {
      // Parser not available — skip silently (e.g., notion/linear may not be installed yet)
    }
  }
}

await loadBuiltins()
```

- [ ] **Step 2: Verify the file runs without errors**

Run: `node -e "import('./scripts/parsers/index.mjs').then(m => console.log('Parsers:', m.listParsers()))"`
Expected: `Parsers: []` (no parsers loaded yet since github-markdown.mjs doesn't exist)

- [ ] **Step 3: Commit**

```bash
git add scripts/parsers/index.mjs
git commit -m "feat(parsers): add parser registry with auto-registration"
```

---

### Task 2: GitHub Markdown Parser

**Files:**
- Create: `scripts/parsers/github-markdown.mjs`
- Modify: `scripts/parse-workflow.mjs` (add delegation)

This refactors the existing `parse-workflow.mjs` logic into the parser interface.

- [ ] **Step 1: Create the github-markdown parser**

```javascript
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
  if (!config.path) return { valid: false, error: 'source.path is required (e.g., "docs/project-management/workflow")' }
  return { valid: true }
}

/**
 * Fetch raw data from a local docs directory.
 * In GitHub Actions context, the directory is already checked out.
 * @param {object} config - source config from config.json
 * @param {object} options - { docsDir: string } local path to docs
 * @returns {object} { workflowFiles, prdFiles, trackName, owner }
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
 * @param {object} options - { repoId, ownerMap, periodMap, prdPrefixes }
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
```

- [ ] **Step 2: Verify the parser loads in the registry**

Run: `node -e "import('./scripts/parsers/index.mjs').then(m => console.log('Parsers:', m.listParsers()))"`
Expected: `Parsers: [ 'github-markdown' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/parsers/github-markdown.mjs
git commit -m "feat(parsers): add github-markdown parser (refactored from parse-workflow.mjs)"
```

---

### Task 3: Parser Test Fixtures

**Files:**
- Create: `scripts/parsers/__fixtures__/github-markdown/input/WORKFLOW_testtrack_W1.md`
- Create: `scripts/parsers/__fixtures__/github-markdown/expected.json`
- Create: `scripts/parsers/__fixtures__/test-parsers.mjs`

- [ ] **Step 1: Create the test input fixture**

```markdown
## Step 1: Setup project

### 1.1 Initialize repo

- [x] Create repository
- [x] Add README
- [ ] Configure CI

### 1.2 Setup dependencies

- [x] Install Node.js
- [ ] Install packages
- [ ] Run initial build

## Step 2: Implement API

### 2.1 Design endpoints

- [ ] Define REST routes
- [ ] Write OpenAPI spec
```

Write this to `scripts/parsers/__fixtures__/github-markdown/input/WORKFLOW_testtrack_W1.md`.

- [ ] **Step 2: Create the expected output fixture**

```json
{
  "tracks": [
    {
      "name": "testtrack",
      "owner": "unknown",
      "weeks": [
        {
          "week": "W1",
          "period": "",
          "steps": [
            {
              "name": "Setup project",
              "status": "In Progress",
              "phases": [
                {
                  "name": "Initialize repo",
                  "total": 3,
                  "done": 2,
                  "items": [
                    { "text": "Create repository", "done": true },
                    { "text": "Add README", "done": true },
                    { "text": "Configure CI", "done": false }
                  ]
                },
                {
                  "name": "Setup dependencies",
                  "total": 3,
                  "done": 1,
                  "items": [
                    { "text": "Install Node.js", "done": true },
                    { "text": "Install packages", "done": false },
                    { "text": "Run initial build", "done": false }
                  ]
                }
              ],
              "totalChecks": 6,
              "doneChecks": 3
            },
            {
              "name": "Implement API",
              "status": "Not Started",
              "phases": [
                {
                  "name": "Design endpoints",
                  "total": 2,
                  "done": 0,
                  "items": [
                    { "text": "Define REST routes", "done": false },
                    { "text": "Write OpenAPI spec", "done": false }
                  ]
                }
              ],
              "totalChecks": 2,
              "doneChecks": 0
            }
          ],
          "totalChecks": 8,
          "doneChecks": 3
        }
      ]
    }
  ],
  "prd": []
}
```

Write this to `scripts/parsers/__fixtures__/github-markdown/expected.json`.

- [ ] **Step 3: Create the test runner script**

```javascript
#!/usr/bin/env node
/**
 * Parser test runner — verifies parsers against fixture data.
 * Usage: node scripts/parsers/__fixtures__/test-parsers.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function testGitHubMarkdown() {
  const { default: parser } = await import('../github-markdown.mjs')

  // Test validate
  const validResult = parser.validate({ repo: 'org/repo', path: 'docs/workflow' })
  assert(validResult.valid === true, 'validate: valid config should pass')

  const invalidResult = parser.validate({ repo: '', path: '' })
  assert(invalidResult.valid === false, 'validate: empty config should fail')

  // Test fetch
  const inputDir = join(__dirname, 'github-markdown', 'input')
  const raw = parser.fetch({ repo: 'org/test', path: 'workflow' }, { docsDir: join(__dirname, 'github-markdown', 'input-docs') })

  // Test transform with direct fixture
  const rawFixture = {
    workflowFiles: [
      { name: 'WORKFLOW_testtrack_W1.md', path: join(inputDir, 'WORKFLOW_testtrack_W1.md') }
    ],
    prdFiles: [],
    taskFiles: [],
  }
  const result = parser.transform(rawFixture)
  const expected = JSON.parse(readFileSync(join(__dirname, 'github-markdown', 'expected.json'), 'utf-8'))

  // Deep compare tracks
  assert(result.tracks.length === expected.tracks.length, `tracks count: got ${result.tracks.length}, expected ${expected.tracks.length}`)
  
  const track = result.tracks[0]
  const expTrack = expected.tracks[0]
  assert(track.name === expTrack.name, `track name: got "${track.name}", expected "${expTrack.name}"`)
  assert(track.weeks.length === expTrack.weeks.length, `weeks count: got ${track.weeks.length}, expected ${expTrack.weeks.length}`)

  const week = track.weeks[0]
  const expWeek = expTrack.weeks[0]
  assert(week.totalChecks === expWeek.totalChecks, `totalChecks: got ${week.totalChecks}, expected ${expWeek.totalChecks}`)
  assert(week.doneChecks === expWeek.doneChecks, `doneChecks: got ${week.doneChecks}, expected ${expWeek.doneChecks}`)
  assert(week.steps.length === expWeek.steps.length, `steps count: got ${week.steps.length}, expected ${expWeek.steps.length}`)

  // Verify step details
  for (let i = 0; i < week.steps.length; i++) {
    const step = week.steps[i]
    const expStep = expWeek.steps[i]
    assert(step.name === expStep.name, `step[${i}] name: got "${step.name}", expected "${expStep.name}"`)
    assert(step.status === expStep.status, `step[${i}] status: got "${step.status}", expected "${expStep.status}"`)
    assert(step.totalChecks === expStep.totalChecks, `step[${i}] totalChecks: got ${step.totalChecks}, expected ${expStep.totalChecks}`)
    assert(step.doneChecks === expStep.doneChecks, `step[${i}] doneChecks: got ${step.doneChecks}, expected ${expStep.doneChecks}`)
    assert(step.phases.length === expStep.phases.length, `step[${i}] phases count: got ${step.phases.length}, expected ${expStep.phases.length}`)
  }

  console.log('✅ github-markdown parser: all tests passed')
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  } else {
    passed++
  }
}

console.log('Running parser tests...\n')
await testGitHubMarkdown()

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

- [ ] **Step 4: Run the tests**

Run: `node scripts/parsers/__fixtures__/test-parsers.mjs`
Expected: `✅ github-markdown parser: all tests passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/__fixtures__/
git commit -m "test(parsers): add github-markdown parser fixtures and test runner"
```

---

### Task 4: Sync CLI Script

**Files:**
- Create: `scripts/sync.mjs`
- Modify: `package.json` (add `sync` script)

The CLI entry point that reads `config.json`, runs the appropriate parser for each repo, and writes `data/*.json`.

- [ ] **Step 1: Create the sync CLI script**

```javascript
#!/usr/bin/env node
/**
 * Sync CLI — reads config.json, runs parsers, writes data/*.json.
 * Usage: node scripts/sync.mjs [repo-id] [--dry-run]
 *
 * Options:
 *   repo-id    Sync only this repo (optional, syncs all if omitted)
 *   --dry-run  Show what would change without writing files
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { getParser, listParsers } from './parsers/index.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const targetRepo = args.find(a => !a.startsWith('--')) || null

const configPath = resolve('data/config.json')
if (!existsSync(configPath)) {
  console.error('❌ data/config.json not found. Run in a dashboard project directory.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))

// Detect config format
const isLegacy = !config.repos?.[0]?.id && config.repos?.[0]?.repo

// Build repo list
const repos = isLegacy
  ? config.repos.map(r => ({
      id: r.repo,
      trackName: r.tracks.map(t => t.name).join(', '),
      owner: r.tracks[0]?.owner || 'unknown',
      source: { type: 'github-markdown', repo: `team-project-final/${r.repo}`, path: 'docs/project-management' },
      ownerMap: Object.fromEntries(r.tracks.map(t => [t.name, t.owner])),
    }))
  : config.repos

// Period map for github-markdown parser
const periodMap = isLegacy
  ? { W1: '05-12~05-16', W2: '05-19~05-23', W3: '05-26~05-29', W4: '06-01~06-05', W5: '06-08~06-12' }
  : Object.fromEntries((config.periods || []).map(p => [p.id, `${p.start}~${p.end}`]))

console.log(`📊 Sync — ${dryRun ? 'DRY RUN' : 'LIVE'} mode`)
console.log(`Available parsers: ${listParsers().join(', ')}`)
console.log('')

let updated = 0
let skipped = 0
let errors = 0

for (const repo of repos) {
  if (targetRepo && repo.id !== targetRepo) continue

  const sourceType = repo.source?.type || 'github-markdown'
  console.log(`🔄 ${repo.id} [${sourceType}]`)

  let parser
  try {
    parser = getParser(sourceType)
  } catch (e) {
    console.error(`  ❌ ${e.message}`)
    errors++
    continue
  }

  // Validate source config
  const validation = parser.validate(repo.source || {})
  if (!validation.valid) {
    console.error(`  ❌ Invalid config: ${validation.error}`)
    errors++
    continue
  }

  // For github-markdown, we need a local docsDir
  // In GitHub Actions, this is passed as an environment variable or extracted beforehand
  // For local use, construct from workspace path
  const docsDir = process.env.DOCS_DIR || null

  if (sourceType === 'github-markdown' && !docsDir) {
    console.log(`  ⚠️ DOCS_DIR env var not set. Use GitHub Actions workflow or set DOCS_DIR manually.`)
    console.log(`  ⚠️ Skipping — github-markdown parser requires local docs directory.`)
    skipped++
    continue
  }

  try {
    // Fetch raw data
    const raw = parser.fetch(repo.source, { docsDir })

    // Transform to TrackData
    const ownerMap = repo.ownerMap || {}
    const transformed = parser.transform(raw, { ownerMap, periodMap, prdPrefixes: [] })

    // Load existing data for changelog diffing
    const outputPath = resolve(`data/${repo.id}.json`)
    const oldData = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf-8')) : null

    // Compute changelog
    const newChangelog = computeChangelog(oldData, transformed.tracks)

    // Compute history entry
    const today = new Date().toISOString().slice(0, 10)
    const totalChecks = transformed.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
    const doneChecks = transformed.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)
    const oldHistory = oldData?.history || []
    const todayIdx = oldHistory.findIndex(h => h.date === today)
    const historyEntry = { date: today, totalChecks, doneChecks }
    const history = todayIdx >= 0
      ? [...oldHistory.slice(0, todayIdx), historyEntry, ...oldHistory.slice(todayIdx + 1)]
      : [...oldHistory, historyEntry]

    const output = {
      repo: repo.id,
      updatedAt: new Date().toISOString(),
      tracks: transformed.tracks,
      prd: transformed.prd.length > 0 ? transformed.prd : (oldData?.prd || []),
      history,
      changelog: [...(oldData?.changelog || []), ...newChangelog],
    }

    const pct = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

    if (dryRun) {
      console.log(`  📋 Would write: ${totalChecks} checks, ${doneChecks} done (${pct}%)`)
      console.log(`  📋 New changelog entries: ${newChangelog.length}`)
    } else {
      writeFileSync(outputPath, JSON.stringify(output, null, 2))
      console.log(`  ✅ Synced: ${totalChecks} checks, ${doneChecks} done (${pct}%)`)
    }
    updated++
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`)
    errors++
  }
}

console.log(`\n📊 Summary: ${updated} synced, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)

// --- Changelog diffing (ported from parse-workflow.mjs) ---

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
    file: 'WORKFLOW_*',
    changes,
  }]
}
```

- [ ] **Step 2: Add sync script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"sync": "node scripts/sync.mjs",
"sync:dry": "node scripts/sync.mjs --dry-run"
```

- [ ] **Step 3: Verify the script runs (dry run, no DOCS_DIR)**

Run: `node scripts/sync.mjs --dry-run`
Expected: Shows each repo with `⚠️ DOCS_DIR env var not set` and skips them. No errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.mjs package.json
git commit -m "feat: add sync CLI script with parser integration"
```

---

### Task 5: Notion Parser Stub

**Files:**
- Create: `scripts/parsers/notion.mjs`

The Notion parser uses Notion MCP tools (available in Claude Code context). Since it runs through Claude Code (not Node.js directly), this parser provides the mapping logic for when the sync skill module orchestrates Notion API calls.

- [ ] **Step 1: Create the Notion parser**

```javascript
#!/usr/bin/env node
/**
 * Notion parser — maps Notion database pages to TrackData format.
 *
 * This parser is designed to be called from the sync skill module,
 * which uses Notion MCP tools to fetch the raw data. The transform
 * function converts Notion API responses into the dashboard format.
 *
 * Interface: { name, validate, fetch, transform }
 */

const name = 'notion'

function validate(config) {
  if (!config.databaseId) return { valid: false, error: 'source.databaseId is required' }
  return { valid: true }
}

/**
 * Fetch is a no-op for Notion — the sync skill module handles
 * data fetching via MCP tools. This function returns instructions
 * for the skill module.
 */
function fetch(config, options = {}) {
  return {
    type: 'notion-mcp',
    databaseId: config.databaseId,
    mapping: config.mapping || {},
    instructions: 'Use Notion MCP tools to query this database. Pass the result to transform().',
  }
}

/**
 * Transform Notion API response into TrackData format.
 * @param {object} raw - { pages: Array<NotionPage> }
 *   Each page has properties matching the mapping config.
 * @param {object} options - { mapping, periodMap }
 *   mapping: { step: 'Name', phase: 'Category', done: 'Status', doneValue: '완료', week: 'Sprint' }
 */
function transform(raw, options = {}) {
  const { mapping = {}, periodMap = {} } = options
  const stepField = mapping.step || 'Name'
  const phaseField = mapping.phase || 'Category'
  const doneField = mapping.done || 'Status'
  const doneValue = mapping.doneValue || '완료'
  const weekField = mapping.week || 'Sprint'

  const pages = raw.pages || []

  // Group pages by week
  const weekMap = new Map()
  for (const page of pages) {
    const week = getProperty(page, weekField) || 'W1'
    if (!weekMap.has(week)) weekMap.set(week, [])
    weekMap.get(week).push(page)
  }

  const weeks = []
  for (const [weekId, weekPages] of [...weekMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Group by phase
    const phaseMap = new Map()
    for (const page of weekPages) {
      const phase = getProperty(page, phaseField) || 'Default'
      if (!phaseMap.has(phase)) phaseMap.set(phase, [])
      phaseMap.get(phase).push(page)
    }

    const steps = []
    // Each phase becomes a step with one phase containing check items
    for (const [phaseName, phasePages] of phaseMap) {
      const items = phasePages.map(page => ({
        text: getProperty(page, stepField) || 'Untitled',
        done: getProperty(page, doneField) === doneValue,
      }))

      const total = items.length
      const done = items.filter(i => i.done).length
      const status = done === total ? 'Done' : done > 0 ? 'In Progress' : 'Not Started'

      steps.push({
        name: phaseName,
        status,
        phases: [{ name: phaseName, total, done, items }],
        totalChecks: total,
        doneChecks: done,
      })
    }

    weeks.push({
      week: weekId,
      period: periodMap[weekId] || '',
      steps,
      totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
      doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
    })
  }

  return { tracks: [{ name: 'default', owner: 'unknown', weeks }], prd: [] }
}

/**
 * Extract a property value from a Notion page object.
 * Handles common Notion property types.
 */
function getProperty(page, fieldName) {
  const prop = page.properties?.[fieldName]
  if (!prop) return null

  switch (prop.type) {
    case 'title': return prop.title?.[0]?.plain_text || null
    case 'rich_text': return prop.rich_text?.[0]?.plain_text || null
    case 'select': return prop.select?.name || null
    case 'multi_select': return prop.multi_select?.map(s => s.name).join(', ') || null
    case 'status': return prop.status?.name || null
    case 'checkbox': return prop.checkbox ? '완료' : '미완료'
    case 'number': return prop.number?.toString() || null
    case 'date': return prop.date?.start || null
    default: return null
  }
}

export default { name, validate, fetch, transform }
export { getProperty }
```

- [ ] **Step 2: Verify it loads in registry**

Run: `node -e "import('./scripts/parsers/index.mjs').then(m => console.log('Parsers:', m.listParsers()))"`
Expected: `Parsers: [ 'github-markdown', 'notion' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/parsers/notion.mjs
git commit -m "feat(parsers): add Notion parser with MCP-based fetch and property mapping"
```

---

### Task 6: Linear Parser Stub

**Files:**
- Create: `scripts/parsers/linear.mjs`

- [ ] **Step 1: Create the Linear parser**

```javascript
#!/usr/bin/env node
/**
 * Linear parser — maps Linear issues/projects to TrackData format.
 *
 * Uses Linear GraphQL API. The sync skill module handles authentication
 * and API calls, passing raw issue data to transform().
 *
 * Interface: { name, validate, fetch, transform }
 */

const name = 'linear'

function validate(config) {
  if (!config.projectId) return { valid: false, error: 'source.projectId is required' }
  return { valid: true }
}

/**
 * Fetch returns instructions for the skill module.
 * The actual GraphQL query is executed by Claude Code.
 */
function fetch(config, options = {}) {
  const query = `
    query GetProjectIssues($projectId: String!) {
      project(id: $projectId) {
        name
        issues {
          nodes {
            id
            title
            state { name type }
            labels { nodes { name } }
            cycle { number startsAt endsAt }
          }
        }
      }
    }
  `

  return {
    type: 'linear-graphql',
    projectId: config.projectId,
    query,
    instructions: 'Execute this GraphQL query against Linear API. Pass the result to transform().',
  }
}

/**
 * Transform Linear API response into TrackData format.
 * @param {object} raw - { project: { name, issues: { nodes: [...] } } }
 * @param {object} options - { periodMap }
 *
 * Mapping:
 *   - Issue → check item
 *   - Label → phase/step grouping
 *   - Cycle → week
 *   - State.type 'completed' → done: true
 */
function transform(raw, options = {}) {
  const { periodMap = {} } = options
  const issues = raw.project?.issues?.nodes || raw.issues || []

  // Group by cycle (week)
  const weekMap = new Map()
  for (const issue of issues) {
    const weekId = issue.cycle ? `W${issue.cycle.number}` : 'W1'
    if (!weekMap.has(weekId)) weekMap.set(weekId, [])
    weekMap.get(weekId).push(issue)
  }

  const weeks = []
  for (const [weekId, weekIssues] of [...weekMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Group by first label (as step)
    const stepMap = new Map()
    for (const issue of weekIssues) {
      const label = issue.labels?.nodes?.[0]?.name || 'Uncategorized'
      if (!stepMap.has(label)) stepMap.set(label, [])
      stepMap.get(label).push(issue)
    }

    const steps = []
    for (const [labelName, labelIssues] of stepMap) {
      const items = labelIssues.map(issue => ({
        text: issue.title,
        done: issue.state?.type === 'completed',
      }))

      const total = items.length
      const done = items.filter(i => i.done).length
      const status = done === total ? 'Done' : done > 0 ? 'In Progress' : 'Not Started'

      steps.push({
        name: labelName,
        status,
        phases: [{ name: labelName, total, done, items }],
        totalChecks: total,
        doneChecks: done,
      })
    }

    weeks.push({
      week: weekId,
      period: periodMap[weekId] || '',
      steps,
      totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
      doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
    })
  }

  return {
    tracks: [{ name: raw.project?.name || 'default', owner: 'unknown', weeks }],
    prd: [],
  }
}

export default { name, validate, fetch, transform }
```

- [ ] **Step 2: Verify all three parsers load**

Run: `node -e "import('./scripts/parsers/index.mjs').then(m => console.log('Parsers:', m.listParsers()))"`
Expected: `Parsers: [ 'github-markdown', 'notion', 'linear' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/parsers/linear.mjs
git commit -m "feat(parsers): add Linear parser with GraphQL-based fetch and cycle mapping"
```

---

### Task 7: Sync Skill Module

**Files:**
- Create: `skills/project-dashboard/modules/sync.md`

- [ ] **Step 1: Create the sync module**

```markdown
# Sync Module

Synchronize data from external sources into `data/*.json` files. Uses the parser system in `scripts/parsers/` for data transformation.

## Arguments

Parse remaining arguments after `sync`:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `--dry-run` | Preview changes without writing files |

## Sync Flow

### Step 1: Read Config

1. Read `data/config.json`
2. Identify source type for each repo

### Step 2: Route by Source Type

For each repo (or the specified repo):

#### Source: `github-markdown`

1. Check if `DOCS_DIR` env var is set or if the sync script can locate the docs
2. If running locally:
   - Ask user: "GitHub 리포에서 최신 docs를 가져올까요? (gh CLI 필요)"
   - If yes, run:
     ```bash
     TMPDIR=$(mktemp -d)
     gh api "repos/{source.repo}/tarball" > "$TMPDIR/archive.tar.gz"
     tar -xzf "$TMPDIR/archive.tar.gz" -C "$TMPDIR"
     ```
   - Set DOCS_DIR to extracted path
3. Run: `DOCS_DIR="$docsPath" node scripts/sync.mjs {repo-id}`
4. If `--dry-run`, add `--dry-run` flag

#### Source: `notion`

1. Read the repo's `source.databaseId` and `source.mapping` from config
2. Use Notion MCP tools to query the database:
   - Call `notion-fetch` with the database URL
   - Extract pages with their properties
3. Format the response as `{ pages: [...] }` matching the Notion parser's expected input
4. Write a temporary JSON file with the Notion data
5. Run the transform step via Node.js:
   ```bash
   node -e "
     import parser from './scripts/parsers/notion.mjs';
     const raw = JSON.parse(require('fs').readFileSync('/tmp/notion-data.json'));
     const result = parser.transform(raw, { mapping: {source.mapping}, periodMap: {periodMap} });
     console.log(JSON.stringify(result));
   "
   ```
6. Merge the result into `data/{repo-id}.json` (preserve history, append changelog)

#### Source: `linear`

1. Read the repo's `source.projectId` from config
2. Ask user for Linear API token if not in environment (`LINEAR_API_KEY`)
3. Execute the GraphQL query from the parser:
   ```bash
   curl -s -X POST https://api.linear.app/graphql \
     -H "Authorization: $LINEAR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query": "...", "variables": {"projectId": "{source.projectId}"}}'
   ```
4. Pass the response to the Linear parser's transform function
5. Merge the result into `data/{repo-id}.json`

#### Source: `manual`

Skip — manual sources are edited via `/project-dashboard edit`.

### Step 3: Post-Sync

1. Run `node scripts/validate-data.mjs` to verify data integrity
2. Show summary:

```
📊 Sync 완료

트랙                       결과     변경
────────────────────────────────────────
synapse-platform-svc      ✅ 동기화   +5 checks
synapse-frontend          ✅ 동기화   +12 checks
synapse-knowledge-svc     ⏭️ 변경없음  —
notification-svc          ❌ 오류     DOCS_DIR 미설정
```

3. If any errors occurred, show them with suggested fixes

## Conflict Detection

When merging synced data with existing data:

1. Read existing `data/{repo-id}.json`
2. Check for items with `"source": "manual"` (edited via `/project-dashboard edit`)
3. If the synced data changes an item that was manually edited:
   - Show the conflict: "'{item.text}' was manually set to {done/not done} but sync says {opposite}"
   - Ask: "Keep manual edit / Use synced value / Skip this item"
4. Apply the user's choice

## Batch Sync for GitHub Actions

When running in CI (detected by `GITHUB_ACTIONS` env var):

1. The GitHub Actions workflow handles repo fetching and DOCS_DIR setup
2. Run: `node scripts/sync.mjs` (no interactive prompts)
3. All repos are processed automatically
4. Conflicts are resolved by preferring synced data (CI has no interactive input)
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/modules/sync.md
git commit -m "feat(skill): add sync module with multi-source routing"
```

---

### Task 8: Update Main Router

**Files:**
- Modify: `skills/project-dashboard/project-dashboard.md`

The sync module was listed in the router but the file didn't exist until now. Verify the routing table already includes sync.

- [ ] **Step 1: Read the current router file**

Run: `cat skills/project-dashboard/project-dashboard.md`

Verify the subcommand table includes:
```
| `sync` | Read `modules/sync.md` and follow it |
```

If it already exists (it should from Phase 1), no changes needed.

- [ ] **Step 2: Verify all modules are present**

Run: `ls skills/project-dashboard/modules/`
Expected: `config.md  edit.md  status.md  sync.md`

- [ ] **Step 3: Commit (only if changes were needed)**

If changes were made:
```bash
git add skills/project-dashboard/project-dashboard.md
git commit -m "fix(skill): update router to include sync module"
```

---

### Task 9: Integration Test

**Files:**
- No new files — testing the full parser pipeline

- [ ] **Step 1: Verify all parsers load**

Run: `node -e "import('./scripts/parsers/index.mjs').then(m => console.log('Parsers:', m.listParsers()))"`
Expected: `Parsers: [ 'github-markdown', 'notion', 'linear' ]`

- [ ] **Step 2: Run parser unit tests**

Run: `node scripts/parsers/__fixtures__/test-parsers.mjs`
Expected: All tests pass

- [ ] **Step 3: Run sync in dry-run mode**

Run: `node scripts/sync.mjs --dry-run`
Expected: Shows each repo with skip messages (no DOCS_DIR), no crashes

- [ ] **Step 4: Test sync with actual data (github-markdown only)**

This test uses the existing data files to verify the sync script can handle them:

Run: `node scripts/validate-data.mjs`
Expected: Validation passes

- [ ] **Step 5: Verify build still passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test adjustments for sync pipeline"
```

---

## Plan Summary

| Task | What it creates | Depends on |
|---|---|---|
| Task 1 | `scripts/parsers/index.mjs` (registry) | — |
| Task 2 | `scripts/parsers/github-markdown.mjs` | Task 1 |
| Task 3 | Test fixtures + test runner | Task 2 |
| Task 4 | `scripts/sync.mjs` (CLI) + package.json | Tasks 1, 2 |
| Task 5 | `scripts/parsers/notion.mjs` | Task 1 |
| Task 6 | `scripts/parsers/linear.mjs` | Task 1 |
| Task 7 | `skills/project-dashboard/modules/sync.md` | Tasks 1-6 |
| Task 8 | Router verification | Task 7 |
| Task 9 | Integration test | Tasks 1-8 |

## What's NOT in this plan (deferred to Phase 3)

- **`modules/init.md`** — requires scaffold templates
- **`templates/`** — requires frontend generalization
- **GitHub Actions workflow update** — current `sync-data.yml` works; migration to new sync.mjs is Phase 3
- **Notion/Linear fixture tests** — requires mock API responses, deferred until real integrations are tested
