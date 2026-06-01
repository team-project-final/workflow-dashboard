# change type 단일 소스화 설계

- **작성일:** 2026-06-01
- **상태:** 초안 (사용자 리뷰 대기)
- **대상 코드:** `workflow-dashboard` (React + Vite) + `skills/project-dashboard` (scaffold 템플릿)
- **관련:** 2026-06-01-sync-deploy-validation-fix-design (검증기 boxes_* 1차 수정)

## 1. 요약

changelog의 change type 목록이 **파서·검증기·UI·타입·문서·스킬 scaffold 여러 곳에 중복 정의**되어 드리프트가 발생했다.
파서가 `boxes_added`/`boxes_removed`를 방출하지만, 검증기(1차 수정 완료), UI `ChangelogTab`, `ChangeDetail` 타입,
스킬 scaffold, 문서는 이를 모른다.

이 설계는 change type 정의를 **단일 소스 모듈 하나(`src/constants/changeTypes.js`)** 로 모으고,
검증기·UI가 모두 거기서 파생하도록 리팩터한다. 그 과정에서:
- **(A)** 본 레포 `ChangelogTab`의 `boxes_*` 오표시(현재 초록 "체크 완료"로 잘못 표시됨)를 해소
- **(B)** 스킬 scaffold(types·ChangelogTab·문서)를 본 레포와 동기화
- **(C)** 단일 소스 + 드리프트 방지 테스트로 재발을 구조적으로 차단

## 2. 배경 / 현재 드리프트 위치

`boxes_added`/`boxes_removed`가 누락된 change-type 목록:

| 위치 | 역할 | 현재 |
|---|---|---|
| `scripts/parse-workflow.mjs` | 파서 (방출) | boxes_* **포함** (9종 방출) |
| `scripts/validate-data.mjs` | 검증기 (허용 Set) | 1차 수정으로 boxes_* 포함(9종) |
| `src/components/ChangelogTab.tsx` `TYPE_CONFIG` | UI 라벨·색 | boxes_* **누락** → 라이브 오표시 |
| `src/types/index.ts` `ChangeDetail.type` | TS 유니온 | boxes_* **누락** (런타임 무해) |
| `skills/.../references/data-schema.md` | 문서 | 7종만 명시 |
| `skills/.../templates/scaffold/src/types/index.ts` | scaffold 타입 | 7종 |
| `skills/.../templates/scaffold/src/components/ChangelogTab.tsx` | scaffold UI | 7종 |

### 라이브 영향 (A)

`ChangelogTab.tsx` L78 `const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.check_done` — 미지 타입은
`check_done`(초록 "체크 완료")로 fallback. 실데이터(`synapse-gitops` 등)에 `boxes_*` 항목이 있어,
"박스 추가/제거" 변경이력이 **현재 초록 "체크 완료"로 오표시**되고 필터(structure/checks)에도 안 잡힌다.
크래시는 없으나 라벨이 틀림.

## 3. 기술 제약 (확인됨)

- `package.json` `"type": "module"` → 스크립트는 Node ESM(`.mjs`), 런타임에 `.ts` import 불가.
- 스크립트는 `node`로 직접 실행 → `tsc`가 타입체크하지 않음. 따라서 스크립트가 `src/constants/changeTypes.js`를
  import해도 tsc 영향 없음(런타임 상대경로 해석만).
- `tsc -b`는 `tsconfig.app.json`(include `["src"]`)로 src를 타입체크. src 내 `.js` import를 허용하려면 `allowJs` 필요.
- `erasableSyntaxOnly: true` → enum/namespace 불가. 단일 소스는 **plain const 배열/객체**로 표현.
- 기존 테스트 하니스: `node --test scripts/parsers/__fixtures__/...`.

## 4. 결정사항

| 항목 | 결정 |
|---|---|
| 접근 | A — 공유 JS 모듈, `ChangeDetail.type`은 `string`으로 완화 |
| 단일 소스 위치 | `src/constants/changeTypes.js` (plain JS ESM) |
| 메타 포함 범위 | id, label, bg/text/border(Tailwind), category(필터) |
| 유효성 보증 | 검증기(canonical import) + 파서 방출 ⊆ canonical 테스트 |
| 스킬 scaffold | 동일 모듈 미러(UI·types용), 문서 갱신 |
| 파서 | 변경 없음(리터럴 방출 유지) |

## 5. 단일 소스 모듈 (신규 `src/constants/changeTypes.js`)

```js
// 단일 소스 of truth: Node 스크립트(validate-data.mjs)와 React UI(ChangelogTab.tsx)가 모두 import.
// id만 Node가 사용; label/bg/text/border/category는 UI 전용(Node는 무시).
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

## 6. 본 레포 변경 (C + A)

### 6.1 `tsconfig.app.json`
`compilerOptions`에 `"allowJs": true` 추가. (src의 `.js` import 타입체크 허용. `checkJs`는 켜지 않음.)

### 6.2 `scripts/validate-data.mjs`
인라인 `const CHANGE_TYPES = new Set([... 9종 ...])`을 제거하고 단일 소스에서 파생:
```js
import { CHANGE_TYPE_IDS } from '../src/constants/changeTypes.js'
const CHANGE_TYPE_SET = new Set(CHANGE_TYPE_IDS)
```
사용처 `CHANGE_TYPES.has(change.type)` → `CHANGE_TYPE_SET.has(change.type)`로 변경.
(검증기는 canonical을 import하므로 검증기↔canonical 드리프트 불가.)

### 6.3 `src/components/ChangelogTab.tsx`
- 하드코딩 `TYPE_CONFIG`(7종) 삭제 → `import { CHANGE_TYPE_META } from '../constants/changeTypes.js'`
- 렌더 시 `const cfg = CHANGE_TYPE_META[item.type] || CHANGE_TYPE_META.check_done` (fallback 유지)
- 필터 로직(현재 `['step_added','step_deleted','phase_added','phase_deleted'].includes(c.type)` 등 하드코딩)을
  `CHANGE_TYPE_META[c.type]?.category === 'structure'` 식으로 category 파생.
- 결과: `boxes_*`가 "박스 추가/제거"(sky, structure)로 올바르게 표시·필터됨.

### 6.4 `src/types/index.ts`
`ChangeDetail.type`을 7-리터럴 유니온에서 `string`으로 변경. (런타임 JSON은 untyped이며,
유효성은 검증기+테스트가 보증.)

### 6.5 `scripts/parse-workflow.mjs`
변경 없음 (리터럴 방출 유지).

## 7. 스킬 scaffold 변경 (B)

- 신규 `skills/project-dashboard/templates/scaffold/src/constants/changeTypes.js` — §5와 동일 내용
  (scaffold는 검증기/파서 미포함이므로 UI·types만 소비).
- `skills/.../templates/scaffold/src/components/ChangelogTab.tsx` — §6.3과 동일 패턴으로 교체.
- `skills/.../templates/scaffold/src/types/index.ts` — `ChangeDetail.type` → `string`.
- `skills/.../templates/scaffold/tsconfig.app.json` — `"allowJs": true` 추가.
- `skills/.../references/data-schema.md` — change type 설명을 "단일 소스 `src/constants/changeTypes.js` 참조"로
  바꾸고 9종(boxes_* 포함) 명시. L233 예시 표현도 보강.

주의: scaffold는 본 레포 CI가 빌드하지 않는 템플릿 → 검증은 본 레포와의 미러 정확성(내용 동일성)으로 확인.

## 8. 드리프트 방지 테스트 (신규 `scripts/parsers/__fixtures__/change-types.test.mjs`)

`node --test` 하니스 사용. `parse-workflow.mjs` 소스를 읽어 `type: '<id>'` 리터럴을 정규식으로 전부 추출하고,
각 id가 `CHANGE_TYPE_IDS`에 포함됨을 단언:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CHANGE_TYPE_IDS } from '../../../src/constants/changeTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const parserSrc = readFileSync(join(__dirname, '../../parse-workflow.mjs'), 'utf-8')

test('parser가 방출하는 change type는 모두 canonical에 존재', () => {
  const emitted = [...parserSrc.matchAll(/type:\s*'([a-z_]+)'/g)].map(m => m[1])
  assert.ok(emitted.length > 0, '방출 타입을 찾지 못함')
  const idSet = new Set(CHANGE_TYPE_IDS)
  for (const t of emitted) {
    assert.ok(idSet.has(t), `canonical에 없는 change type 방출: ${t}`)
  }
})
```
`package.json`의 `test` 스크립트가 단일 파일만 지정하므로, 본 테스트가 함께 실행되도록
`"test": "node --test scripts/parsers/__fixtures__/"` 로 디렉토리 지정으로 변경(기존 파서 테스트도 포함).

## 9. 검증 (완료 기준)

1. `npm run lint` → exit 0
2. `npm run test` → 기존 파서 테스트 + 신규 change-types 테스트 통과
3. `npm run validate:data` → exit 0 (canonical 기반 검증)
4. `npm run build` (tsc + vite) → 통과 (allowJs로 .js import OK)
5. dev 서버: ChangelogTab에서 `synapse-gitops`의 `boxes_*` 항목이 "박스 추가/제거"로 표시되고,
   "Step 추가/삭제"(structure) 필터에 포함됨을 육안 확인
6. 스킬 scaffold의 `changeTypes.js`/`ChangelogTab.tsx`/`types/index.ts`가 본 레포와 내용 일치

## 10. 범위 밖

- 파서가 방출 타입을 canonical에서 *읽어* 쓰도록 바꾸는 것(현재 인라인 리터럴 유지 — 테스트로 보증)
- `ChangeDetail.type` 리터럴 유니온 복원(접근 A에서 의도적으로 string)
- Notion/Linear 파서의 change type(현 프로젝트 미사용)
- 색/라벨 디자인 변경(기존 값 보존)

## 11. 변경/생성 파일 목록

| 파일 | 변경 |
|---|---|
| `src/constants/changeTypes.js` | 신규 — 단일 소스 |
| `tsconfig.app.json` | `allowJs: true` |
| `scripts/validate-data.mjs` | canonical에서 Set 파생 |
| `src/components/ChangelogTab.tsx` | CHANGE_TYPE_META/category 파생 |
| `src/types/index.ts` | `ChangeDetail.type` → string |
| `scripts/parsers/__fixtures__/change-types.test.mjs` | 신규 — 드리프트 방지 테스트 |
| `package.json` | `test` 스크립트 디렉토리 지정 |
| `skills/.../templates/scaffold/src/constants/changeTypes.js` | 신규 — 미러 |
| `skills/.../templates/scaffold/src/components/ChangelogTab.tsx` | 미러 |
| `skills/.../templates/scaffold/src/types/index.ts` | `type` → string |
| `skills/.../templates/scaffold/tsconfig.app.json` | `allowJs: true` |
| `skills/.../references/data-schema.md` | 단일 소스 참조 + 9종 |
