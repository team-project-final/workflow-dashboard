# Team-Lead 통합 관리 및 데이터 파이프라인 수정

> 2026-05-18 | workflow-dashboard

## 요약

두 가지 문제를 해결한다:
1. **김나경 데이터 미반영**: synapse-learning-svc에 parse-workflow CI가 없어서 dashboard 데이터가 05-13 이후 갱신되지 않음
2. **김민구 멀티레포 통합**: synapse-shared + synapse-gitops를 하나의 "team-lead" 엔트리로 묶어 메인 대시보드에서 통합 %, 상세 페이지에서 탭 분리

---

## 1. 김나경 데이터 파이프라인 수정

### 원인
- `synapse-learning-svc` 레포에 `.github/workflows/parse-workflow.yml`이 없음
- synapse-gitops, synapse-frontend 등은 이 워크플로우가 있어서 WORKFLOW/PRD 변경 시 자동으로 dashboard 데이터 갱신됨
- synapse-learning-svc는 초기 파싱(05-13) 이후 자동 갱신이 되지 않아 김나경의 learning-ai 트랙이 0%로 멈춤

### 해결

#### 1-1. synapse-learning-svc에 parse-workflow.yml 추가
- `synapse-gitops/.github/workflows/parse-workflow.yml`을 템플릿으로 사용
- repo명을 `synapse-learning-svc`로 변경
- 트리거 경로: `docs/project-management/workflow/**`, `docs/project-management/task/**`, `docs/project-management/prd/**`

#### 1-2. 즉시 수동 파싱
- workflow-dashboard 로컬에서 parse-workflow.mjs + parse-prd.mjs 실행
- `data/synapse-learning-svc.json` 최신화하여 커밋

### 영향 범위
- synapse-learning-svc 레포: 신규 워크플로우 파일 1개 추가
- workflow-dashboard: synapse-learning-svc.json 데이터 갱신

---

## 2. 김민구 team-lead 통합 관리

### 현재 상태
- `synapse-shared.json`은 커밋 b15cfb9에서 삭제됨
- `synapse-gitops.json`만 존재하며 team-lead 트랙 1개로 등록
- synapse-shared 레포의 WORKFLOW(W1~W4) + PRD(W1~W5) 마크다운은 존재

### 목표 구조

```
메인 대시보드
├─ ... (다른 트랙 카드들)
├─ [team-lead 카드] ← synapse-gitops + synapse-shared 통합 %
│   클릭 → /detail/team-lead

상세 페이지 (/detail/team-lead)
├─ Header: "team-lead · 김민구" + 통합 %
├─ 탭: "상세 (PRD/TASK/WORKFLOW)" | "변경 이력"
├─ 트랙 탭: [synapse-gitops] [synapse-shared]  ← 탭 전환
├─ Week 탭: W1 ~ W5
└─ 3열 그리드: PRD | TASK | WORKFLOW (선택된 트랙/주차 기준)
```

### 데이터 레이어 변경

#### 2-1. synapse-shared.json 복원
- synapse-shared 레포의 마크다운을 parse-workflow.mjs / parse-prd.mjs로 파싱
- `data/synapse-shared.json` 생성
- 트랙명은 마크다운 원본의 트랙명 유지 (team-lead)

#### 2-2. useData.ts 변경

**DEFAULT_TRACKS 수정:**
```typescript
// 기존 synapse-gitops 항목 제거
// 새로운 team-lead 가상 엔트리 추가
const TEAM_LEAD_CONFIG = {
  virtualRepo: 'team-lead',
  sources: ['synapse-gitops', 'synapse-shared'],
  owner: '김민구',
}
```

**useData() 훅:**
- 기존 5개 레포 (platform, engagement, knowledge, learning, frontend) + synapse-gitops + synapse-shared = 7개 JSON fetch
- synapse-gitops + synapse-shared 데이터를 하나의 가상 RepoData로 병합:
  - `repo: 'team-lead'`
  - `tracks`: 2개 (name: 'synapse-gitops', name: 'synapse-shared') — 각각 원본 레포의 트랙 데이터
  - `prd`: 트랙별로 분리 보존 (Detail에서 탭 전환 시 해당 트랙의 PRD만 표시)
  - `history`: 두 레포 히스토리 병합, 날짜순 정렬
  - `changelog`: 두 레포 체인지로그 병합, 레포 출처 태그 포함
- 통합 % = (gitops doneChecks + shared doneChecks) / (gitops totalChecks + shared totalChecks)

**useRepoData() 훅:**
- `repo === 'team-lead'` 분기 추가
- synapse-gitops.json + synapse-shared.json 둘 다 fetch 후 병합 로직 적용

#### 2-3. TrackCard 라우팅
- team-lead 가상 엔트리의 TrackCard 클릭 시 `/detail/team-lead`로 이동
- 기존 `navigate(/detail/${repoData.repo})` 로직이 `repo: 'team-lead'`를 그대로 사용하므로 자연스럽게 동작

### Detail 페이지 변경

#### 2-4. 멀티트랙 탭 활용
- team-lead의 tracks가 2개이므로 기존 `hasMultipleTracks` 로직으로 탭 자동 표시
- 탭 라벨: `synapse-gitops (김민구)` | `synapse-shared (김민구)`

#### 2-5. PRD 트랙별 분리
- 현재 PRD는 RepoData 레벨에 1개이지만, team-lead는 탭별로 다른 PRD를 보여줘야 함
- 방법: 병합 시 각 트랙의 원본 RepoData에서 prd를 보존하고, selectedTrackIdx로 해당 트랙의 prd를 선택
- Detail.tsx에서 selectedTrackIdx에 따라 해당 트랙의 PRD를 PrdColumn에 전달
- 구현: RepoData에 `prdPerTrack: PrdWeek[][]` 필드 추가 (team-lead 전용), 일반 레포는 undefined

#### 2-6. 변경 이력 병합
- 두 레포 changelog를 하나로 병합
- 각 항목에 레포 출처 표시 (예: `[synapse-gitops]`, `[synapse-shared]`)

### 스크립트 변경

#### 2-7. parse-workflow.mjs
- synapse-shared 파싱 시 trackAliasMap에서 `shared → team-lead` 매핑 유지 (기존과 동일)
- 출력 파일: `data/synapse-shared.json` (별도 파일로 유지, 프론트엔드에서 병합)

#### 2-8. validate-data.mjs
- synapse-shared 레포 + 트랙 기대값 추가

---

## 수정 대상 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/hooks/useData.ts` | TEAM_LEAD_CONFIG 추가, useData/useRepoData 병합 로직 |
| `src/pages/Dashboard.tsx` | 변경 없음 (useData가 이미 통합 데이터 반환) |
| `src/pages/Detail.tsx` | PRD 트랙별 분리 로직, team-lead 헤더 표시 |
| `src/components/TrackCard.tsx` | 변경 없음 (repo='team-lead'로 자연 동작) |
| `data/synapse-shared.json` | 신규 생성 (파싱 복원) |
| `data/synapse-learning-svc.json` | 재파싱으로 최신화 |
| `scripts/parse-workflow.mjs` | synapse-shared trackAlias 확인/유지 |
| `scripts/validate-data.mjs` | synapse-shared 기대값 추가 |
| `synapse-learning-svc/.github/workflows/parse-workflow.yml` | 신규 생성 |

---

## 변경하지 않는 것

- 다른 팀원의 트랙 카드/데이터에는 영향 없음
- ProgressTable, TimelineChart 등 기존 컴포넌트는 useData가 반환하는 데이터 구조가 동일하므로 수정 불필요
- 기존 라우팅 `/detail/:repo`는 유지, team-lead만 가상 repo로 처리
