# Team-Lead 통합 관리 및 데이터 파이프라인 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 김나경 데이터 파이프라인을 복구하고, 김민구의 synapse-shared + synapse-gitops를 하나의 "team-lead" 가상 엔트리로 통합하여 메인 대시보드에서 통합 %, 상세 페이지에서 탭 분리 표시

**Architecture:** 데이터 레이어(useData.ts)에서 synapse-gitops.json + synapse-shared.json을 fetch하여 가상 RepoData로 병합. Detail 페이지는 기존 멀티트랙 탭 UI를 재활용. PRD는 트랙별 분리를 위해 RepoData에 prdPerTrack 필드 추가.

**Tech Stack:** React 19, TypeScript, Vite, Chart.js, Node.js scripts (parse-workflow.mjs, parse-prd.mjs)

---

### Task 1: synapse-shared.json 복원 (데이터 파싱)

**Files:**
- Modify: `scripts/parse-prd.mjs:22-29` (FR prefix 추가)
- Modify: `scripts/parse-workflow.mjs:86-88` (trackAliasMap 확인)
- Create: `data/synapse-shared.json` (파싱 결과)

- [ ] **Step 1: parse-prd.mjs에 synapse-shared FR 접두사 추가**

`scripts/parse-prd.mjs` 22-29행의 `REPO_FR_PREFIXES`에 synapse-shared 항목 추가:

```javascript
const REPO_FR_PREFIXES = {
  'synapse-platform-svc':    ['FR-PL'],
  'synapse-engagement-svc':  ['FR-EG'],
  'synapse-knowledge-svc':   ['FR-KN', 'FR-K2'],
  'synapse-learning-svc':    ['FR-LC', 'FR-LA'],
  'synapse-frontend':        ['FR-FE'],
  'synapse-gitops':          ['FR-TL'],
  'synapse-shared':          ['FR-GO', 'FR-ALL'],
}
```

참고: synapse-shared의 PRD에는 `FR-GO` (GitOps 관련) + `FR-ALL` (공통) 항목이 포함됨. 기존 synapse-gitops도 `FR-TL`을 사용. synapse-shared 레포의 PRD 파일 내부 FR 접두사를 먼저 확인:

```bash
grep -oP 'FR-[A-Z0-9]+' ../synapse-shared/docs/project-management/prd/PRD_W1.md | sort -u
```

결과에 맞게 접두사를 조정할 것.

- [ ] **Step 2: parse-workflow.mjs trackAliasMap 확인**

`scripts/parse-workflow.mjs` 86-88행 확인. synapse-shared의 WORKFLOW 파일명이 `WORKFLOW_team-lead_W1.md`이므로 rawTrackName은 `team-lead`가 됨. trackAliasMap에 별도 매핑 불필요 — `team-lead`가 그대로 사용됨.

현재 상태:
```javascript
const trackAliasMap = {
  'gitops': 'team-lead',
}
```

synapse-shared는 파일명이 이미 `team-lead`이므로 변경 불필요.

- [ ] **Step 3: synapse-shared 데이터 파싱 실행**

```bash
cd /c/workspace/team-project-manager/team-project-final/workflow-dashboard
node scripts/parse-workflow.mjs \
  ../synapse-shared/docs/project-management \
  synapse-shared \
  data/synapse-shared.json
node scripts/parse-prd.mjs \
  ../synapse-shared/docs/project-management \
  data/synapse-shared.json
```

Expected: `data/synapse-shared.json` 생성됨, tracks에 `team-lead` 트랙, prd에 W1~W5 항목 포함

- [ ] **Step 4: 파싱 결과 검증**

```bash
node -e "const d=require('./data/synapse-shared.json'); console.log('repo:', d.repo); console.log('tracks:', d.tracks.map(t=>t.name)); console.log('prd weeks:', d.prd.map(p=>p.week)); d.tracks.forEach(t => { const tc=t.weeks.reduce((s,w)=>s+w.totalChecks,0); const dc=t.weeks.reduce((s,w)=>s+w.doneChecks,0); console.log(t.name, dc+'/'+tc) })"
```

Expected: `repo: synapse-shared`, tracks: `['team-lead']`, prd weeks 포함

- [ ] **Step 5: 커밋**

```bash
git add data/synapse-shared.json scripts/parse-prd.mjs
git commit -m "data: restore synapse-shared.json and add FR prefix mapping"
```

---

### Task 2: synapse-learning-svc.json 재파싱 (김나경 데이터 최신화)

**Files:**
- Modify: `data/synapse-learning-svc.json` (재파싱)

참고: synapse-learning-svc 레포가 로컬 워크스페이스에 없음. 이 태스크는 로컬에 레포가 클론되어 있을 때만 실행 가능. 없으면 건너뛰고 Task 7(CI 워크플로우)로 자동화에 의존.

- [ ] **Step 1: synapse-learning-svc 레포 존재 확인**

```bash
ls /c/workspace/team-project-manager/team-project-final/synapse-learning-svc/docs/project-management/workflow/ 2>/dev/null || echo "REPO NOT FOUND - skip to Task 7"
```

- [ ] **Step 2: (레포 존재 시) 파싱 실행**

```bash
cd /c/workspace/team-project-manager/team-project-final/workflow-dashboard
node scripts/parse-workflow.mjs \
  ../synapse-learning-svc/docs/project-management \
  synapse-learning-svc \
  data/synapse-learning-svc.json
node scripts/parse-prd.mjs \
  ../synapse-learning-svc/docs/project-management \
  data/synapse-learning-svc.json
```

- [ ] **Step 3: (레포 존재 시) 커밋**

```bash
git add data/synapse-learning-svc.json
git commit -m "data: re-parse synapse-learning-svc with latest workflow data"
```

---

### Task 3: RepoData 타입에 prdPerTrack 추가

**Files:**
- Modify: `src/types/index.ts:69-76`

- [ ] **Step 1: RepoData 인터페이스에 prdPerTrack 필드 추가**

`src/types/index.ts` 69-76행의 `RepoData` 인터페이스를 수정:

```typescript
export interface RepoData {
  repo: string
  updatedAt: string
  tracks: Track[]
  prd: PrdWeek[]
  prdPerTrack?: PrdWeek[][]
  history: HistoryEntry[]
  changelog: ChangelogEntry[]
}
```

`prdPerTrack`는 optional — team-lead 가상 엔트리에서만 사용. `prdPerTrack[0]`은 첫 번째 트랙(synapse-gitops)의 PRD, `prdPerTrack[1]`은 두 번째 트랙(synapse-shared)의 PRD.

- [ ] **Step 2: 커밋**

```bash
git add src/types/index.ts
git commit -m "feat: add prdPerTrack field to RepoData for multi-repo track support"
```

---

### Task 4: useData.ts — team-lead 가상 엔트리 병합 로직

**Files:**
- Modify: `src/hooks/useData.ts:4-11` (DEFAULT_TRACKS)
- Modify: `src/hooks/useData.ts:94-125` (useData 훅)
- Modify: `src/hooks/useData.ts:127-148` (useRepoData 훅)

- [ ] **Step 1: DEFAULT_TRACKS에서 synapse-gitops 제거, TEAM_LEAD_CONFIG 추가**

`src/hooks/useData.ts` 4-13행을 다음으로 교체:

```typescript
const DEFAULT_TRACKS: { repo: string; tracks: { name: string; owner: string }[] }[] = [
  { repo: 'synapse-platform-svc', tracks: [{ name: 'platform', owner: '김해준' }] },
  { repo: 'synapse-engagement-svc', tracks: [{ name: 'engagement', owner: '한승완' }] },
  { repo: 'synapse-knowledge-svc', tracks: [{ name: 'knowledge-1', owner: '김현지' }, { name: 'knowledge-2', owner: '박은서' }] },
  { repo: 'synapse-learning-svc', tracks: [{ name: 'learning-card', owner: '조유지' }, { name: 'learning-ai', owner: '김나경' }] },
  { repo: 'synapse-frontend', tracks: [{ name: 'frontend', owner: '전원' }] },
]

const TEAM_LEAD_CONFIG = {
  virtualRepo: 'team-lead',
  sources: ['synapse-gitops', 'synapse-shared'] as const,
  owner: '김민구',
}

const REPOS = DEFAULT_TRACKS.map(d => d.repo)
```

- [ ] **Step 2: mergeTeamLeadData 헬퍼 함수 추가**

`src/hooks/useData.ts`의 `normalizeRepoData` 함수 뒤(92행 이후)에 추가:

```typescript
function mergeTeamLeadData(
  gitopsRaw: RepoData | null,
  sharedRaw: RepoData | null,
): RepoData {
  const gitopsDef = { repo: 'synapse-gitops', tracks: [{ name: 'team-lead', owner: '김민구' }] }
  const sharedDef = { repo: 'synapse-shared', tracks: [{ name: 'team-lead', owner: '김민구' }] }

  const gitopsData = normalizeRepoData(gitopsRaw, gitopsDef)
  const sharedData = normalizeRepoData(sharedRaw, sharedDef)

  const gitopsTrack = gitopsData.tracks[0]
  const sharedTrack = sharedData.tracks[0]

  const tracks: Track[] = [
    { name: 'synapse-gitops', owner: '김민구', weeks: gitopsTrack.weeks },
    { name: 'synapse-shared', owner: '김민구', weeks: sharedTrack.weeks },
  ]

  const allHistory = [...gitopsData.history, ...sharedData.history]
    .sort((a, b) => a.date.localeCompare(b.date))

  // Merge history by date: sum totalChecks/doneChecks from both repos per date
  const historyMap = new Map<string, { totalChecks: number; doneChecks: number }>()
  for (const h of allHistory) {
    const existing = historyMap.get(h.date)
    if (existing) {
      existing.totalChecks += h.totalChecks
      existing.doneChecks += h.doneChecks
    } else {
      historyMap.set(h.date, { totalChecks: h.totalChecks, doneChecks: h.doneChecks })
    }
  }
  const mergedHistory = [...historyMap].map(([date, v]) => ({ date, ...v }))

  const mergedChangelog = [...gitopsData.changelog, ...sharedData.changelog]
    .sort((a, b) => b.date.localeCompare(a.date))

  // Combined PRD (for overall display) + per-track PRD
  const combinedPrd: PrdWeek[] = WEEKS_META.map(wm => {
    const gitopsItems = gitopsData.prd.find(p => p.week === wm.week)?.items || []
    const sharedItems = sharedData.prd.find(p => p.week === wm.week)?.items || []
    return { week: wm.week, items: [...gitopsItems, ...sharedItems] }
  })

  return {
    repo: 'team-lead',
    updatedAt: gitopsData.updatedAt > sharedData.updatedAt ? gitopsData.updatedAt : sharedData.updatedAt,
    tracks,
    prd: combinedPrd,
    prdPerTrack: [gitopsData.prd, sharedData.prd],
    history: mergedHistory,
    changelog: mergedChangelog,
  }
}
```

- [ ] **Step 3: useData() 훅 수정 — team-lead 데이터 fetch 및 병합**

`src/hooks/useData.ts`의 `useData` 함수(기존 94-125행)를 다음으로 교체:

```typescript
export function useData() {
  const [data, setData] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const allFetches = [
      ...REPOS.map(repo =>
        fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ),
      ...TEAM_LEAD_CONFIG.sources.map(repo =>
        fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ),
    ]

    Promise.all(allFetches).then(results => {
      const repoResults = results.slice(0, REPOS.length)
      const [gitopsResult, sharedResult] = results.slice(REPOS.length)

      const merged = DEFAULT_TRACKS.map((def, i) =>
        normalizeRepoData(repoResults[i] as RepoData | null, def)
      )

      const teamLeadData = mergeTeamLeadData(
        gitopsResult as RepoData | null,
        sharedResult as RepoData | null,
      )

      setData([...merged, teamLeadData])
      setLoading(false)
    }).catch(err => {
      setError(err.message)
      setLoading(false)
    })
  }, [])

  const totalChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0), 0)
  const doneChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0), 0)
  const overallPercent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  return { data, loading, error, overallPercent, totalChecks, doneChecks }
}
```

- [ ] **Step 4: useRepoData() 훅 수정 — team-lead 분기**

`src/hooks/useData.ts`의 `useRepoData` 함수(기존 127-148행)를 다음으로 교체:

```typescript
export function useRepoData(repo: string) {
  const def = DEFAULT_TRACKS.find(d => d.repo === repo)
  const isTeamLead = repo === 'team-lead'
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!def && !isTeamLead) {
      setLoading(false)
      return
    }

    if (isTeamLead) {
      Promise.all(
        TEAM_LEAD_CONFIG.sources.map(r =>
          fetch(`${import.meta.env.BASE_URL}data/${r}.json`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        )
      ).then(([gitopsResult, sharedResult]) => {
        setData(mergeTeamLeadData(
          gitopsResult as RepoData | null,
          sharedResult as RepoData | null,
        ))
        setLoading(false)
      }).catch(() => {
        setData(mergeTeamLeadData(null, null))
        setLoading(false)
      })
      return
    }

    fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(normalizeRepoData(d, def!))
        setLoading(false)
      })
      .catch(() => {
        setData(emptyRepoData(def!.repo, def!.tracks))
        setLoading(false)
      })
  }, [repo, def, isTeamLead])

  return (def || isTeamLead) ? { data, loading } : { data: null, loading: false }
}
```

- [ ] **Step 5: import 문에 Track, PrdWeek 추가 확인**

`src/hooks/useData.ts` 2행의 import에 `Track`이 포함되어 있는지 확인. 현재:

```typescript
import type { PrdWeek, RepoData, Track, Week } from '../types'
```

`Track`과 `PrdWeek`가 이미 포함되어 있으므로 변경 불필요.

- [ ] **Step 6: 빌드 확인**

```bash
cd /c/workspace/team-project-manager/team-project-final/workflow-dashboard
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add src/hooks/useData.ts
git commit -m "feat: merge synapse-gitops + synapse-shared into virtual team-lead entry"
```

---

### Task 5: Detail.tsx — PRD 트랙별 분리

**Files:**
- Modify: `src/pages/Detail.tsx:32,78`

- [ ] **Step 1: PRD 선택 로직 수정**

`src/pages/Detail.tsx` 32행을 수정. 기존:

```typescript
const prdWeek = data.prd.find(p => p.week === selectedWeek)
```

다음으로 변경:

```typescript
const activePrd = data.prdPerTrack ? data.prdPerTrack[selectedTrackIdx] : data.prd
const prdWeek = activePrd?.find(p => p.week === selectedWeek)
```

`prdPerTrack`가 있으면 (team-lead 가상 엔트리) 선택된 트랙의 PRD를, 없으면 (일반 레포) 기존 prd를 사용.

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/pages/Detail.tsx
git commit -m "feat: show per-track PRD in detail page for team-lead virtual entry"
```

---

### Task 6: validate-data.mjs — synapse-shared 기대값 추가

**Files:**
- Modify: `scripts/validate-data.mjs:6-13`

- [ ] **Step 1: EXPECTED_REPOS에 synapse-shared 추가**

`scripts/validate-data.mjs` 6-13행을 수정:

```javascript
const EXPECTED_REPOS = [
  { repo: 'synapse-platform-svc', tracks: ['platform'] },
  { repo: 'synapse-engagement-svc', tracks: ['engagement'] },
  { repo: 'synapse-knowledge-svc', tracks: ['knowledge-1', 'knowledge-2'] },
  { repo: 'synapse-learning-svc', tracks: ['learning-card', 'learning-ai'] },
  { repo: 'synapse-frontend', tracks: ['frontend'] },
  { repo: 'synapse-gitops', tracks: ['team-lead'] },
  { repo: 'synapse-shared', tracks: ['team-lead'] },
]
```

- [ ] **Step 2: 데이터 검증 실행**

```bash
cd /c/workspace/team-project-manager/team-project-final/workflow-dashboard
node scripts/validate-data.mjs
```

Expected: `Data validation passed` (또는 synapse-learning-svc 관련 warning만)

- [ ] **Step 3: 커밋**

```bash
git add scripts/validate-data.mjs
git commit -m "chore: add synapse-shared to data validation expected repos"
```

---

### Task 7: TimelineChart — synapse-gitops/synapse-shared 트랙 색상 추가

**Files:**
- Modify: `src/components/TimelineChart.tsx:11-20`

- [ ] **Step 1: TRACK_COLORS에 새 트랙명 추가**

`src/components/TimelineChart.tsx` 11-20행을 수정. 기존 `team-lead` 색상을 synapse-gitops에 유지하고, synapse-shared에 새 색상 추가:

```typescript
const TRACK_COLORS: Record<string, string> = {
  platform: '#D97706',
  engagement: '#0D9488',
  'knowledge-1': '#78716C',
  'knowledge-2': '#A8A29E',
  'learning-card': '#0EA5E9',
  'learning-ai': '#8B5CF6',
  frontend: '#EC4899',
  'synapse-gitops': '#16A34A',
  'synapse-shared': '#22D3EE',
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/TimelineChart.tsx
git commit -m "feat: add track colors for synapse-gitops and synapse-shared"
```

---

### Task 8: synapse-learning-svc CI 워크플로우 생성

**Files:**
- Create: `../synapse-learning-svc/.github/workflows/parse-workflow.yml` (synapse-learning-svc 레포 내)

참고: 이 파일은 workflow-dashboard 레포가 아닌 synapse-learning-svc 레포에 생성해야 함. synapse-learning-svc가 로컬에 없으면 GitHub에서 직접 추가하거나, 레포를 클론 후 작업.

- [ ] **Step 1: 워크플로우 파일 생성**

synapse-learning-svc 레포에 `.github/workflows/parse-workflow.yml` 생성:

```yaml
name: Parse Workflow → Dashboard

on:
  push:
    paths:
      - 'docs/project-management/workflow/**'
      - 'docs/project-management/task/**'
      - 'docs/project-management/prd/**'

jobs:
  parse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/checkout@v4
        with:
          repository: team-project-final/workflow-dashboard
          token: ${{ secrets.DASHBOARD_TOKEN }}
          path: _dashboard

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run parser
        run: |
          REPO_NAME="${{ github.event.repository.name }}"
          node _dashboard/scripts/parse-workflow.mjs \
            docs/project-management \
            "$REPO_NAME" \
            "_dashboard/data/${REPO_NAME}.json"
          node _dashboard/scripts/parse-prd.mjs \
            docs/project-management \
            "_dashboard/data/${REPO_NAME}.json"

      - name: Push to dashboard (with retry)
        working-directory: _dashboard
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          if git diff --cached --quiet; then
            echo "No changes"
            exit 0
          fi
          BRANCH="${{ github.ref_name }}"
          git commit -m "data: update ${{ github.event.repository.name }} (${BRANCH}) from ${{ github.sha }}"
          for i in 1 2 3; do
            git pull --rebase origin main && git push && break
            echo "Retry $i..."
            sleep 5
          done
```

- [ ] **Step 2: synapse-learning-svc 레포에 DASHBOARD_TOKEN 시크릿 확인**

synapse-learning-svc 레포의 GitHub Settings > Secrets에 `DASHBOARD_TOKEN`이 설정되어 있는지 확인. 없으면 synapse-gitops와 동일한 PAT를 추가.

- [ ] **Step 3: 커밋 (synapse-learning-svc 레포에서)**

```bash
cd /path/to/synapse-learning-svc
git add .github/workflows/parse-workflow.yml
git commit -m "ci: add parse-workflow pipeline for dashboard data sync"
git push
```

---

### Task 9: 통합 테스트 — 로컬 dev 서버 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: dev 서버 실행**

```bash
cd /c/workspace/team-project-manager/team-project-final/workflow-dashboard
npm run dev
```

- [ ] **Step 2: 메인 대시보드 확인**

브라우저에서 `http://localhost:5173` 접속하여 확인:
- [ ] team-lead 카드가 1개로 표시되는지 (synapse-gitops + synapse-shared 통합 %)
- [ ] 다른 트랙 카드들이 정상 표시되는지
- [ ] 전체 overallPercent가 정상 계산되는지

- [ ] **Step 3: team-lead 상세 페이지 확인**

team-lead 카드 클릭하여 `/detail/team-lead`로 이동:
- [ ] 헤더에 `team-lead · 김민구`와 통합 % 표시
- [ ] 트랙 탭 2개 표시: `synapse-gitops (김민구)` | `synapse-shared (김민구)`
- [ ] synapse-gitops 탭: PRD/TASK/WORKFLOW 정상 표시
- [ ] synapse-shared 탭: PRD/TASK/WORKFLOW 정상 표시 (탭 전환 시 PRD도 변경됨)
- [ ] 변경 이력 탭: 두 레포 changelog 병합 표시

- [ ] **Step 4: 기존 페이지 회귀 테스트**

- [ ] synapse-knowledge-svc 상세: 2개 트랙 탭 정상 동작
- [ ] synapse-learning-svc 상세: 2개 트랙 탭 정상 동작
- [ ] 단일 트랙 레포 상세: 트랙 탭 미표시

- [ ] **Step 5: ProgressTable, TimelineChart 확인**

- [ ] ProgressTable에 team-lead 행이 synapse-gitops / synapse-shared로 분리 표시
- [ ] TimelineChart에 synapse-gitops (초록), synapse-shared (하늘) 라인 표시

- [ ] **Step 6: 데이터 검증**

```bash
node scripts/validate-data.mjs
```

Expected: `Data validation passed`

- [ ] **Step 7: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 빌드 완료

- [ ] **Step 8: 최종 커밋 (필요 시 누락된 변경사항)**

남은 변경사항이 있으면 커밋:

```bash
git add -A
git status
# 변경사항 확인 후
git commit -m "chore: final adjustments for team-lead integration"
```
