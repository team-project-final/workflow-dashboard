# Workflow 세부 체크리스트 항목 표시 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 행 클릭 시 아코디언으로 세부 체크리스트 항목을 표시하여 각 Step의 구체적 할 일을 확인할 수 있게 한다.

**Architecture:** 파서가 체크리스트 텍스트를 items 배열로 저장 → JSON 재생성 → WorkflowColumn에서 아코디언 UI로 표시. 읽기 전용.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Node.js (파서)

---

### Task 1: 타입 정의 추가

**Files:**
- Modify: `src/types/index.ts:1-5`

- [ ] **Step 1: CheckItem 인터페이스 추가 및 Phase 수정**

`src/types/index.ts` 파일 상단에 `CheckItem` 인터페이스를 추가하고, `Phase`에 `items` 필드를 추가한다.

```ts
export interface CheckItem {
  text: string
  done: boolean
}

export interface Phase {
  name: string
  total: number
  done: number
  items: CheckItem[]
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 타입 에러 발생 (useData.ts의 emptyRepoData에서 items 누락). Task 2에서 수정.

- [ ] **Step 3: 커밋**

```bash
git add src/types/index.ts
git commit -m "feat: add CheckItem type and items field to Phase"
```

---

### Task 2: useData.ts 폴백 수정

**Files:**
- Modify: `src/hooks/useData.ts:38`

- [ ] **Step 1: emptyRepoData의 phase 생성에 items 추가**

`src/hooks/useData.ts`의 `emptyRepoData()` 함수에서 phase 객체에 `items: []`를 추가한다.

```ts
phases: PHASE_NAMES.map(name => ({ name, total: 0, done: 0, items: [] })),
```

기존 코드:
```ts
phases: PHASE_NAMES.map(name => ({ name, total: 0, done: 0 })),
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: PASS (에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/useData.ts
git commit -m "feat: add empty items array to fallback phase data"
```

---

### Task 3: 파서에 items 저장 추가

**Files:**
- Modify: `scripts/parse-workflow.mjs:36-42`

- [ ] **Step 1: parseWorkflowFile의 phases 생성에 items 추가**

`scripts/parse-workflow.mjs`에서 `phaseParts.forEach` 콜백 안의 `phases.push()`에 `items` 필드를 추가한다.

기존 코드 (36-42행):
```js
    phaseParts.forEach((pp, j) => {
      const checks = parseCheckboxes(pp)
      phases.push({
        name: phaseNames[j] || `Phase ${j + 1}`,
        total: checks.length,
        done: checks.filter(c => c.done).length,
      })
    })
```

변경 후:
```js
    phaseParts.forEach((pp, j) => {
      const checks = parseCheckboxes(pp)
      phases.push({
        name: phaseNames[j] || `Phase ${j + 1}`,
        total: checks.length,
        done: checks.filter(c => c.done).length,
        items: checks.map(c => ({ text: c.text, done: c.done })),
      })
    })
```

- [ ] **Step 2: 커밋**

```bash
git add scripts/parse-workflow.mjs
git commit -m "feat: store checklist item text in parsed workflow data"
```

---

### Task 4: JSON 데이터 재생성

**Files:**
- Modify: `data/synapse-platform-svc.json`
- Modify: `data/synapse-engagement-svc.json`
- Modify: `data/synapse-knowledge-svc.json`
- Modify: `data/synapse-learning-svc.json`
- Modify: `data/synapse-frontend.json`
- Modify: `data/synapse-shared.json`

이 태스크는 GitHub에서 documents 레포의 workflow 마크다운을 로컬로 다운로드한 후 파서를 실행하여 JSON을 재생성한다.

- [ ] **Step 1: documents 레포의 workflow 파일 다운로드**

documents 레포에서 `docs/project-management/` 디렉토리를 로컬에 임시로 클론하거나 다운로드한다.

```bash
git clone --depth 1 https://github.com/team-project-final/documents.git /tmp/documents
```

- [ ] **Step 2: 레포별 매핑에 따라 파서 실행**

각 레포에 해당하는 트랙을 확인하고 파서를 실행한다. `parse-workflow.mjs`는 `<docs-dir>` 안의 모든 WORKFLOW 파일을 트랙별로 그룹핑하므로, 레포-트랙 매핑에 맞게 실행한다.

현재 매핑:
| 레포 | 트랙 |
|------|------|
| synapse-platform-svc | platform |
| synapse-engagement-svc | engagement |
| synapse-knowledge-svc | knowledge-1, knowledge-2 |
| synapse-learning-svc | learning-card, learning-ai |
| synapse-frontend | frontend |
| synapse-shared | team-lead |

파서가 docs-dir 안의 모든 WORKFLOW 파일을 읽으므로, 레포별로 필요한 트랙의 WORKFLOW 파일만 있는 임시 디렉토리를 만들거나, 파서를 전체 실행 후 결과를 레포별로 분리해야 한다.

가장 간단한 방법: 전체 workflow 디렉토리로 파서를 실행하면 모든 트랙이 하나의 JSON에 들어가므로, 레포별로 분리하는 스크립트를 별도로 작성하거나, 기존 `parse-workflow.mjs`를 레포별로 6번 호출한다.

기존 파서는 `<docs-dir>` 안의 `workflow/` 폴더에서 모든 WORKFLOW 파일을 읽고 트랙 이름으로 그룹핑한다. 레포 이름은 인자로 받지만 실제로는 JSON의 `repo` 필드에만 사용된다. 따라서 레포별로 해당 트랙의 WORKFLOW 파일만 있는 디렉토리를 만들어야 한다.

```bash
DOCS=/tmp/documents/docs/project-management
PROJ_ROOT=$(pwd)

# 레포별 임시 디렉토리 생성 + 파서 실행
declare -A REPO_TRACKS
REPO_TRACKS[synapse-platform-svc]="platform"
REPO_TRACKS[synapse-engagement-svc]="engagement"
REPO_TRACKS[synapse-knowledge-svc]="knowledge-1 knowledge-2"
REPO_TRACKS[synapse-learning-svc]="learning-card learning-ai"
REPO_TRACKS[synapse-frontend]="frontend"
REPO_TRACKS[synapse-shared]="team-lead"

for REPO in "${!REPO_TRACKS[@]}"; do
  TMPDIR=$(mktemp -d)
  mkdir -p "$TMPDIR/workflow" "$TMPDIR/task"
  for TRACK in ${REPO_TRACKS[$REPO]}; do
    cp "$DOCS/workflow/WORKFLOW_${TRACK}_"*.md "$TMPDIR/workflow/" 2>/dev/null || true
    cp "$DOCS/task/TASK_${TRACK}.md" "$TMPDIR/task/" 2>/dev/null || true
  done
  node "$PROJ_ROOT/scripts/parse-workflow.mjs" "$TMPDIR" "$REPO" "$PROJ_ROOT/data/${REPO}.json"
  rm -rf "$TMPDIR"
done
```

- [ ] **Step 3: 재생성된 JSON에 items가 포함되었는지 확인**

```bash
node -e "const d=require('./data/synapse-platform-svc.json'); const p=d.tracks[0].weeks[0].steps[0].phases[0]; console.log(p.name, p.items)"
```

Expected: `TASK 시작 [ { text: 'Step Goal / Done When / Scope / Input 확인', done: false }, ... ]`

- [ ] **Step 4: 기존 prd/history/changelog 데이터 보존 확인**

파서가 기존 JSON을 읽어서 prd, history, changelog를 보존하는지 확인한다.

```bash
node -e "const d=require('./data/synapse-platform-svc.json'); console.log('prd:', d.prd.length, 'history:', d.history.length, 'changelog:', d.changelog.length)"
```

- [ ] **Step 5: 커밋**

```bash
git add data/
git commit -m "data: regenerate JSON with checklist item texts"
```

---

### Task 5: WorkflowColumn 아코디언 UI

**Files:**
- Modify: `src/components/WorkflowColumn.tsx`

- [ ] **Step 1: 아코디언 상태 및 토글 로직 추가**

`WorkflowColumn.tsx` 전체를 다음으로 교체한다.

```tsx
import { useState } from 'react'
import type { Step } from '../types'

interface Props {
  step: Step | null
}

export default function WorkflowColumn({ step }: Props) {
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setOpenPhases(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (!step) {
    return (
      <div className="p-3.5">
        <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
          WORKFLOW — 10단계
        </h3>
        <p className="text-xs text-stone-400">좌측에서 Step을 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="p-3.5">
      <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
        WORKFLOW — {step.name}
      </h3>
      <div className="text-[10px] text-stone-600 mb-2 px-2 py-1.5 bg-amber-light rounded">
        {step.doneChecks}/{step.totalChecks} 완료 ({step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0}%)
      </div>
      <div className="space-y-0.5">
        {step.phases.map((phase, i) => {
          const done = phase.done === phase.total && phase.total > 0
          const inProgress = phase.done > 0 && phase.done < phase.total
          const hasItems = phase.items && phase.items.length > 0
          const isOpen = openPhases.has(i)

          return (
            <div key={i}>
              <div
                onClick={() => hasItems && toggle(i)}
                className={`flex items-center gap-2 text-[11px] py-0.5 ${
                  hasItems ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1' : ''
                } ${
                  done ? 'text-success' : inProgress ? 'text-amber font-semibold' : 'text-stone-400'
                }`}
              >
                {hasItems && (
                  <span className="text-[9px] text-stone-400 w-3 text-center select-none">
                    {isOpen ? '▼' : '▶'}
                  </span>
                )}
                {!hasItems && <span className="w-3" />}
                <span className="text-sm">{done ? '✅' : inProgress ? '🔄' : '⬜'}</span>
                <span>{i + 1}. {phase.name}</span>
                <span className="ml-auto text-[9px] font-mono text-stone-400">
                  {phase.done}/{phase.total}
                </span>
              </div>
              {isOpen && hasItems && (
                <div className="ml-8 mt-0.5 mb-1 space-y-0.5">
                  {phase.items.map((item, j) => (
                    <div key={j} className={`flex items-start gap-1.5 text-[10px] ${
                      item.done ? 'text-success' : 'text-stone-500'
                    }`}>
                      <span className="mt-0.5 shrink-0">{item.done ? '✅' : '⬜'}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: dev 서버에서 확인**

Run: `npm run dev`

1. `http://localhost:5173/workflow-dashboard/#/detail/synapse-platform-svc` 접속
2. Step 1 "platform-svc 골격 생성" 클릭
3. Workflow 컬럼에서 "1. TASK 시작 0/3" 옆에 ▶ 화살표 표시 확인
4. ▶ 클릭 → 세부 체크리스트 3개 항목 펼쳐지는지 확인
5. ▼ 재클릭 → 접히는지 확인
6. Step 2 "OAuth 회원가입/로그인" 클릭 → 다른 체크리스트 항목 표시 확인
7. synapse-shared 레포 → team-lead 트랙에서 "인프라 아키텍처 설계" 등 다른 phase 이름의 세부 항목도 정상 표시 확인

- [ ] **Step 3: 커밋**

```bash
git add src/components/WorkflowColumn.tsx
git commit -m "feat: add accordion UI for workflow checklist items"
```

---

### Task 6: 전체 빌드 및 최종 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 최종 커밋 (필요 시)**

모든 변경이 커밋되었는지 확인:
```bash
git status
```
Expected: clean working tree
