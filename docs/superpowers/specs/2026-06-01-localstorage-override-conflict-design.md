# 로컬 오버라이드 충돌 감지 & 갱신 설계

- **작성일:** 2026-06-01
- **상태:** 초안 (사용자 리뷰 대기)
- **대상 코드:** `workflow-dashboard` (React + Vite)
- **관련 메모:** sync-vs-deploy-pipeline, deferred-sync-issues

## 1. 요약

메인 대시보드의 데이터 소스인 `useData`의 `fetchRepoJson`이 `dashboard-data-<repo>` localStorage
오버라이드를 **무조건 우선**한다. 그 결과 Settings의 데이터 편집(DataEditor)에서 한 레포라도 편집/임포트하면
메인 대시보드·상세·차트가 영구히 로컬 버전으로 고정되어, cron+배포로 서버 데이터가 갱신돼도 가려진다.
메인 화면에는 오버라이드 상태 표시가 전혀 없다(Settings에만 노란 배너).

로컬 편집(오버라이드)은 의도된 기능이므로 **로컬 우선 동작은 유지**하되, **서버가 더 최신일 때(충돌)를 감지해
사용자에게 알리고 한 번의 클릭으로 해당 레포를 서버 최신본으로 갱신**할 수 있게 한다.

## 2. 배경 / 현재 동작

- 오버라이드 쓰기: `src/components/settings/DataEditor.tsx` — 체크 토글·Step/항목 추가·삭제 시
  `saveRepoData()`가 `dashboard-data-<repo>`에 저장. `recomputeTotals()`는 `updatedAt`을 변경하지 않음
  (→ 오버라이드의 `updatedAt`은 편집 당시 서버 기준점으로 보존됨).
- 오버라이드 읽기(문제 지점): `src/hooks/useData.ts` `fetchRepoJson()`이
  `loadLocalData(repo)`가 있으면 그것을 반환하고 서버 JSON을 fetch하지 않음.
- 기존 탈출구: `ImportExport.tsx`의 "원본 복원", `ForceSyncTab.tsx`의 "캐시 비우기" — 사용자가 알아야만 함.
- 오버라이드 키는 **실제 레포**(`config.repos`)만 대상. 가상 트랙 `team-lead`는 키가 없고,
  소스 레포(`synapse-gitops`, `synapse-shared`)의 오버라이드로 구성됨.

## 3. 결정사항

| 항목 | 결정 |
|---|---|
| 로컬 우선 | 유지 (오버라이드는 의도된 기능) |
| 충돌 정의 | `server.updatedAt > override.updatedAt` (ISO 8601 문자열 비교) |
| 충돌 시 동작 | 알림 + 한 번에 갱신 (로컬 기본 유지, 자동 폐기 안 함) |
| 알림 위치 | 메인 대시보드 전역 배너 + 트랙 카드 배지 |
| 표시 대상 | 충돌(`serverNewer`)만. 단순 "편집됨"은 제외(YAGNI) |
| 구조 | 접근 A — `useData`에서 양 레이어 해석 + 순수 함수 분리 |

## 4. 아키텍처

```
useData (서버 JSON 항상 fetch + localStorage 오버라이드)
  ├─ 렌더 데이터(data): effective = local ?? server   ← 기존과 동일(로컬 우선)
  └─ overrides: OverrideStatus[]  (config.repos별 computeOverrideStatus)
        ↓
Dashboard
  ├─ <OverrideBanner overrides onRefresh… />   ← serverNewer 있을 때만
  └─ <TrackCard staleOverride … />             ← 카드별 충돌 배지
        ↓ 갱신
  clearOverrides(repos[]) → localStorage 제거 + version bump → effect 재실행
        → effective가 서버로 폴백, 상태 재계산
```

## 5. 컴포넌트 / 파일 명세

### 5.1 `src/utils/overrideStatus.ts` (신규, 순수 로직)

```ts
import type { RepoData } from '../types'

export interface OverrideStatus {
  repo: string
  active: boolean
  serverNewer: boolean
  serverUpdatedAt: string
  overrideUpdatedAt: string
}

export function computeOverrideStatus(
  repo: string,
  override: RepoData | null,
  server: RepoData | null,
): OverrideStatus {
  const active = !!override
  const overrideUpdatedAt = override?.updatedAt ?? ''
  const serverUpdatedAt = server?.updatedAt ?? ''
  const serverNewer = active && !!serverUpdatedAt && serverUpdatedAt > overrideUpdatedAt
  return { repo, active, serverNewer, serverUpdatedAt, overrideUpdatedAt }
}
```

- 엣지: 서버 fetch 실패 → `server=null` → `serverUpdatedAt=''` → `serverNewer=false` (오프라인 오탐 없음).
- 엣지: 임포트로 `override.updatedAt`이 빈 문자열 → 서버에 타임스탬프 있으면 `serverNewer=true` (드러내는 쪽이 안전).

### 5.2 `src/hooks/useData.ts` (수정)

- `loadLocalData(repo)` 유지. 신규 `fetchServerJson(repo)`: localStorage를 건너뛰고 항상
  `fetch(${BASE_URL}data/${repo}.json)`.
- 기존 `fetchRepoJson`은 effective 계산용으로 유지하거나 `local ?? server`로 재구성하되, 추가로 서버 원본을 확보해
  `computeOverrideStatus` 입력으로 사용.
- `useData()`:
  - `config.repos`(실제 레포)별로 `{ local, server }`를 모아 `overrides: OverrideStatus[]` 구성.
  - `version` state 추가. `clearOverrides(repos: string[])`:
    각 repo에 대해 `localStorage.removeItem('dashboard-data-' + repo)` 후 `setVersion(v => v + 1)`.
  - effect 의존성에 `version` 추가 → 재실행 시 effective/overrides 재계산.
  - 반환 객체에 `overrides`, `clearOverrides` 추가. **기존 반환값(`data`, `rawByRepo`, `loading`,
    `error`, `overallPercent`, `totalChecks`, `doneChecks`)과 `rawByRepo`의 로컬 우선 의미는 변경하지 않음.**

### 5.3 `src/components/OverrideBanner.tsx` (신규)

```ts
interface Props {
  overrides: OverrideStatus[]
  onRefresh: (repos: string[]) => void
}
```

- `const stale = overrides.filter(o => o.serverNewer)` — `stale.length === 0`이면 `null` 반환(미표시).
- 표시: `bg-amber-50 border border-amber-200 rounded-md` 컨테이너.
  - 헤드라인: `⚠️ 로컬에서 편집한 {stale.length}개 레포에 서버 최신본이 있습니다.`
  - 각 stale 레포: 레포명 + `로컬 {overrideUpdatedAt} → 서버 {serverUpdatedAt}` + `[갱신]` 버튼(`onRefresh([repo])`).
  - 우측: `[전체 갱신]` 버튼(`onRefresh(stale.map(o => o.repo))`).
- 타임스탬프는 `YYYY-MM-DD HH:mm`로 축약 표기(로컬 포맷 헬퍼는 컴포넌트 내 간단 구현).

### 5.4 `src/components/TrackCard.tsx` (수정)

- props에 optional `staleOverride?: boolean` 추가.
- `staleOverride`가 true면 카드 우상단에 작은 amber 마커(예: `absolute top-1 right-1` 점/`▲`) 렌더.
  카드 컨테이너에 `relative` 클래스 추가. 클릭 동작은 기존 카드 네비게이션 유지(마커는 인지용, 별도 클릭 핸들러 없음).

### 5.5 `src/pages/Dashboard.tsx` (수정)

- `const { data, loading, overallPercent, overrides, clearOverrides } = useData()`.
- `const staleSet = new Set(overrides.filter(o => o.serverNewer).map(o => o.repo))`.
- 카드→실제 레포 매핑:
  - 통합 카드(트랙 2개 + 동일 owner, 기존 `trackEntries` 분기): 실제 레포 = `d.tracks.map(t => t.name)`.
  - 일반 카드: 실제 레포 = `[d.repo]`.
  - `staleOverride = underlyingRepos.some(r => staleSet.has(r))`를 `<TrackCard>`에 전달.
- `<Header>` 아래에 `<OverrideBanner overrides={overrides} onRefresh={clearOverrides} />` 추가.

## 6. 데이터 흐름 (충돌 발생 → 해소)

1. 사용자가 Settings에서 `synapse-frontend` 편집 → `dashboard-data-synapse-frontend` 저장(updatedAt = 편집 당시 서버 기준점 t0).
2. 이후 cron+배포로 서버 `synapse-frontend.json` updatedAt = t1(> t0) 갱신.
3. 메인 진입 → `useData`가 서버(t1) + 로컬(t0) 확보 → `computeOverrideStatus` → `serverNewer=true`.
4. 렌더는 여전히 로컬(t0) 데이터로 표시(로컬 우선) + 배너/카드 배지 노출.
5. 사용자가 `[갱신]`(또는 `[전체 갱신]`) → `clearOverrides(['synapse-frontend'])` → 키 제거 + version bump.
6. 재계산: 로컬 없음 → effective = 서버(t1), `serverNewer=false` → 배너/배지 사라짐.

## 7. 에러 / 엣지케이스

| 상황 | 처리 |
|---|---|
| 서버 fetch 실패(오프라인) | `server=null` → `serverNewer=false`, 배너 미표시(오탐 없음). 렌더는 로컬 유지 |
| 오버라이드만 있고 서버 없음(레포 신규) | `serverNewer=false`. 갱신 불필요 |
| 임포트로 updatedAt 빈 값 | 서버에 타임스탬프 있으면 `serverNewer=true`로 드러냄 |
| 통합(team-lead) 카드 | 소스 레포 중 하나라도 stale이면 배지; 갱신 시 소스 레포 일괄 clear |
| 갱신 직후 | version bump로 즉시 재계산, 추가 새로고침 불필요 |

## 8. 검증 (수동 체크리스트)

이 레포는 TS 단위 테스트 러너가 없고(기존 `npm test`는 파서 `.mjs` 픽스처 전용), 기존 스펙 관례가
수동 검증 체크리스트다. `computeOverrideStatus`는 순수·단순 로직이며 tsc 타입체크 + 아래 시나리오로 검증한다.

1. 오버라이드 없음 → 배너/배지 미표시
2. 한 레포 편집(updatedAt 유지) 후 메인 → 배너/배지 미표시(서버가 더 최신이 아니므로)
3. 편집 후 해당 `data/<repo>.json`의 updatedAt를 더 미래로 수동 변경(또는 sync) → 메인에 배너 + 해당 카드 배지
4. `[갱신]` → 해당 레포 배너 항목·카드 배지 사라짐, 데이터가 서버본으로 전환
5. 다중 충돌 → `[전체 갱신]`로 일괄 해소
6. 통합 카드(team-lead): 소스 레포 편집+서버갱신 → 배지 표시 → 갱신 시 해소
7. 오프라인(서버 fetch 실패) → 배너 미표시, 로컬 데이터 정상 렌더
8. `npm run lint` / `npm run build`(tsc) 통과

## 9. 범위 밖 (out of scope)

- 단순 "편집됨"(active이나 server 안 최신) 표시
- 서버가 최신일 때 자동 폐기(자동 치유) — 의도적으로 수동 갱신 선택
- 항목 단위 머지(로컬 편집과 서버 변경의 3-way merge)
- TS 단위 테스트 러너(vitest 등) 도입
- 브랜치 선택 동기화 동작(의도된 설계이므로 변경 없음)

## 10. 수정/생성 파일 목록

| 파일 | 변경 |
|---|---|
| `src/utils/overrideStatus.ts` | 신규 — `OverrideStatus` 타입 + `computeOverrideStatus` |
| `src/hooks/useData.ts` | 서버 항상 fetch, `overrides`/`clearOverrides`/`version` 추가 |
| `src/components/OverrideBanner.tsx` | 신규 — 전역 충돌 배너 |
| `src/components/TrackCard.tsx` | `staleOverride` prop + 배지 |
| `src/pages/Dashboard.tsx` | overrides 배선, 배너 렌더, 카드별 stale 전달 |
