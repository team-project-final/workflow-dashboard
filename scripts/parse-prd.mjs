#!/usr/bin/env node
/**
 * PRD 파서: PRD 파일에서 요구사항 항목 + 상태 추출.
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

const taskDir = join(docsDir, 'task')

function getTaskStatuses(taskDir) {
  const statuses = new Map()
  if (!existsSync(taskDir)) return statuses

  for (const file of readdirSync(taskDir).filter(f => f.endsWith('.md'))) {
    const content = readFileSync(join(taskDir, file), 'utf-8')
    const steps = content.split(/^## Step \d+/m).slice(1)
    const stepNames = [...content.matchAll(/^## Step (\d+): (.+)$/gm)]

    stepNames.forEach((m, i) => {
      const section = steps[i] || ''
      const doneChecks = (section.match(/- \[x\]/g) || []).length
      const totalChecks = (section.match(/- \[[ x]\]/g) || []).length
      const status = totalChecks === 0 ? 'not_started'
        : doneChecks === totalChecks ? 'done'
        : doneChecks > 0 ? 'in_progress' : 'not_started'
      statuses.set(`Step ${m[1]}`, status)
    })
  }
  return statuses
}

getTaskStatuses(taskDir)

const prdWeeks = []
for (const file of readdirSync(prdDir).filter(f => f.match(/^PRD_W\d+\.md$/)).sort()) {
  const weekMatch = file.match(/PRD_(W\d+)/)
  if (!weekMatch) continue
  const week = weekMatch[1]
  const content = readFileSync(join(prdDir, file), 'utf-8')

  const items = []
  const re = /\|\s*(FR-[A-Z]+-\d+)\s*\|\s*(.+?)\s*\|/g
  let match
  while ((match = re.exec(content)) !== null) {
    const id = match[1]
    const title = match[2].trim()
    if (title === '유저 스토리' || title.startsWith('---')) continue
    items.push({ id, title, status: 'not_started' })
  }

  if (items.length > 0) {
    prdWeeks.push({ week, items })
  }
}

if (existsSync(repoJsonPath)) {
  const data = JSON.parse(readFileSync(repoJsonPath, 'utf-8'))
  data.prd = prdWeeks
  writeFileSync(repoJsonPath, JSON.stringify(data, null, 2))
  console.log(`PRD updated: ${repoJsonPath} (${prdWeeks.length} weeks, ${prdWeeks.reduce((s, w) => s + w.items.length, 0)} items)`)
} else {
  console.log(`Repo JSON not found: ${repoJsonPath}`)
}
