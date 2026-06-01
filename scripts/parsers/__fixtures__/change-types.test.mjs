import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CHANGE_TYPE_IDS } from '../../../src/constants/changeTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const parserSrc = readFileSync(join(__dirname, '../../parse-workflow.mjs'), 'utf-8')

test('parser가 방출하는 모든 change type는 canonical(CHANGE_TYPE_IDS)에 존재', () => {
  const emitted = [...parserSrc.matchAll(/type:\s*'([a-z_]+)'/g)].map(m => m[1])
  assert.ok(emitted.length > 0, '파서에서 방출 타입을 찾지 못함')
  const idSet = new Set(CHANGE_TYPE_IDS)
  for (const t of emitted) {
    assert.ok(idSet.has(t), `canonical에 없는 change type 방출: ${t}`)
  }
})
