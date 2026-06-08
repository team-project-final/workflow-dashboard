#!/usr/bin/env node
/**
 * WORKFLOW/TASK 파서: 마크다운 체크박스를 파싱하여 JSON 생성.
 * Usage: node parse-workflow.mjs <docs-dir> <repo-name> <output-json>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { parseWorkflowMarkdown } from './parsers/parse-workflow-md.mjs'
import { applyDoneGuard } from './parsers/done-guard.mjs'

const [docsDir, repoName, outputPath] = process.argv.slice(2)
if (!docsDir || !repoName || !outputPath) {
  console.error('Usage: node parse-workflow.mjs <docs-dir> <repo-name> <output-json>')
  process.exit(1)
}

function parseWorkflowFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  return parseWorkflowMarkdown(content)
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

// trackAliasMap — 워크플로 파일명의 트랙명을 config 트랙명에 매핑
// (e.g. WORKFLOW_gitops_W1.md → team-lead 트랙)
const trackAliasMap = {
  gitops: 'team-lead',
}

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

// done 회귀 방지 가드 — WIP 브랜치가 최신 커밋이어도 done 수가 역행하지 않도록
// Step별로 이전(높은) 스냅샷을 유지. FORCE=true면 우회. changelog/합계 계산 전에 적용.
const force = process.env.FORCE === 'true'
const guardedTracks = applyDoneGuard(oldData?.tracks, tracks, { force })

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
        // 박스 라인 자체의 추가/제거 추적 (다음 주차로 이월, 항목 정리 등)
        const totalDiff = newStep.totalChecks - (oldStep?.totalChecks || 0)
        if (totalDiff > 0) {
          changes.push({
            type: 'boxes_added',
            target: `${newWeek.week} > ${newStep.name}`,
            detail: `${totalDiff}개 박스 추가 (${oldStep?.totalChecks || 0} → ${newStep.totalChecks})`,
          })
        } else if (totalDiff < 0) {
          changes.push({
            type: 'boxes_removed',
            target: `${newWeek.week} > ${newStep.name}`,
            detail: `${-totalDiff}개 박스 제거 (${oldStep?.totalChecks || 0} → ${newStep.totalChecks})`,
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

const newChangelog = computeChangelog(oldData, guardedTracks)

// history 업데이트
const today = new Date().toISOString().slice(0, 10)
const totalChecks = guardedTracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
const doneChecks = guardedTracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)

const oldHistory = oldData?.history || []
const todayIdx = oldHistory.findIndex(h => h.date === today)
// today entry는 단조 증가만 허용 (max). 다른 브랜치 sync 결과를 main sync가 작은 값으로 덮어쓰는 회귀를 막음.
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

const prd = oldData?.prd || []
const changelog = [...(oldData?.changelog || []), ...newChangelog]

const output = {
  repo: repoName,
  updatedAt: new Date().toISOString(),
  tracks: guardedTracks,
  prd,
  history,
  changelog,
}

writeFileSync(outputPath, JSON.stringify(output, null, 2))
console.log(`Parsed: ${repoName} → ${outputPath}`)
console.log(`  Tracks: ${tracks.map(t => t.name).join(', ')}`)
console.log(`  Total: ${totalChecks} checks, ${doneChecks} done (${totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0}%)`)
console.log(`  New changelog entries: ${newChangelog.length}`)
