# change type 단일 소스화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the duplicated changelog change-type definitions into one JS module (`src/constants/changeTypes.js`) that both the Node validator and the React UI import, fixing the live `ChangelogTab` `boxes_*` mislabel, syncing the skill scaffold, and adding a drift-guard test.

**Architecture:** One plain-JS ESM module is the single source. `validate-data.mjs` (Node, run directly) imports its id list; `ChangelogTab.tsx` (Vite/TS, `allowJs` enabled) imports its metadata map and derives labels/colors/filters; `ChangeDetail.type` loosens to `string`; a `node --test` asserts the parser only emits canonical ids. The skill scaffold mirrors the same module + UI.

**Tech Stack:** Node ESM `.mjs` scripts, React 19 / Vite / TypeScript (`tsc -b`), `node --test`.

---

## File Structure

- Create: `src/constants/changeTypes.js` — single source (id + label + bg/text/border + category).
- Modify: `tsconfig.app.json` — `allowJs: true` so TS can import the `.js`.
- Modify: `scripts/validate-data.mjs` — derive the allowed-type Set from the module.
- Modify: `src/components/ChangelogTab.tsx` — consume `CHANGE_TYPE_META`, derive filters from `category`.
- Modify: `src/types/index.ts` — `ChangeDetail.type` → `string`.
- Create: `scripts/parsers/__fixtures__/change-types.test.mjs` — drift-guard test.
- Modify: `package.json` — run all tests in the fixtures dir.
- Mirror into skill scaffold: `changeTypes.js` (new), `ChangelogTab.tsx`, `types/index.ts`, `tsconfig.app.json`, `references/data-schema.md`.

The refactored `ChangelogTab.tsx` is **byte-identical** for the main repo and the scaffold (same relative import path), so Task 5 reuses Task 4's exact file content.

---

## Task 1: Create the canonical module + enable allowJs

**Files:**
- Create: `src/constants/changeTypes.js`
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Create `src/constants/changeTypes.js`**

```js
// Single source of truth for changelog change types.
// Imported by both Node scripts (scripts/validate-data.mjs) and the React UI
// (src/components/ChangelogTab.tsx). Node uses only `id`; label/bg/text/border/category
// are UI-only fields (Node ignores them).
export const CHANGE_TYPES = [
  { id: 'step_added',    label: 'Step 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'step_deleted',  label: 'Step 삭제', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
  { id: 'step_modified', label: '내용 수정', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-l-amber',      category: 'modified'  },
  { id: 'check_done',    label: '체크 완료', bg: 'bg-green-50', text: 'text-green-800', border: 'border-l-success',    category: 'checks'    },
  { id: 'check_undone',  label: '체크 해제', bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-l-stone-400',  category: 'checks'    },
  { id: 'phase_added',   label: '단계 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'phase_deleted', label: '단계 삭제', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
  { id: 'boxes_added',   label: '박스 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'boxes_removed', label: '박스 제거', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
]

export const CHANGE_TYPE_IDS = CHANGE_TYPES.map(t => t.id)
export const CHANGE_TYPE_META = Object.fromEntries(CHANGE_TYPES.map(t => [t.id, t]))
```

- [ ] **Step 2: Enable allowJs in `tsconfig.app.json`**

Add `"allowJs": true,` to `compilerOptions`. Insert it right after the `"skipLibCheck": true,` line so the block reads:
```json
    "types": ["vite/client"],
    "skipLibCheck": true,
    "allowJs": true,
```

- [ ] **Step 3: Verify the module loads and the build passes**

Run: `node -e "import('./src/constants/changeTypes.js').then(m => console.log(m.CHANGE_TYPE_IDS.length, m.CHANGE_TYPE_META.boxes_added.label))"`
Expected: prints `9 박스 추가`

Run: `npm run build`
Expected: `tsc -b && vite build` succeeds (the `.js` is now allowed under src; nothing imports it yet).

- [ ] **Step 4: Commit**

```bash
git add src/constants/changeTypes.js tsconfig.app.json
git commit -m "feat: add single-source changeTypes module + allowJs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Drift-guard test

**Files:**
- Create: `scripts/parsers/__fixtures__/change-types.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the test**

Create `scripts/parsers/__fixtures__/change-types.test.mjs`:

```js
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
```

- [ ] **Step 2: Point the test script at the fixtures directory**

In `package.json`, change the `test` script from:
```json
    "test": "node --test scripts/parsers/__fixtures__/parse-workflow-md.test.mjs",
```
to:
```json
    "test": "node --test scripts/parsers/__fixtures__/",
```
(`node --test <dir>` discovers every `*.test.mjs` in the dir — both the existing parser test and the new one — and ignores non-test files like the `github-markdown/` fixtures.)

- [ ] **Step 3: Run the tests**

Run: `npm run test`
Expected: PASS — the existing `parse-workflow-md.test.mjs` tests AND the new `change-types` test all pass (the parser currently emits only ids present in canonical).

- [ ] **Step 4: Sanity-check the guard actually catches drift**

Temporarily append a bogus emit to verify the test fails, then revert:

Run: `node -e "const fs=require('fs');const p='scripts/parse-workflow.mjs';const s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,s+\"\n// type: 'bogus_type'\n\")"`
Run: `npm run test` → Expected: FAIL with `canonical에 없는 change type 방출: bogus_type`
Revert: `git checkout -- scripts/parse-workflow.mjs`
Run: `npm run test` → Expected: PASS again

- [ ] **Step 5: Commit**

```bash
git add scripts/parsers/__fixtures__/change-types.test.mjs package.json
git commit -m "test: guard parser change types against canonical drift

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire the validator to the canonical module

**Files:**
- Modify: `scripts/validate-data.mjs`

- [ ] **Step 1: Add the canonical import**

In `scripts/validate-data.mjs`, after the existing import lines (currently lines 1-2):
```js
import fs from 'node:fs'
import path from 'node:path'
```
add:
```js
import { CHANGE_TYPE_IDS } from '../src/constants/changeTypes.js'
```

- [ ] **Step 2: Replace the inline Set with a derived one**

Replace this exact block (currently lines 71-81):
```js
const CHANGE_TYPES = new Set([
  'step_added',
  'step_deleted',
  'step_modified',
  'check_done',
  'check_undone',
  'phase_added',
  'phase_deleted',
  'boxes_added',    // 박스(체크 항목) 총개수 증가 — parse-workflow.mjs가 생성
  'boxes_removed',  // 박스(체크 항목) 총개수 감소 — parse-workflow.mjs가 생성
])
```
with:
```js
const CHANGE_TYPES = new Set(CHANGE_TYPE_IDS)
```
(The downstream usage `CHANGE_TYPES.has(change.type)` is unchanged — keeping the local name minimizes churn while the set is now derived from the single source.)

- [ ] **Step 3: Verify validation still passes**

Run: `npm run validate:data`
Expected: `Data validation passed with 1 warning(s).` (exit 0) — same as before, now sourced from canonical.

Run: `npm run test`
Expected: PASS (validator change does not affect tests; confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-data.mjs
git commit -m "refactor: derive validator change-type set from canonical module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Refactor main-repo UI + type to the canonical module (fixes the boxes_* mislabel)

**Files:**
- Modify: `src/components/ChangelogTab.tsx`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Loosen `ChangeDetail.type` in `src/types/index.ts`**

Change the `ChangeDetail` interface's `type` field (currently line 53):
```ts
  type: 'step_added' | 'step_deleted' | 'step_modified' | 'check_done' | 'check_undone' | 'phase_added' | 'phase_deleted'
```
to:
```ts
  type: string
```
(Valid values are enforced at runtime by the validator + the drift-guard test; the literal union was itself the thing that drifted.)

- [ ] **Step 2: Replace `src/components/ChangelogTab.tsx` entirely**

Replace the whole file with:

```tsx
import { useState } from 'react'
import type { ChangelogEntry } from '../types'
import { CHANGE_TYPE_META } from '../constants/changeTypes.js'

type FilterType = 'all' | 'structure' | 'modified' | 'checks'

interface Props {
  changelog: ChangelogEntry[]
}

export default function ChangelogTab({ changelog }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = changelog
    .flatMap(entry =>
      entry.changes
        .filter(c => filter === 'all' || CHANGE_TYPE_META[c.type]?.category === filter)
        .map(c => ({ ...c, date: entry.date, commit: entry.commit, author: entry.author, file: entry.file }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const grouped = new Map<string, typeof filtered>()
  for (const item of filtered) {
    const day = item.date.slice(0, 10)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day)!.push(item)
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'structure', label: 'Step 추가/삭제' },
    { key: 'modified', label: '내용 수정' },
    { key: 'checks', label: '체크 완료' },
  ]

  return (
    <div>
      <div className="px-6 py-3 flex gap-2 items-center border-b border-stone-200 bg-white">
        <span className="text-[11px] text-stone-500">필터:</span>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
              filter === f.key ? 'bg-amber text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-stone-400">총 {filtered.length}건</span>
      </div>

      <div className="px-6 py-4">
        {[...grouped].map(([day, items]) => (
          <div key={day} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-amber rounded-full" />
              <span className="text-xs font-bold text-stone-600">{day}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
            {items.map((item, i) => {
              const cfg = CHANGE_TYPE_META[item.type] || CHANGE_TYPE_META.check_done
              return (
                <div key={i} className={`ml-5 mb-2 p-2.5 bg-white rounded-lg border-l-[3px] ${cfg.border} shadow-sm`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-semibold text-stone-700">{item.file}</span>
                      </div>
                      <div className="text-xs text-stone-600 mt-1">{item.target}</div>
                      {item.detail && <div className="text-[10px] text-stone-500 mt-0.5">{item.detail}</div>}
                      {item.type === 'step_modified' && item.before && item.after && (
                        <div className="mt-1.5 font-mono text-[10px] rounded overflow-hidden border border-stone-200">
                          <div className="px-2 py-1 bg-red-50 text-red-900">
                            <span className="text-danger font-bold">−</span> {item.before}
                          </div>
                          <div className="px-2 py-1 bg-green-50 text-green-900">
                            <span className="text-success font-bold">+</span> {item.after}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3 whitespace-nowrap">
                      <div className="text-[9px] text-stone-400">{item.date.slice(11, 16)}</div>
                      <code className="text-[9px] bg-stone-100 px-1 py-0.5 rounded text-stone-500">
                        {item.commit}
                      </code>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">변경 이력이 없습니다</p>
        )}
      </div>

      <div className="px-6 pb-4">
        <div className="flex gap-4 flex-wrap text-[11px] text-stone-700">
          <span><span className="inline-block w-2.5 h-2.5 bg-info rounded-sm align-middle mr-1" />추가</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-danger rounded-sm align-middle mr-1" />삭제</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-amber rounded-sm align-middle mr-1" />수정</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-success rounded-sm align-middle mr-1" />완료</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run build`
Expected: succeeds (allowJs lets TS import `CHANGE_TYPE_META`; `item.type: string` indexes the metadata map).

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChangelogTab.tsx src/types/index.ts
git commit -m "fix: render boxes_* changelog types via canonical metadata

ChangelogTab now derives labels/colors/filters from the single-source
module instead of a hardcoded 7-type map, so boxes_added/boxes_removed
show as 박스 추가/제거 instead of falling back to 체크 완료.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mirror into the skill scaffold + update the schema doc

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/constants/changeTypes.js`
- Modify: `skills/project-dashboard/templates/scaffold/src/components/ChangelogTab.tsx`
- Modify: `skills/project-dashboard/templates/scaffold/src/types/index.ts`
- Modify: `skills/project-dashboard/templates/scaffold/tsconfig.app.json`
- Modify: `skills/project-dashboard/references/data-schema.md`

The scaffold has no validator/parser, so the module feeds only the UI + types. The content mirrors the main repo exactly.

- [ ] **Step 1: Create the scaffold canonical module**

Copy the main module verbatim:
```bash
cp src/constants/changeTypes.js skills/project-dashboard/templates/scaffold/src/constants/changeTypes.js
```
Verify it matches:
Run: `git diff --no-index src/constants/changeTypes.js skills/project-dashboard/templates/scaffold/src/constants/changeTypes.js`
Expected: no output (identical).

- [ ] **Step 2: Mirror the refactored ChangelogTab**

The refactored `ChangelogTab.tsx` is identical for both trees (same relative import path `../constants/changeTypes.js`). Copy it:
```bash
cp src/components/ChangelogTab.tsx skills/project-dashboard/templates/scaffold/src/components/ChangelogTab.tsx
```
Verify: `git diff --no-index src/components/ChangelogTab.tsx skills/project-dashboard/templates/scaffold/src/components/ChangelogTab.tsx`
Expected: no output.

- [ ] **Step 3: Loosen the scaffold `ChangeDetail.type`**

In `skills/project-dashboard/templates/scaffold/src/types/index.ts`, change the `ChangeDetail` `type` field from the 7-literal union:
```ts
  type: 'step_added' | 'step_deleted' | 'step_modified' | 'check_done' | 'check_undone' | 'phase_added' | 'phase_deleted'
```
to:
```ts
  type: string
```

- [ ] **Step 4: Add allowJs to the scaffold tsconfig**

In `skills/project-dashboard/templates/scaffold/tsconfig.app.json`, add `"allowJs": true,` to `compilerOptions` immediately after the `"skipLibCheck": true,` line (matching the main repo edit). If that file has no `skipLibCheck` line, add `"allowJs": true,` as the first entry inside `compilerOptions`.

- [ ] **Step 5: Update the schema doc**

In `skills/project-dashboard/references/data-schema.md`, update the changelog `type` documentation (around line 166) from:
```
          "type": "'step_added' | 'step_deleted' | 'step_modified' | 'check_done' | 'check_undone' | 'phase_added' | 'phase_deleted'",
```
to:
```
          "type": "change type id — 단일 소스: src/constants/changeTypes.js (step_added, step_deleted, step_modified, check_done, check_undone, phase_added, phase_deleted, boxes_added, boxes_removed)",
```
And in the comparison row around line 233, change `(step_added, check_done, etc.)` to `(step_added, check_done, boxes_added, etc.)`.

- [ ] **Step 6: Commit**

```bash
git add skills/project-dashboard/
git commit -m "chore: sync skill scaffold + schema doc to canonical change types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full automated gate**

Run: `npm run lint && npm run test && npm run validate:data && npm run build`
Expected: all exit 0 — lint clean, both test files pass, validation passes, build succeeds.

- [ ] **Step 2: Verify the live fix in the browser**

Start: `npm run dev`. Open a repo with `boxes_*` changelog entries, e.g.
`http://localhost:<port>/workflow-dashboard/#/detail/team-lead` (synapse-gitops/synapse-shared) or
`#/detail/synapse-gitops`, and switch to the 변경 이력 (changelog) tab. Verify:

1. Entries whose detail mentions "박스 추가/제거" now show the label **박스 추가** (sky) or **박스 제거** (red) — NOT the green **체크 완료**.
2. The **Step 추가/삭제** (structure) filter includes those `boxes_*` entries.
3. Other types (체크 완료, 내용 수정 등) still render with their original colors/labels.

- [ ] **Step 3: Confirm scaffold mirror equality**

Run: `git diff --no-index src/constants/changeTypes.js skills/project-dashboard/templates/scaffold/src/constants/changeTypes.js && git diff --no-index src/components/ChangelogTab.tsx skills/project-dashboard/templates/scaffold/src/components/ChangelogTab.tsx`
Expected: no output for either (both identical).

- [ ] **Step 4 note:** No push. Integration/push is handled separately (the user works on `main` directly per prior decisions and will confirm before any push).

---

## Notes

- **Why `ChangeDetail.type: string`:** Approach A intentionally drops the literal union (it was the field that silently drifted). Runtime enforcement = validator (canonical-derived) + the drift-guard test; the UI falls back gracefully for any truly-unknown id.
- **Scripts vs TS boundary:** `.mjs` scripts import the `.js` at Node runtime (not typechecked by `tsc`); the UI imports it through Vite/TS with `allowJs`. One file, two consumers, no duplication.
- **Out of scope:** restoring the literal union, making the parser read ids from canonical (kept as inline literals, guarded by the test), Notion/Linear parsers, any color/label redesign.
