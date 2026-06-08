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
import { resolve } from 'path'
import { getParser, listParsers } from './parsers/index.mjs'
import { applyDoneGuard } from './parsers/done-guard.mjs'

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

    // done 회귀 방지 가드 — Step별로 이전(높은) 스냅샷 유지. FORCE=true면 우회.
    const force = process.env.FORCE === 'true'
    const guardedTracks = applyDoneGuard(oldData?.tracks, transformed.tracks, { force })

    // Compute changelog
    const newChangelog = computeChangelog(oldData, guardedTracks)

    // Compute history entry
    const today = new Date().toISOString().slice(0, 10)
    const totalChecks = guardedTracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
    const doneChecks = guardedTracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)
    const oldHistory = oldData?.history || []
    const todayIdx = oldHistory.findIndex(h => h.date === today)
    // today entry는 단조 증가만 허용 (max). 같은 날 여러 sync가 작은 값으로 덮어쓰는 회귀를 막음.
    const todayEntry = todayIdx >= 0
      ? {
          date: today,
          totalChecks: Math.max(Number(oldHistory[todayIdx].totalChecks) || 0, totalChecks),
          doneChecks: Math.max(Number(oldHistory[todayIdx].doneChecks) || 0, doneChecks),
        }
      : { date: today, totalChecks, doneChecks }
    const history = todayIdx >= 0
      ? [...oldHistory.slice(0, todayIdx), todayEntry, ...oldHistory.slice(todayIdx + 1)]
      : [...oldHistory, todayEntry]

    const output = {
      repo: repo.id,
      updatedAt: new Date().toISOString(),
      tracks: guardedTracks,
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
