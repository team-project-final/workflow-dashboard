# /project-dashboard E2E 테스트 리포트

- **일시:** 2026-05-22
- **대상:** `/project-dashboard init` 스킬 — 스캐폴딩 + 마크다운 파싱 + 빌드 파이프라인
- **결과:** 전 항목 통과

---

## 1. 테스트 개요

`/project-dashboard init` 스킬이 생성하는 대시보드 프로젝트가 실제 마크다운 일정표를 파싱하여 데이터를 표시하고 관리할 수 있는지 E2E로 검증한다.

### 검증 범위

| 구간 | 설명 |
|---|---|
| 스캐폴딩 | 템플릿 복사, 변수 치환, npm install |
| 마크다운 → JSON | `sync.mjs` + `github-markdown` 파서 |
| 데이터 검증 | `validate-data.mjs` (구조, 합계, 주차 일치) |
| 빌드 | `tsc -b` (TypeScript) + `vite build` (프로덕션) |

### 테스트 환경

- OS: Windows 11 Pro
- Node.js: v22+
- 패키지: 174 packages (0 vulnerabilities)
- 실행 위치: 시스템 임시 디렉토리 (프로젝트 외부)

---

## 2. 테스트 프로젝트 구성

| 항목 | 값 |
|---|---|
| 프로젝트명 | Alpha Sprint Dashboard |
| 주차 | W1 (06-02~06-06), W2 (06-09~06-13) |
| 트랙 | `backend` (박지훈), `frontend` (이수진) |
| 컬럼 | PRD / Task / Workflow (기본 3컬럼) |

### 마크다운 일정표 구성

```
docs/
├── workflow/
│   ├── WORKFLOW_backend_W1.md    — API 설계, DB 구축
│   ├── WORKFLOW_backend_W2.md    — 인증 시스템, 테스트/배포
│   ├── WORKFLOW_frontend_W1.md   — 프로젝트 셋업, 핵심 컴포넌트
│   └── WORKFLOW_frontend_W2.md   — API 연동, QA/최적화
└── prd/
    ├── PRD_W1.md                 — 6건 (FR-ALL, FR-BE, FR-FE)
    └── PRD_W2.md                 — 3건 (FR-ALL, FR-BE, FR-FE)
```

---

## 3. 테스트 결과

### 3.1 단계별 결과

| # | 단계 | 결과 | 비고 |
|---|---|---|---|
| 1 | 임시 디렉토리 생성 | PASS | `mktemp -d` |
| 2 | 스캐폴딩 (템플릿 복사 + 변수 치환) | PASS | package.json, index.html, vite.config.ts |
| 3 | config.json 생성 | PASS | 2 repos, 2 periods, 3 columns |
| 4 | `npm install` | PASS | 174 packages, 0 vulnerabilities |
| 5 | 마크다운 일정표 작성 | PASS | WORKFLOW 4개 + PRD 2개 |
| 6 | `sync.mjs` 파싱 (1차) | PASS | 2 repos synced, 0 errors |
| 7 | `validate:data` (1차) | **FAIL** | PRD W2 누락 |
| 8 | PRD_W2.md 추가 후 재동기화 | PASS | — |
| 9 | `validate:data` (2차) | PASS | 0 warnings |
| 10 | `tsc -b` (TypeScript 컴파일) | PASS | — |
| 11 | `vite build` (프로덕션 빌드) | PASS | 182ms, 446KB JS |
| 12 | 임시 디렉토리 정리 | PASS | — |

### 3.2 파싱 정확도 검증

#### Backend 트랙

| 주차 | Step | Phase | 완료 | 전체 | 진행률 |
|---|---|---|---|---|---|
| W1 | API 설계 | 엔드포인트 정의 | 3 | 4 | 75% |
| W1 | API 설계 | API 문서 작성 | 2 | 3 | 67% |
| W1 | DB 구축 | 스키마 설계 | 3 | 4 | 75% |
| W1 | DB 구축 | 마이그레이션 | 1 | 3 | 33% |
| W2 | 인증 시스템 | JWT 인증 구현 | 2 | 4 | 50% |
| W2 | 인증 시스템 | 권한 관리 | 0 | 3 | 0% |
| W2 | 테스트/배포 | 단위 테스트 | 1 | 3 | 33% |
| W2 | 테스트/배포 | CI/CD 파이프라인 | 0 | 3 | 0% |
| | | **소계** | **12** | **27** | **44%** |

#### Frontend 트랙

| 주차 | Step | Phase | 완료 | 전체 | 진행률 |
|---|---|---|---|---|---|
| W1 | 프로젝트 셋업 | 개발 환경 구성 | 4 | 4 | 100% |
| W1 | 프로젝트 셋업 | 프로젝트 구조 | 2 | 3 | 67% |
| W1 | 핵심 컴포넌트 | 레이아웃 컴포넌트 | 3 | 4 | 75% |
| W1 | 핵심 컴포넌트 | 공통 UI 컴포넌트 | 2 | 4 | 50% |
| W2 | API 연동 | HTTP 클라이언트 | 2 | 3 | 67% |
| W2 | API 연동 | 페이지 구현 | 1 | 4 | 25% |
| W2 | QA/최적화 | 테스트 | 0 | 3 | 0% |
| W2 | QA/최적화 | 성능 최적화 | 0 | 3 | 0% |
| | | **소계** | **14** | **28** | **50%** |

#### PRD 파싱

| 주차 | 건수 | ID 범위 |
|---|---|---|
| W1 | 6건 | FR-ALL-001~002, FR-BE-001~002, FR-FE-001~002 |
| W2 | 3건 | FR-ALL-003, FR-BE-003, FR-FE-003 |

---

## 4. 발견된 이슈 및 수정

### 4.1 phase `total`/`done` 필드 누락 (수정 완료)

- **발견 경위:** 이전 셀프 테스트(`init --test`)에서 수동 생성한 `test-repo.json`의 phase에 `total`/`done` 필드가 빠져 `validate-data.mjs`가 phase 합계 불일치로 실패
- **원인:** `init.md` Self-Test 섹션에 테스트 데이터 파일 생성 지침이 없었음
- **수정:** `init.md`에 `data/test-repo.json` 생성 단계를 추가하고 phase에 `total`/`done` 필드를 포함
- **커밋:** `d0ed60d` — `fix(skill): add test repo data with phase total/done to init self-test`

### 4.2 PRD 주차 누락 시 validate 실패 (정상 동작)

- **현상:** PRD_W1.md만 작성하고 PRD_W2.md가 없을 때 `validate:data`가 `PRD is missing W2` 에러
- **판정:** 정상 동작 — 설정된 모든 period에 대해 PRD가 있어야 검증 통과
- **조치:** PRD_W2.md 추가 후 재동기화하여 통과

---

## 5. 결론

`/project-dashboard` 스킬의 전체 파이프라인이 정상 동작한다:

```
마크다운 일정표 작성 → github-markdown 파서 → JSON 변환 → 데이터 검증 → TypeScript 빌드 → 프로덕션 빌드
```

- 파서가 `## Step` / `### Phase` / `- [x]` 구조를 정확히 인식
- phase 레벨 `total`/`done` 및 step/week 레벨 합계가 정확히 계산됨
- PRD 테이블 파싱 (`FR-*` 패턴) 정상 동작
- changelog 히스토리 자동 생성 확인
