import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('data')

const configPath = path.resolve('data/config.json')
if (!fs.existsSync(configPath)) {
  console.error('data/config.json not found')
  process.exit(1)
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const EXPECTED_REPOS = config.repos.map(r => ({
  repo: r.repo,
  tracks: r.tracks.map(t => t.name),
}))

const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5']
const CHANGE_TYPES = new Set([
  'step_added',
  'step_deleted',
  'step_modified',
  'check_done',
  'check_undone',
  'phase_added',
  'phase_deleted',
])

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
      addError(file, `missing track "${trackName}"`)
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
