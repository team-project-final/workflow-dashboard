#!/usr/bin/env node
/**
 * PRD 파서: PRD 파일에서 해당 레포 담당 요구사항만 추출.
 * Usage: node parse-prd.mjs <docs-dir> <repo-json>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const [docsDir, repoJsonPath] = process.argv.slice(2)
if (!docsDir || !repoJsonPath) {
  console.error('Usage: node parse-prd.mjs <docs-dir> <repo-json>')
  process.exit(1)
}

const prdDir = join(docsDir, 'prd')
if (!existsSync(prdDir)) {
  console.log('PRD dir not found, skipping')
  process.exit(0)
}

// 레포별 담당 FR 접두사 매핑
const REPO_FR_PREFIXES = {
  'synapse-platform-svc':    ['FR-PL'],
  'synapse-engagement-svc':  ['FR-EG'],
  'synapse-knowledge-svc':   ['FR-KN', 'FR-K2'],
  'synapse-learning-svc':    ['FR-LC', 'FR-LA'],
  'synapse-frontend':        ['FR-FE'],
  'synapse-gitops':          ['FR-GO'],
  'synapse-shared':          ['FR-TL'],
}

// repo-json 경로에서 레포명 추출
const repoData = existsSync(repoJsonPath)
  ? JSON.parse(readFileSync(repoJsonPath, 'utf-8'))
  : null
const repoName = repoData?.repo || ''
const allowedPrefixes = REPO_FR_PREFIXES[repoName] || []

// FR-ALL은 모든 레포에 공통 포함
const matchesRepo = (frId) => {
  if (frId.startsWith('FR-ALL')) return true
  if (allowedPrefixes.length === 0) return true  // 매핑 없으면 전부 포함
  return allowedPrefixes.some(prefix => frId.startsWith(prefix))
}

const prdWeeks = []
for (const file of readdirSync(prdDir).filter(f => f.match(/^PRD_W\d+\.md$/)).sort()) {
  const weekMatch = file.match(/PRD_(W\d+)/)
  if (!weekMatch) continue
  const week = weekMatch[1]
  const content = readFileSync(join(prdDir, file), 'utf-8')

  const items = []
  const re = /\|\s*(FR-[A-Z0-9]+-\d+)\s*\|\s*(.+?)\s*\|/g
  let match
  while ((match = re.exec(content)) !== null) {
    const id = match[1]
    const title = match[2].trim()
    if (title === '유저 스토리' || title.startsWith('---')) continue
    if (!matchesRepo(id)) continue
    items.push({ id, title, status: 'not_started' })
  }

  if (items.length > 0) {
    prdWeeks.push({ week, items })
  }
}

if (repoData) {
  repoData.prd = prdWeeks
  writeFileSync(repoJsonPath, JSON.stringify(repoData, null, 2))
  const totalItems = prdWeeks.reduce((s, w) => s + w.items.length, 0)
  console.log(`PRD updated: ${repoJsonPath} (${prdWeeks.length} weeks, ${totalItems} items, prefixes: ${allowedPrefixes.join(',')}${allowedPrefixes.length ? '+FR-ALL' : 'all'})`)
} else {
  console.log(`Repo JSON not found: ${repoJsonPath}`)
}
