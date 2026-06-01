# 동기화 배포 복구 및 검증 게이트 보강 설계

- **작성일:** 2026-06-01
- **상태:** 초안 (사용자 리뷰 대기)
- **대상 코드:** `workflow-dashboard` (React + Vite + GitHub Actions)
- **관련 문서:** [force sync 설계](2026-05-21-force-sync-design.md), [동기화 검증 및 강제 동기화 스킬 반영 설계](2026-05-22-sync-verification-and-force-sync-skill-design.md)

## 1. 요약

라이브 대시보드가 2026-05-29 이후 갱신되지 않는 "동기화 안됨" 증상의 근본 원인은
**파서와 검증기의 changelog change type 목록 드리프트**다.

`scripts/parse-workflow.mjs`는 changelog에 `boxes_added` / `boxes_removed` 타입을 생성하지만,
`scripts/validate-data.mjs`의 `CHANGE_TYPES` 화이트리스트에는 이 두 타입이 없다.
그 결과 `Build & Deploy` 워크플로의 `npm run validate:data` 스텝이 매번 exit 1로 실패하고,
`deploy` 단계에 도달하지 못해 GitHub Pages가 재배포되지 않는다.

본 설계는 (1) 검증기를 보완해 배포를 즉시 복구하고, (2) 검증 게이트를 `sync-data.yml`에도 추가해
잘못된 데이터가 애초에 `main`에 커밋되지 않도록 재발을 방지한다.

## 2. 근본 원인 (확정)

| | change types |
|---|---|
| 파서 생성 (`parse-workflow.mjs`) | `step_added`, `check_done`, `check_undone`, **`boxes_added`**, **`boxes_removed`** |
| 검증기 허용 (`validate-data.mjs` L71) | `step_added`, `step_deleted`, `step_modified`, `check_done`, `check_undone`, `phase_added`, `phase_deleted` |

`boxes_added` / `boxes_removed`가 검증기 허용 목록에 없다.

### 인과 사슬

```
parse-workflow.mjs → changelog에 boxes_added / boxes_removed 생성
  ↓
Sync Workflow Data (성공) → data/*.json 을 main 에 커밋·푸시
  ↓
Build & Deploy → npm run validate:data → "unknown changelog change type" → exit 1 (실패)
  ↓
deploy 단계 미도달 → GitHub Pages 미배포
  ↓
라이브 대시보드가 05-29(마지막 배포 성공 시점)에서 정지
```

### 관찰 증거

- `gh run list`: `Sync Workflow Data` = success, `Build & Deploy` = 전건 failure (14~23초 조기 실패)
- 실패 런 로그: `validate:data` 스텝에서
  `unknown changelog change type "boxes_removed"` / `"boxes_added"` 다수 출력 후 `exit code 1`
- remote `main`에는 06-01 데이터 커밋이 정상 누적됨 (데이터 생성은 정상, 배포만 차단)

## 3. 결정사항

| 항목 | 결정 |
|---|---|
| 수정 범위 | 최소 수정 + 가드레일 |
| 즉시 복구 | `validate-data.mjs`의 `CHANGE_TYPES`에 `boxes_added`, `boxes_removed` 추가 |
| 재발 방지 | `sync-data.yml` 커밋 직전에 `validate:data` 게이트 추가 (실패 시 커밋 중단) |
| 데이터 마이그레이션 | 불필요 (검증기가 타입을 허용하면 기존 데이터 그대로 통과) |
| 미사용 타입 정리 | 하지 않음 (`step_modified` 등 파서 미생성 타입은 무해) |
| 단일 소스화 리팩터 | 하지 않음 (별도 사이클) |
| 브랜치 휴리스틱 / localStorage 이슈 | 본 설계 범위 밖 (별도 후속 스펙) |

## 4. 변경 명세

### 4.1 `scripts/validate-data.mjs` — CHANGE_TYPES 보완

```js
const CHANGE_TYPES = new Set([
  'step_added',
  'step_deleted',
  'step_modified',
  'check_done',
  'check_undone',
  'phase_added',
  'phase_deleted',
  'boxes_added',    // 추가: 박스(체크 항목) 총개수 증가
  'boxes_removed',  // 추가: 박스(체크 항목) 총개수 감소
])
```

- 효과: `validate:data`가 현재 `main`의 데이터에 대해 통과 → `Build & Deploy` 복구.
- 푸시 시 `build.yml`의 `paths`에 `scripts/**`가 포함되어 자동으로 Build & Deploy가 트리거되고,
  검증 통과 후 deploy 단계가 실행되어 누적된 06-01 데이터가 Pages에 배포된다.

### 4.2 `.github/workflows/sync-data.yml` — 커밋 전 검증 게이트

`UPDATED` 배열에 커밋 후보가 있을 때, `git add` 전에 검증을 실행한다.

```bash
if [ ${#UPDATED[@]} -gt 0 ]; then
  # 커밋 전 데이터 검증 (잘못된 데이터가 main에 들어가지 않도록 차단)
  npm run validate:data

  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git add data/*.json
  ...
fi
```

- 워크플로 스텝은 `set -e`로 실행되므로 `validate:data`가 exit 1이면 잡 전체가 실패하고
  `git add`/`commit`/`push`에 도달하지 못한다 → 잘못된 데이터가 `main`에 커밋되지 않는다.
- 검증은 이제 "데이터 생성 측(sync)"에서 1차, "배포 측(build)"에서 2차로 이중 게이트가 된다.

## 5. 범위 밖 (out of scope)

- 검증기에만 있고 파서엔 없는 미사용 change type(`step_modified`, `step_deleted`, `phase_added`, `phase_deleted`) 정리
- change type 단일 소스화(파서·검증기 공유 모듈) 리팩터
- 브랜치 선택 휴리스틱으로 인한 서비스 간 브랜치/시점 불일치
- 클라이언트 `fetchRepoJson`의 localStorage 우선 로직(편집 사용자 화면 미갱신)
- `synapse-shared.json` team-lead W5 누락 경고(검증 실패가 아닌 warning이므로 비차단)

## 6. 검증 / 완료 기준

1. 로컬 `npm run validate:data` → `Data validation passed with N warning(s).` 출력 (exit 0)
2. `main` 푸시 후 `Build & Deploy` 런이 success
3. GitHub Pages 대시보드가 최신(06-01) 데이터 반영 확인
4. (가드레일) `sync-data.yml`의 변경 후, 다음 sync 런에서 `validate:data` 스텝이 커밋 전에 실행됨을 로그로 확인

## 7. 구현 순서

1. `git pull`로 remote `main`(06-01) 상태와 로컬 동기화
2. `scripts/validate-data.mjs` — `CHANGE_TYPES`에 두 타입 추가
3. 로컬 `npm run validate:data` 통과 확인
4. `.github/workflows/sync-data.yml` — 커밋 전 `validate:data` 게이트 추가
5. 커밋 후 `main` 푸시
6. `Build & Deploy` 런 success + Pages 최신화 확인
