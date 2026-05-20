#!/usr/bin/env node
/**
 * Scaffold generator — creates a new dashboard project from templates.
 * Usage: node scripts/scaffold.mjs <output-dir> <config-json>
 *
 * config-json is a path to a JSON file with the project configuration.
 * Templates are read from skills/project-dashboard/templates/scaffold/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join, resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const [outputDir, configJsonPath] = process.argv.slice(2)
if (!outputDir || !configJsonPath) {
  console.error('Usage: node scripts/scaffold.mjs <output-dir> <config-json>')
  process.exit(1)
}

const config = JSON.parse(readFileSync(resolve(configJsonPath), 'utf-8'))
const templateDir = resolve(__dirname, '..', 'skills', 'project-dashboard', 'templates', 'scaffold')
const outDir = resolve(outputDir)

if (!existsSync(templateDir)) {
  console.error(`Template directory not found: ${templateDir}`)
  process.exit(1)
}

// Template variable replacements
const vars = {
  '{{PROJECT_NAME}}': config.project?.name?.toLowerCase().replace(/\s+/g, '-') || 'my-dashboard',
  '{{PROJECT_TITLE}}': config.project?.name || 'Dashboard',
  '{{BASE_PATH}}': config.basePath || '/',
}

function applyTemplate(content) {
  let result = content
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value)
  }
  return result
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const stat = statSync(srcPath)

    if (stat.isDirectory()) {
      copyDir(srcPath, join(dest, entry))
    } else if (entry.endsWith('.tmpl')) {
      // Template file — apply variable substitution, remove .tmpl extension
      const outName = entry.replace('.tmpl', '')
      const content = readFileSync(srcPath, 'utf-8')
      writeFileSync(join(dest, outName), applyTemplate(content))
      console.log(`  📝 ${relative(outDir, join(dest, outName))} (templated)`)
    } else {
      // Static file — copy as-is
      cpSync(srcPath, join(dest, entry))
      console.log(`  📄 ${relative(outDir, join(dest, entry))}`)
    }
  }
}

console.log(`\n🚀 Scaffolding project: ${vars['{{PROJECT_TITLE}}']}`)
console.log(`   Output: ${outDir}\n`)

// Copy all template files
copyDir(templateDir, outDir)

// Write the config.json
const configOutPath = join(outDir, 'data', 'config.json')
mkdirSync(dirname(configOutPath), { recursive: true })
writeFileSync(configOutPath, JSON.stringify(config, null, 2))
console.log(`  📝 data/config.json (generated)`)

// Create empty data files for each repo
for (const repo of config.repos || []) {
  const repoId = repo.id || repo.repo
  const trackName = repo.trackName || repo.tracks?.[0]?.name || repoId
  const owner = repo.owner || repo.tracks?.[0]?.owner || 'unknown'

  const emptyData = {
    repo: repoId,
    updatedAt: new Date().toISOString(),
    tracks: [{ name: trackName, owner, weeks: [] }],
    prd: [],
    history: [],
    changelog: [],
  }

  const dataPath = join(outDir, 'data', `${repoId}.json`)
  writeFileSync(dataPath, JSON.stringify(emptyData, null, 2))
  console.log(`  📝 data/${repoId}.json (empty)`)
}

// Remove .gitkeep if data files were created
const gitkeep = join(outDir, 'data', '.gitkeep')
if (existsSync(gitkeep) && readdirSync(join(outDir, 'data')).length > 1) {
  unlinkSync(gitkeep)
}

console.log(`\n✅ Project scaffolded at ${outDir}`)
console.log(`\nNext steps:`)
console.log(`  cd ${outputDir}`)
console.log(`  npm install`)
console.log(`  npm run dev`)
