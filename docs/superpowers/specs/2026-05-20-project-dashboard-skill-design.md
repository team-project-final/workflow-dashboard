# `/project-dashboard` 스킬 설계 문서

- **작성일:** 2026-05-20
- **상태:** Draft
- **목적:** Synapse Workflow Dashboard의 전체 기능을 공개 배포 가능한 Claude Code 스킬로 제작

---

## 1. 개요

현재 Synapse Workflow Dashboard는 React/TypeScript 기반의 팀 프로젝트 진행률 시각화 도구이다. 이 스킬은 해당 대시보드의 전체 기능을 `/project-dashboard` 명령 하나로 사용할 수 있도록 패키징한다.

### 핵심 목표

- **템플릿:** 새 프로젝트에 커스터마이즈된 대시보드를 자동 생성
- **운영:** 기존 대시보드의 데이터 동기화, 진행률 조회, 설정 관리, 데이터 편집을 CLI에서 수행
- **범용성:** 주차/컬럼/트랙 구조를 자유롭게 정의할 수 있는 config-driven 설계
- **다중 소스:** GitHub 마크다운, Notion, Linear 등 다양한 데이터 소스 지원
- **공개 배포:** 누구나 설치할 수 있는 범용 스킬

### 스킬 호출

```
/project-dashboard [subcommand] [args]
```

인자 없이 호출하면 대화형 모드로 진입하여 서브커맨드를 안내한다.

---

## 2. 스킬 구조 및 서브커맨드

### 서브커맨드 목록

| 서브커맨드 | 설명 | 예시 |
|---|---|---|
| `init` | 새 프로젝트 대시보드 스캐폴딩 | `/project-dashboard init` |
| `sync` | 외부 소스에서 데이터 동기화 (일반/강제) | `/project-dashboard sync --force` |
| `status` | 터미널에서 진행률 조회 | `/project-dashboard status` |
| `config` | 리포/트랙/주차 설정 관리 | `/project-dashboard config add-repo` |
| `edit` | 체크아이템/스텝/페이즈 직접 편집 | `/project-dashboard edit` |

### 파일 구조

```
skills/project-dashboard/
├── project-dashboard.md          # 메인 스킬 (라우터 역할)
├── modules/
│   ├── init.md                   # 프로젝트 초기화
│   ├── sync.md                   # 데이터 동기화
│   ├── status.md                 # 진행률 조회
│   ├── config.md                 # 설정 관리
│   └── edit.md                   # 데이터 편집
├── templates/
│   ├── scaffold/                 # init에서 사용하는 프로젝트 템플릿
│   │   ├── src/                  # React 컴포넌트 템플릿
│   │   ├── scripts/              # 파서 스크립트 템플릿
│   │   ├── data/                 # 초기 config.json 등
│   │   ├── package.json.tmpl
│   │   └── vite.config.ts.tmpl
│   └── parsers/                  # 데이터 소스별 파서 템플릿
│       ├── github-markdown.mjs
│       ├── notion.mjs
│       └── linear.mjs
└── references/
    └── data-schema.md            # 데이터 스키마 레퍼런스
```

---

## 3. `init` — 프로젝트 초기화

### 수집 정보 (대화형, 순서대로 질문)

1. **프로젝트 이름** — 대시보드 제목 및 디렉토리명
2. **기간 구조** — 주차 수, 시작일, 종료일 (기본: 5주)
3. **트랙 정의** — 트랙 이름, 담당자, 연결 리포 (반복 입력)
4. **컬럼 구조** — 기본 PRD/Task/Workflow 3컬럼 또는 커스텀 컬럼 정의
5. **데이터 소스** — 각 트랙별 데이터 소스 (GitHub 마크다운 / Notion / Linear / 수동 입력)
6. **가상 트랙** — 여러 리포를 합쳐 하나의 트랙으로 보여줄 것이 있는지

### 생성물

```
my-project-dashboard/
├── src/                    # 커스터마이즈된 React 앱
│   ├── components/         # 컬럼 구조에 맞게 생성된 컴포넌트
│   ├── hooks/              # useConfig, useData 등
│   ├── types/              # 프로젝트 구조에 맞는 타입 정의
│   └── ...
├── data/
│   ├── config.json         # 입력 기반으로 생성된 설정
│   └── {track}.json        # 트랙별 초기 데이터 (빈 구조)
├── scripts/
│   ├── validate-data.mjs
│   └── parse-{source}.mjs  # 선택한 데이터 소스별 파서
├── package.json
├── vite.config.ts
└── .github/workflows/      # 선택사항: 자동 동기화 워크플로우
```

### 핵심 원칙

- `config.json`이 모든 구조의 source of truth
- 컬럼/주차/트랙 수가 달라도 동일한 컴포넌트가 `config.json`을 읽어 동적으로 렌더링
- 현재 Synapse의 하드코딩된 부분(W1~W5, 3컬럼 등)을 config-driven으로 일반화

---

## 4. `sync` — 데이터 동기화

### 지원 데이터 소스

| 소스 | 인증 | 파싱 방식 |
|---|---|---|
| **GitHub 마크다운** | `gh` CLI 또는 GitHub token | 리포 클론/fetch → 마크다운 파싱 → JSON 변환 |
| **Notion** | Notion MCP 도구 활용 | 데이터베이스 쿼리 → 페이지/프로퍼티 → JSON 매핑 |
| **Linear** | Linear API token | GraphQL 쿼리 → 이슈/프로젝트 상태 → JSON 매핑 |

### 서브커맨드

```
/project-dashboard sync                          # 전체 트랙 동기화
/project-dashboard sync {track}                  # 특정 트랙만 동기화
/project-dashboard sync {track1},{track2}        # 여러 트랙 동기화
/project-dashboard sync --dry-run                # 변경사항 미리보기 (실제 파일 변경 없음)
/project-dashboard sync --force                  # 전체 트랙 강제 동기화
/project-dashboard sync --force {track1},{track2} # 특정 트랙 강제 동기화
```

### 동기화 플로우

1. `config.json`에서 트랙 목록과 데이터 소스 설정 읽기
2. 소스별 파서 실행하여 원시 데이터 수집
3. 데이터 스키마로 정규화 (스텝 → 페이즈 → 체크아이템 구조)
4. 기존 `data/{track}.json`과 diff 비교
5. 변경사항 요약을 터미널에 출력
6. 파일 갱신 및 `validate-data.mjs` 실행하여 무결성 확인

### 충돌 처리

- 로컬에서 `edit`으로 수정한 데이터와 외부 소스 데이터가 충돌 시 사용자에게 선택지 제시 (로컬 유지 / 외부 소스 덮어쓰기 / 수동 병합)

### 강제 동기화

> 관련 설계: [Force Sync 설계](2026-05-21-force-sync-design.md)

"강제"의 의미는 **md5 변경 감지 우회 + `updatedAt` 갱신 + history/changelog 재계산**이다. 기존 누적 데이터는 보존된다(파괴적이지 않음).

실행 경로는 세 가지:
1. **로컬 CLI:** `npm run sync -- --force`
2. **GitHub Actions:** `workflow_dispatch` API 호출 (PAT 필요)
3. **대시보드 UI:** Settings → 강제 동기화 탭 (ForceSyncTab 컴포넌트)

사용 시나리오:
- 동기화 결과가 의심스러울 때 (history 회귀 등)
- md5가 같지만 changelog/history 재계산이 필요할 때
- 새 파서 로직 배포 후 전체 데이터 재생성 시

---

## 5. `status` — 진행률 조회

### 서브커맨드

```
/project-dashboard status                # 전체 요약
/project-dashboard status {track}        # 특정 트랙 상세
/project-dashboard status --week W3      # 특정 주차 기준
/project-dashboard status --compare      # 지난 동기화 대비 변화량
```

### 출력 예시

**전체 요약:**
```
📊 Synapse Dashboard — 전체 진행률: 64%

트랙                     진행률    이번 주 변화
─────────────────────────────────────────────
synapse-platform-svc     ████████░░  78%   +12%
synapse-frontend         ██████░░░░  58%    +5%
synapse-learning-svc     █████░░░░░  52%    +8%
synapse-knowledge-svc    ████░░░░░░  41%    +3%
team-lead (virtual)      ███████░░░  70%    +6%
```

**트랙 상세:**
```
📋 synapse-platform-svc — 78%

W3 (05-26 ~ 06-01):
  Step 1: API 설계        ████████████ 100%  ✅
  Step 2: DB 스키마        █████████░░░  75%
    - Phase 1: 테이블 설계   ✅ 3/3
    - Phase 2: 마이그레이션  🔲 0/2
  Step 3: 인증 구현        ██████░░░░░░  50%
```

### 데이터 소스

- `data/*.json` 파일을 직접 읽어서 계산
- `config.json`의 구조 정의에 따라 동적으로 트랙/주차/스텝 렌더링
- 진행률 = 완료된 체크아이템 수 / 전체 체크아이템 수

---

## 6. `config` — 설정 관리

### 서브커맨드

```
/project-dashboard config                    # 현재 설정 요약 출력
/project-dashboard config add-repo           # 새 리포/트랙 추가
/project-dashboard config remove-repo        # 리포/트랙 제거
/project-dashboard config add-virtual-track  # 가상 트랙 추가
/project-dashboard config set-weeks          # 주차 구조 변경
/project-dashboard config set-columns        # 컬럼 구조 변경
/project-dashboard config set-source         # 특정 트랙의 데이터 소스 변경
```

### 예시 플로우: `add-repo`

```
> /project-dashboard config add-repo

리포 이름: synapse-notification-svc
트랙 표시명: 알림 서비스
담당자: kim
데이터 소스: GitHub 마크다운
리포 경로: team-project-final/synapse-notification-svc
워크플로우 디렉토리: docs/project-management/workflow

✅ config.json 업데이트 완료
✅ data/synapse-notification-svc.json 초기 파일 생성
✅ validate-data 통과
```

### 안전장치

- 변경 전 현재 `config.json` 백업 (`config.json.bak`)
- 변경 후 자동으로 `validate-data.mjs` 실행
- 검증 실패 시 롤백하고 사용자에게 원인 안내
- 트랙 제거 시 연결된 데이터 파일 삭제 여부를 확인

---

## 7. `edit` — 데이터 직접 편집

### 서브커맨드

```
/project-dashboard edit                          # 대화형 모드
/project-dashboard edit {track}                  # 특정 트랙 편집
/project-dashboard edit {track} --check {item}   # 체크아이템 완료 처리
/project-dashboard edit {track} --uncheck {item} # 체크아이템 완료 해제
/project-dashboard edit {track} --add-step       # 새 스텝 추가
/project-dashboard edit {track} --add-phase      # 특정 스텝에 페이즈 추가
/project-dashboard edit {track} --add-check      # 특정 페이즈에 체크아이템 추가
```

### 대화형 모드 플로우

```
> /project-dashboard edit synapse-platform-svc

현재 W3 (05-26 ~ 06-01) 기준:

  1. Step 1: API 설계       ✅ 완료
  2. Step 2: DB 스키마       75%
  3. Step 3: 인증 구현       50%

어떤 작업을 하시겠습니까?
  a) 체크아이템 상태 변경
  b) 새 스텝 추가
  c) 새 페이즈 추가
  d) 새 체크아이템 추가
  e) 항목 이름 수정
  f) 항목 삭제
```

### 편집 추적

- 수동 편집된 항목에 `"source": "manual"` 메타데이터 추가
- `sync` 실행 시 수동 편집 항목은 충돌 감지 대상으로 표시
- 편집 이력을 `data/.edit-log.json`에 기록 (타임스탬프, 변경 내용)

---

## 8. 데이터 스키마 — config-driven 일반화

### config.json 스키마

```json
{
  "project": {
    "name": "프로젝트 이름",
    "description": "프로젝트 설명"
  },
  "periods": [
    { "id": "W1", "label": "W1", "start": "2026-05-12", "end": "2026-05-18" }
  ],
  "columns": [
    { "id": "prd", "label": "PRD", "type": "list" },
    { "id": "task", "label": "Task", "type": "checklist" },
    { "id": "workflow", "label": "Workflow", "type": "checklist" }
  ],
  "repos": [
    {
      "id": "synapse-platform-svc",
      "trackName": "플랫폼 서비스",
      "owner": "lee",
      "source": {
        "type": "github-markdown",
        "repo": "team-project-final/synapse-platform-svc",
        "path": "docs/project-management/workflow"
      }
    }
  ],
  "virtualTracks": [
    {
      "id": "team-lead",
      "trackName": "팀 리드",
      "owner": "kim",
      "sources": ["synapse-gitops", "synapse-shared"]
    }
  ]
}
```

### 트랙 데이터 스키마 (`data/{track}.json`)

```json
{
  "repo": "synapse-platform-svc",
  "weeks": {
    "W1": {
      "steps": [
        {
          "id": "step-1",
          "title": "API 설계",
          "column": "task",
          "phases": [
            {
              "id": "phase-1",
              "title": "엔드포인트 정의",
              "checks": [
                {
                  "id": "check-1",
                  "label": "REST API 스펙 작성",
                  "done": true,
                  "source": "github",
                  "updatedAt": "2026-05-15T10:00:00Z"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "prd": [],
  "changelog": []
}
```

### 현재 대비 변경 사항

| 항목 | 현재 (Synapse) | 스킬 (일반화) |
|---|---|---|
| 주차 | W1~W5 하드코딩 | `periods` 배열로 자유 정의 |
| 컬럼 | PRD/Task/Workflow 고정 | `columns` 배열로 자유 정의 |
| 컬럼 타입 | 암묵적 | `list`, `checklist`, `kanban` 등 명시 |
| 데이터 소스 | GitHub 마크다운만 | `source.type`으로 다중 소스 |
| 체크아이템 출처 | 추적 안 함 | `source` 필드로 수동/자동 구분 |

---

## 9. 프론트엔드 아키텍처 — 동적 렌더링

### 컴포넌트 구조

```
src/
├── App.tsx                    # 라우팅 (/, /detail/:track, /settings)
├── components/
│   ├── Header.tsx             # 프로젝트명 + 전체 진행률 (config.project에서)
│   ├── TrackCard.tsx          # 트랙별 카드 (config.repos 순회)
│   ├── ProgressTable.tsx      # 주차별 진행률 테이블 (config.periods 순회)
│   ├── TimelineChart.tsx      # 트렌드 차트 (config.periods 기반 X축)
│   ├── ColumnRenderer.tsx     # ★ 핵심: 컬럼 타입별 렌더링 분기
│   │   ├── ChecklistColumn    #   type: "checklist" → 체크박스 목록
│   │   ├── ListColumn         #   type: "list" → 단순 목록
│   │   └── KanbanColumn       #   type: "kanban" → 칸반 보드
│   ├── StepView.tsx           # 스텝 > 페이즈 > 체크아이템 트리 렌더
│   └── Settings/
│       ├── RepoManager.tsx    # 리포/트랙 CRUD
│       ├── DataEditor.tsx     # 인라인 데이터 편집
│       └── ImportExport.tsx   # 설정/데이터 내보내기·가져오기
├── hooks/
│   ├── useConfig.ts           # config.json + localStorage 오버라이드
│   ├── useData.ts             # config 기반 동적 데이터 로딩
│   └── useProgress.ts        # 진행률 계산 (체크아이템 기반)
├── types/
│   └── schema.ts             # Config, TrackData, Step, Phase, Check 타입
└── utils/
    └── progress.ts            # 진행률 계산 유틸
```

### `ColumnRenderer` — 핵심 컴포넌트

```tsx
{config.columns.map(col => (
  <ColumnRenderer
    key={col.id}
    column={col}
    data={weekData.steps.filter(s => s.column === col.id)}
  />
))}
```

컬럼 타입을 추가하려면 `ColumnRenderer`에 새 렌더러만 추가하면 된다. 나머지 컴포넌트는 변경 없음.

### 현재 코드 대비 리팩토링 포인트

- `Detail.tsx`의 PRD/Task/Workflow 3컬럼 하드코딩 → `ColumnRenderer`로 대체
- `Dashboard.tsx`의 트랙 목록 하드코딩 → `config.repos` 순회로 대체
- `ProgressTable`의 W1~W5 고정 헤더 → `config.periods` 동적 헤더

---

## 10. 파서 시스템 — 플러그형 데이터 소스

### 파서 인터페이스

```typescript
interface Parser {
  name: string;
  validate(config: SourceConfig): boolean;
  fetch(config: SourceConfig): Promise<RawData>;
  transform(raw: RawData, columns: Column[]): TrackData;
}
```

모든 파서는 최종적으로 동일한 `TrackData` 구조를 출력한다.

### 기본 제공 파서

| 파서 | 입력 | 변환 로직 |
|---|---|---|
| **github-markdown** | 리포의 마크다운 파일들 | 헤딩 → 스텝, 체크박스 → 체크아이템, 파일명 → 주차 |
| **notion** | Notion DB 페이지들 | 프로퍼티 → 스텝/페이즈, 체크박스 프로퍼티 → 체크아이템 |
| **linear** | Linear 이슈/프로젝트 | 이슈 → 스텝, 라벨 → 페이즈, 상태(done/todo) → 체크아이템 |

### 파서 레지스트리

```
scripts/parsers/
├── index.mjs            # 파서 레지스트리
├── github-markdown.mjs  # GitHub 마크다운 파서
├── notion.mjs           # Notion 파서
└── linear.mjs           # Linear 파서
```

### 커스텀 파서 추가

1. `scripts/parsers/my-source.mjs`에 `Parser` 인터페이스 구현
2. `index.mjs`의 레지스트리에 등록
3. `config.json`에서 `"source": { "type": "my-source", ... }` 사용

### 매핑 설정

소스마다 데이터 구조가 다르므로 `config.json`의 `source` 안에 매핑 힌트를 둔다:

```json
{
  "source": {
    "type": "notion",
    "databaseId": "abc123",
    "mapping": {
      "step": "Name",
      "phase": "Category",
      "done": "Status",
      "doneValue": "완료"
    }
  }
}
```

---

## 11. 테스트 및 검증 전략

### 테스트 계층

| 계층 | 대상 | 도구 |
|---|---|---|
| **스키마 검증** | config.json, data/*.json 구조 | `validate-data.mjs` (일반화) |
| **파서 단위 테스트** | 각 파서의 fetch → transform 결과 | Vitest + fixture 데이터 |
| **컴포넌트 렌더링** | config 기반 동적 렌더링 확인 | Vitest + React Testing Library |
| **E2E 스모크 테스트** | init → sync → status 전체 플로우 | 스킬 내 셀프 테스트 스크립트 |

### 스키마 검증 강화

현재 `validate-data.mjs`를 일반화하여 `config.json`의 구조 정의에 따라 동적으로 검증:

- `periods`에 정의된 주차가 데이터 파일에 모두 존재하는지
- `columns`에 정의된 컬럼 ID가 스텝의 `column` 필드와 일치하는지
- `repos`에 정의된 트랙마다 데이터 파일이 존재하는지
- 체크아이템의 `source` 필드가 유효한 값인지

### 파서 테스트

각 파서에 fixture 파일을 둔다:

```
scripts/parsers/__fixtures__/
├── github-markdown/
│   ├── input/           # 샘플 마크다운 파일들
│   └── expected.json    # 변환 기대 결과
├── notion/
│   ├── input.json       # Notion API 응답 mock
│   └── expected.json
└── linear/
    ├── input.json       # Linear API 응답 mock
    └── expected.json
```

### 스킬 셀프 테스트

```
/project-dashboard init --test
```

1. 임시 디렉토리에 샘플 프로젝트 생성
2. `npm install && npm run build` 성공 확인
3. `validate-data` 통과 확인
4. 임시 디렉토리 정리
