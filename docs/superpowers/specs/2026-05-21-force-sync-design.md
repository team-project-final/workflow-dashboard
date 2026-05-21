# Force Sync 기능 설계

- **상태**: 초안 (사용자 리뷰 대기)
- **작성일**: 2026-05-21
- **대상 코드**: `workflow-dashboard` (React 19 + Vite + GitHub Actions)

## 1. 요약

대시보드의 데이터 동기화는 매일 KST 09/14/19시 cron으로 실행되며, 각 레포의 `data/<repo>.json`을 md5 비교 후 변경분만 커밋한다. 이 설계는 **운영자가 cron을 기다리지 않고 임의 시점에 1~N개 레포를 강제로 다시 동기화**할 수 있는 진입점을 추가한다.

진입점은 두 곳이다.

1. **GitHub Actions `workflow_dispatch` UI** — 기존 `sync-data.yml`에 `repos`(콤마 구분) + `force`(boolean) input을 추가.
2. **대시보드 Settings의 새 탭 "강제 동기화"** — PAT를 등록한 사용자가 캐시(이미 sync된 데이터)와 실시간(현재 레포 상태)을 비교한 뒤 다중 선택해 트리거하고, 진행 상황을 폴링으로 확인.

"강제"의 의미는 **md5 변경 감지 우회 + `updatedAt` 갱신 + history/changelog 재계산**까지다. 기존 누적 데이터는 보존된다(파괴적이지 않음).

## 2. 배경 / 문제

- 현재 sync는 md5 동일 시 `git checkout`으로 새 JSON을 롤백한다. 동기화 결과가 의심스러울 때 cron을 기다리는 것 외 우회 수단이 없다.
- `workflow_dispatch` input은 단일 `repo` 문자열만 받아 여러 레포를 함께 처리할 수 없다.
- 대시보드 사용자는 "지금 GitHub에 있는 일정문서"와 "캐시된 데이터"가 일치하는지 확인할 방법이 없다.

## 3. 결정사항 요약

| 항목 | 결정 |
|---|---|
| 진입점 | Actions workflow_dispatch + Settings 새 탭 (둘 다) |
| 강제 의미 | md5 우회 + `updatedAt` 갱신 + history/changelog 재계산 |
| 미리보기 | 캐시 vs 실시간 비교 뷰 + diff 강조 |
| 범위 | 다중 선택 (체크박스) |
| 인증 | PAT 직접 입력 → localStorage |
| 결과 표시 | gh API 폴링 + 완료 알림 |
| UI 위치 | Settings 4번째 탭 신설 |
| 구현 분할 | 기존 `sync-data.yml` + `sync.mjs` 확장 (별도 워크플로 신설 X) |

## 4. 아키텍처

```
┌─────────────────────────────────┐
│  Browser (GitHub Pages)         │
│  Settings → "강제 동기화" 탭     │
│  - PAT (localStorage)           │
│  - cache view (data/<repo>.json)│
│  - live fetch (gh Contents API) │
│  - diff highlight               │
│  - multi-select + trigger       │
│  - poll run status              │
└──────────────┬──────────────────┘
               │  Authorization: Bearer <PAT>
   ┌───────────┴────────────┐
   │  gh REST API           │
   │  GET  /contents        │  → 일정문서 실시간 메타
   │  POST /dispatches      │  → 강제 sync 트리거
   │  GET  /actions/runs    │  → 진행 상황 폴링
   └───────────┬────────────┘
               │ workflow_dispatch
               ▼
┌─────────────────────────────────┐
│  .github/workflows/sync-data.yml│
│  inputs: repos, force (신규)    │
│  ↓                              │
│  scripts/parse-workflow.mjs     │
│  (md5 비교 우회는 워크플로 게이트│
│   에서, history/changelog는     │
│   파서가 매번 재계산)           │
└──────────────┬──────────────────┘
               │ git commit + push (변경 있을 때)
               ▼
        data/*.json on main
               ↓
           Pages 재배포
```

핵심 원칙: cron과 강제 sync가 **같은 sync 코드 경로**를 공유한다. 차이는 input 두 개(`repos`, `force`)와 md5 비교 게이트뿐이다.

## 5. 컴포넌트 트리

```
src/pages/Settings.tsx
  └─ 탭 4번째 추가: { id: 'force-sync', label: '강제 동기화' }
       └─ <ForceSyncTab>
            ├─ <PatRegister>            PAT 입력·검증·마스킹·삭제
            ├─ <RepoForceList>
            │   └─ <RepoCompareRow> × N (config.repos)
            │       ├─ 체크박스 (다중 선택)
            │       ├─ 캐시 메타 컬럼 (data/*.json)
            │       ├─ 실시간 메타 컬럼 (PAT 있을 때만)
            │       └─ diff 마커 (▲/▼/=)
            ├─ <TriggerBar>             선택 N개 / "강제 sync" 버튼
            └─ <RunStatusPanel>         폴링 결과 (queued→in_progress→success/failure)

src/hooks/
  ├─ useForceSyncPat.ts       PAT load/save/clear + 유효성 ping
  ├─ useGithubApi.ts          fetch 래퍼 (Authorization 자동 첨부, 401 핸들링)
  ├─ useWorkflowDispatch.ts   POST /dispatches + 새 run id 식별
  └─ useWorkflowRun.ts        GET /runs/{id} 5초 폴링, completed 시 stop

src/utils/
  └─ parseWorkflowMd.ts       parse-workflow.mjs 핵심 로직을 ESM-only로 추출
                              (서버/클라이언트 공용)
```

## 6. 데이터 흐름

### 6.1 탭 진입
1. `data/config.json` + `data/<repo>.json` 7개 로드 (기존 `useData`/`useConfig` 재사용)
2. 좌측 "캐시" 컬럼 즉시 표시 (`totalChecks`/`doneChecks`/`updatedAt`)

### 6.2 PAT 등록
1. `<PatRegister>`에 입력
2. `GET /user`로 1회 유효성 검증
3. 성공: `localStorage.setItem('forceSync.pat', value)` + `forceSync.patOwner = login`
4. 실패: 에러 메시지, 저장하지 않음

### 6.3 실시간 fetch (PAT 있을 때)
1. 각 레포에 대해 `GET /repos/team-project-final/{repo}/contents/docs/project-management/workflow`
2. 파일 목록 + sha 수신 → 각 파일을 raw로 GET
3. 클라이언트에서 `parseWorkflowMd.ts`로 step·체크 집계
4. 우측 "실시간" 컬럼 채움
5. diff 마커: 캐시 대비 실시간 `doneChecks`/`totalChecks`가 **증가하면 ▲**, **감소하면 ▼**, 동일하면 `=`

### 6.4 선택 + 트리거
1. 체크박스 N개 선택 → "강제 sync" 버튼
2. `POST /actions/workflows/sync-data.yml/dispatches`
   - body: `{ ref: 'main', inputs: { repos: 'a,b,c', force: 'true' } }`
3. 응답 204 (run id 없음)
4. 5초 grace 후 `GET /actions/workflows/sync-data.yml/runs?event=workflow_dispatch&per_page=1`로 가장 최근 run id 식별

### 6.5 폴링
1. `GET /actions/runs/{id}` 5초 간격
2. status 전이: `queued → in_progress → completed`
3. `completed` 시 `conclusion` + jobs[] 결과 표시
4. 자동 데이터 리로드는 하지 않음 (12절 비-범위 참고). "최신 데이터 다시 가져오기" 버튼만 제공.

### 6.6 서버 측 sync 동작
- `sync-data.yml` 워크플로 잡 안에서, `inputs.repos`로 필터링된 각 레포에 대해:
  - tarball 다운 → `parse-workflow.mjs` 호출 → 새 JSON 생성
  - 파서는 항상 `updatedAt = now`, `history[today]` 갱신, diff 있으면 changelog entry 추가 (cron과 동일)
- 커밋 게이트(워크플로 bash):
  - `inputs.force == true` 이거나 md5 변경됨 → 커밋 후보에 포함
  - 둘 다 아니면 `git checkout`으로 새 JSON 롤백 (기존 동작)
- 후보가 1개 이상이면 단일 커밋으로 push → Pages 재배포 트리거
- 로컬 `scripts/sync.mjs`는 본 흐름에 사용되지 않음 (로컬 CLI 전용)

## 7. 워크플로 / 스크립트 변경

### 7.1 `.github/workflows/sync-data.yml`

```yaml
on:
  schedule:
    - cron: '0 0,5,10 * * *'
  workflow_dispatch:
    inputs:
      repos:
        description: '동기화할 레포 (콤마 구분, 비우면 전체)'
        required: false
        type: string
      force:
        description: '강제 동기화 (md5 우회 + history/changelog 재계산)'
        required: false
        type: boolean
        default: false
```

bash 부분 변경 요점:

```bash
TARGET_REPOS="${{ inputs.repos || '' }}"
FORCE="${{ inputs.force || 'false' }}"

# 멤버십 체크 (콤마 구분)
if [ -n "$TARGET_REPOS" ]; then
  echo ",$TARGET_REPOS," | grep -q ",$REPO," || { echo "skip $REPO"; continue; }
fi

# 파서 호출
GITHUB_SHA="$LATEST_SHA" GITHUB_ACTOR="${{ github.actor }}" FORCE="$FORCE" \
  node scripts/parse-workflow.mjs "$DOCS_PATH" "$REPO" "data/$REPO.json"

# 커밋 게이트
if [ "$FORCE" = "true" ] || [ "$OLD_CHECKSUM" != "$NEW_CHECKSUM" ]; then
  UPDATED+=("$REPO ($DEFAULT_BRANCH) from $LATEST_SHA${FORCE:+ [force]}")
else
  git checkout -- "data/$REPO.json" 2>/dev/null || true
fi
```

### 7.2 `scripts/parse-workflow.mjs`

- 변경 없음 또는 최소: `FORCE` 환경변수는 워크플로 측 게이트에서만 사용. 파서 자체는 항상 `updatedAt`/`history` 갱신하는 현 동작을 유지.
- changelog는 diff가 비면 entry 추가 안 함(기존 동작 유지). 강제 sync여도 동일.

### 7.3 `scripts/parsers/parse-workflow-md.mjs` (추출)

- `parseCheckboxes`, `parseWorkflowFile` 순수 함수를 ESM 모듈로 분리
- Node 전용 API(`fs`, `path`) 의존 제거 — 인자로 파일 내용 문자열을 받음
- 클라이언트(`src/utils/parseWorkflowMd.ts`)는 이 모듈을 그대로 import

## 8. 에러 / 엣지케이스

| 상황 | 처리 |
|---|---|
| PAT 없음 | "실시간" 컬럼은 회색 placeholder. 트리거 버튼 disabled + 안내. 캐시 컬럼은 그대로 |
| PAT 무효(401) | 등록 시 즉시 거부. 저장된 토큰이 만료되면 401 응답 캐치 → localStorage 자동 삭제 + 재등록 토스트 |
| PAT 권한 부족(403) | "PAT에 `Actions: Read/Write` + `Contents: Read` 권한 필요" 안내 |
| Rate limit | `X-RateLimit-Remaining: 0` 감지 → reset 시각 안내. 실시간 fetch만 일시 비활성, 트리거는 별도 한도라 가능 |
| `docs/project-management/workflow/` 없음 | 실시간 컬럼에 "문서 없음" 마커. 체크박스는 여전히 선택 가능 |
| 다중 선택 0개 | 트리거 버튼 disabled |
| run id 식별 실패 | grace 5초 후에도 새 run 안 보이면 "트리거 됐지만 식별 실패. Actions에서 확인 ↗" |
| 폴링 네트워크 에러 | 3회 연속 실패 시 폴링 중단, 수동 새로고침 버튼 |
| 변경 0 | 워크플로는 git diff 비어 commit skip. UI는 "변경 없음 — 정상 완료" 표시 (success로 분류) |
| 탭 이탈/새로고침 | 진행 중 run id를 `localStorage['forceSync.runId']`에 보관 → 재진입 시 자동 복원 폴링 |

## 9. 보안 (PAT)

- **저장**: `localStorage['forceSync.pat']` 단일 키, 평문. 동일 출처(GitHub Pages) 내에서만 접근.
- **표시**: 등록 후 `ghp_••••••••XXXX` 형태 마스킹 (마지막 4자). 평문 보기 토글 없음.
- **권한 안내**: fine-grained PAT 권장. 입력 폼에 다음을 명시:
  - Repository access: `team-project-final/workflow-dashboard` + 동기화 대상 7개 레포
  - Permissions: `Actions: Read and write`, `Contents: Read-only`, `Metadata: Read-only`
- **검증 호출**: 저장 직전 `GET /user` 1회 — 유효성 + 사용자 정보. `login`을 `forceSync.patOwner`로 함께 저장.
- **삭제**: "토큰 제거" 버튼 → 키 즉시 삭제, UI 초기화.
- **자동 만료**: 공용 fetch 래퍼가 401 응답 시 자동 토큰 삭제 + 재등록 토스트.
- **XSS 방지**: 새 UI는 `dangerouslySetInnerHTML` 미사용. PAT 값은 React state로만 다루고 DOM 속성/URL/로그에 노출 금지.
- **공유 정책**: 토큰은 사용자 본인용. 팀원은 각자 등록. 운영자/관리자 권한 모델은 GitHub에 위임.

## 10. 테스트 / 검증

수동 검증 체크리스트:
1. PAT 미등록 진입 → 캐시 컬럼만, 트리거 비활성
2. PAT 등록·새로고침·삭제 사이클
3. 가짜 PAT → 401 → 저장 안 됨
4. sync 직후 캐시 == 실시간 → diff 0
5. 워크플로 마크다운에 체크박스 1개 추가(수동) → 실시간에 ▲
6. 단일 강제 sync → 폴링 → success → Actions 로그에 `[force]`
7. 다중(3개) 강제 sync → 커밋 1건, 콤마 멤버십 정상
8. 변경 0 강제 sync → "변경 없음 — 정상 완료" + Actions 커밋 없음
9. 탭 이탈/복귀 → 폴링 자동 재개
10. rate limit 응답 모킹 → 안내 표시

자동화 추가는 첫 버전 범위 밖. `parseWorkflowMd.ts` 추출 시 회귀 방지를 위해 `scripts/parsers/__fixtures__`를 이용한 입출력 동등성 확인 가벼운 스크립트 1개 추가.

## 11. 마일스톤 (구현 순서 제안)

1. `parse-workflow-md.mjs` 추출 + fixture 회귀 테스트
2. `sync-data.yml` input 확장 (`repos`, `force`) + bash 멤버십·게이트 로직
3. Actions 탭에서 수동 트리거 동작 검증 (다중 레포, force 토글)
4. `useForceSyncPat`, `useGithubApi` 훅 (PAT 등록 + 401 핸들링)
5. `<ForceSyncTab>` 골격 + 캐시 컬럼만 표시
6. `useWorkflowDispatch`, `useWorkflowRun` 폴링 훅
7. 실시간 fetch + diff 마커
8. `<TriggerBar>` + 진행 상황 UI
9. 탭 이탈/복귀 폴링 복원
10. 수동 검증 1~10 통과 후 main 머지

## 12. 비-범위 (out of scope)

- 임의 브랜치 sync (default branch 고정)
- 자동 데이터 리로드 (사용자가 수동으로 "최신 데이터 가져오기")
- diff 비교 풀 마크다운 미리보기 (메타 수준만)
- 자동화 단위 테스트 추가
- 다중 사용자 권한/잠금 (운영자 1명만 등 — 첫 버전 미고려)
- OAuth 흐름 (백엔드 없는 정적 사이트라 PAT 입력으로 충분)
