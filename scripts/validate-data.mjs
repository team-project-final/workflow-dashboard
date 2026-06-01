import fs from 'node:fs'
import path from 'node:path'
import { CHANGE_TYPE_IDS } from '../src/constants/changeTypes.js'

const DATA_DIR = path.resolve('data')

const configPath = path.resolve('data/config.json')
if (!fs.existsSync(configPath)) {
  console.error('data/config.json not found')
  process.exit(1)
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

// Detect config format: new format has repos[].id, legacy has repos[].tracks
function detectConfigFormat(cfg) {
  if (cfg.repos?.[0]?.id) return 'new'
  if (cfg.repos?.[0]?.repo) return 'legacy'
  return 'unknown'
}

function validateNewConfig(cfg) {
  const errs = []
  if (!cfg.project?.name) errs.push('config.project.name is required')
  if (!Array.isArray(cfg.periods) || cfg.periods.length === 0) {
    errs.push('config.periods must be a non-empty array')
  }
  for (const p of (cfg.periods || [])) {
    if (!p.id || !p.start || !p.end) errs.push(`Period missing required fields: ${JSON.stringify(p)}`)
  }
  if (!Array.isArray(cfg.columns) || cfg.columns.length === 0) {
    errs.push('config.columns must be a non-empty array')
  }
  for (const c of (cfg.columns || [])) {
    if (!c.id || !c.label || !c.type) errs.push(`Column missing required fields: ${JSON.stringify(c)}`)
    if (c.type && !['list', 'checklist', 'kanban'].includes(c.type)) errs.push(`Unknown column type: ${c.type}`)
  }
  for (const r of (cfg.repos || [])) {
    if (!r.id || !r.trackName || !r.owner) errs.push(`Repo missing required fields: ${JSON.stringify(r)}`)
  }
  return errs
}

const configFormat = detectConfigFormat(config)

// Validate new config format if detected
if (configFormat === 'new') {
  const configErrors = validateNewConfig(config)
  if (configErrors.length > 0) {
    console.error('Config validation failed:')
    configErrors.forEach(e => console.error(`  ❌ ${e}`))
    process.exitCode = 1
  }
}

// Build expected repos list based on config format
const EXPECTED_REPOS = configFormat === 'new'
  ? config.repos.map(r => ({ repo: r.id, tracks: [r.trackName] }))
  : config.repos.map(r => ({ repo: r.repo, tracks: r.tracks.map(t => t.name) }))

// (repo, track) pairs feeding a virtualTrack are allowed to be missing
// (the virtualTrack aggregates whatever sources exist).
const VIRTUAL_TRACK_SOURCES = new Set(
  (config.virtualTracks || []).flatMap(vt =>
    (vt.sources || []).map(s => `${s.repo}::${s.track}`)
  )
)

// Determine expected weeks based on config format
const WEEKS = configFormat === 'new'
  ? config.periods.map(p => p.id)
  : ['W1', 'W2', 'W3', 'W4', 'W5']
const CHANGE_TYPES = new Set(CHANGE_TYPE_IDS)

const errors = []
const warnings = []

function addError(file, message) {
  errors.push(`${file}: ${message}`)
}

function addWarning(file, message) {
  warnings.push(`${file}: ${message}`)
}

function readJson(file) {
  const fullPath = path.join(DATA_DIR, file)
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  } catch (error) {
    addError(file, `invalid JSON (${error.message})`)
    return null
  }
}

function sumSteps(steps, key) {
  return (steps || []).reduce((sum, step) => sum + (Number(step?.[key]) || 0), 0)
}

function sumPhases(phases, key) {
  return (phases || []).reduce((sum, phase) => sum + (Number(phase?.[key]) || 0), 0)
}

function validateTotals(file, track, week) {
  const steps = week.steps || []
  const stepTotal = sumSteps(steps, 'totalChecks')
  const stepDone = sumSteps(steps, 'doneChecks')

  if (stepTotal !== (Number(week.totalChecks) || 0) || stepDone !== (Number(week.doneChecks) || 0)) {
    addError(
      file,
      `${track.name} ${week.week} totals mismatch: week=${week.doneChecks}/${week.totalChecks}, steps=${stepDone}/${stepTotal}`
    )
  }

  for (const step of steps) {
    const phaseTotal = sumPhases(step.phases, 'total')
    const phaseDone = sumPhases(step.phases, 'done')

    if (phaseTotal !== (Number(step.totalChecks) || 0) || phaseDone !== (Number(step.doneChecks) || 0)) {
      addError(
        file,
        `${track.name} ${week.week} "${step.name}" totals mismatch: step=${step.doneChecks}/${step.totalChecks}, phases=${phaseDone}/${phaseTotal}`
      )
    }
  }
}

for (const expected of EXPECTED_REPOS) {
  const file = `${expected.repo}.json`
  if (!fs.existsSync(path.join(DATA_DIR, file))) {
    addError(file, 'missing data file')
    continue
  }

  const data = readJson(file)
  if (!data) continue

  if (data.repo !== expected.repo) {
    addError(file, `repo field should be "${expected.repo}", got "${data.repo}"`)
  }

  const tracks = data.tracks || []
  for (const trackName of expected.tracks) {
    const track = tracks.find(item => item?.name === trackName)
    if (!track) {
      if (VIRTUAL_TRACK_SOURCES.has(`${expected.repo}::${trackName}`)) {
        addWarning(file, `missing track "${trackName}"; consumed by a virtualTrack and will be treated as empty`)
      } else {
        addError(file, `missing track "${trackName}"`)
      }
      continue
    }

    const trackWeeks = track.weeks || []
    const weekNames = trackWeeks.map(week => week.week)
    for (const week of WEEKS) {
      if (!weekNames.includes(week)) {
        addWarning(file, `${trackName} is missing ${week}; app will normalize it as an empty week`)
      }
    }

    for (const week of trackWeeks) {
      if (!WEEKS.includes(week.week)) {
        addError(file, `${trackName} has unknown week "${week.week}"`)
      }
      validateTotals(file, track, week)
    }
  }

  const prdArray = data.prd || []
  if (prdArray.length > 0) {
    const prdWeeks = prdArray.map(week => week.week)
    for (const week of WEEKS) {
      if (!prdWeeks.includes(week)) {
        addError(file, `PRD is missing ${week}`)
      }
    }
  }

  for (const entry of data.changelog || []) {
    if (!entry.date || !entry.commit || !entry.file || !Array.isArray(entry.changes)) {
      addError(file, 'changelog entries require date, commit, file, and changes[]')
      continue
    }

    for (const change of entry.changes) {
      if (!CHANGE_TYPES.has(change.type)) {
        addError(file, `unknown changelog change type "${change.type}"`)
      }
    }
  }
}

if (warnings.length > 0) {
  console.warn('Data warnings:')
  for (const warning of warnings) console.warn(`- ${warning}`)
}

if (errors.length > 0) {
  console.error('Data validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Data validation passed with ${warnings.length} warning(s).`)
