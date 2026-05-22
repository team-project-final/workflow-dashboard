# 동기화 검증 및 강제 동기화 스킬 반영 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7개 레포의 데이터 무결성을 검증하고, 어제 구현된 강제 동기화 기능을 `/project-dashboard sync` 스킬 모듈과 설계 문서에 반영한다.

**Architecture:** 검증 → 수정 → 스킬 모듈 업데이트 → 설계 문서 업데이트 → 커밋. 코드 변경은 스킬 마크다운 파일 2개와 설계 문서 1개에 한정된다.

**Tech Stack:** Node.js (검증 스크립트), Markdown (스킬/설계 문서)

---

### Task 1: 데이터 무결성 검증

**Files:**
- Read: `data/*.json` (7개 레포 JSON)
- Read: `data/config.json`
- Run: `scripts/validate-data.mjs`

- [ ] **Step 1: validate:data 실행**

```bash
npm run validate:data
```

Expected: 모든 검증 통과 (exit code 0). 만약 에러가 발생하면 에러 메시지를 기록하고 Task 2에서 수정한다.

- [ ] **Step 2: sync:dry 실행**

```bash
npm run sync:dry
```

Expected: `DOCS_DIR` 미설정으로 github-markdown 파서가 skip될 수 있음. 이 경우 정상 동작이다 (CI 환경에서만 실제 동기화 가능). 출력에서 에러(`❌`)가 없는지 확인한다.

- [ ] **Step 3: 각 레포 JSON의 updatedAt 확인**

각 `data/*.json` 파일의 `updatedAt` 필드를 읽어서 동기화 시점을 확인한다. 모든 레포가 최근 24시간 이내에 동기화되었는지 점검한다.

```bash
node -e "
  const fs = require('fs');
  const files = fs.readdirSync('data').filter(f => f.endsWith('.json') && f !== 'config.json');
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync('data/' + f, 'utf-8'));
    const age = ((Date.now() - new Date(d.updatedAt).getTime()) / 3600000).toFixed(1);
    console.log(f.padEnd(35), d.updatedAt, age + 'h ago');
  }
"
```

Expected: 모든 레포가 `2026-05-21T23:35:*` 전후 시간대로 표시됨 (약 24시간 이내).

- [ ] **Step 4: 검증 결과 기록**

검증 결과를 정리한다:
- validate:data 통과 여부
- sync:dry 에러 여부
- updatedAt 시점 요약

문제가 없으면 Task 2를 건너뛰고 Task 3으로 진행한다.

---

### Task 2: 검증 문제 수정 (조건부)

**Files:**
- Modify: 문제에 따라 결정 (Task 1에서 발견된 파일)

> Task 1에서 문제가 발견되지 않으면 이 태스크는 건너뛴다.

- [ ] **Step 1: 문제 분석**

Task 1에서 발견된 에러 메시지를 읽고 원인을 파악한다.

- [ ] **Step 2: 수정 적용**

원인에 맞는 수정을 적용한다. 가능한 유형:
- JSON 스키마 불일치 → 해당 JSON 파일 수정
- validate-data.mjs 버그 → 스크립트 수정
- config.json 불일치 → config 수정

- [ ] **Step 3: 재검증**

```bash
npm run validate:data
```

Expected: exit code 0, 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add <수정된 파일>
git commit -m "fix(data): resolve validation errors found during sync verification"
```

---

### Task 3: sync.md 스킬 모듈에 강제 동기화 반영

**Files:**
- Modify: `skills/project-dashboard/modules/sync.md`

- [ ] **Step 1: Arguments 테이블 확장**

`skills/project-dashboard/modules/sync.md`의 Arguments 섹션을 다음으로 교체한다:

```markdown
## Arguments

Parse remaining arguments after `sync`:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `{repo1},{repo2},...` | 콤마 구분으로 여러 레포 동기화 |
| `--dry-run` | Preview changes without writing files |
| `--force` | md5 비교 우회 + history/changelog 재계산 |
| `--force {repo1},{repo2}` | 특정 레포만 강제 동기화 |
```

- [ ] **Step 2: Force Sync 섹션 추가**

`## Batch Sync for GitHub Actions` 섹션 바로 위에 다음 섹션을 추가한다:

```markdown
## Force Sync

강제 동기화는 md5 체크섬 비교를 우회하고 history/changelog를 재계산한다. 데이터가 의심스럽거나 history가 꼬였을 때 사용한다.

### 동작 차이

| | 일반 sync | 강제 sync |
|---|---|---|
| md5 비교 | ✅ 변경 시만 커밋 | ❌ 우회 — 항상 처리 |
| updatedAt | 변경 시만 갱신 | 항상 갱신 |
| history | 기존에 append | 전체 재계산 |
| changelog | diff 기반 추가 | 전체 재계산 |
| 커밋 메시지 | `- update repo (branch) from sha` | `- update repo (branch) from sha [force]` |

### 실행 경로 1: 로컬

```bash
# 전체 레포 강제 동기화
DOCS_DIR=/path/to/docs npm run sync -- --force

# 특정 레포만
DOCS_DIR=/path/to/docs npm run sync -- --force synapse-platform-svc
```

### 실행 경로 2: GitHub Actions (원격 트리거)

GitHub Actions `workflow_dispatch` API를 호출한다. PAT(Personal Access Token)가 필요하다.

```bash
curl -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/team-project-final/workflow-dashboard/actions/workflows/sync-data.yml/dispatches \
  -d '{"ref":"main","inputs":{"repos":"synapse-platform-svc,synapse-frontend","force":"true"}}'
```

### 실행 경로 3: 대시보드 Settings UI

1. Settings → 강제 동기화 탭 이동
2. PAT 등록 (최초 1회, localStorage에 저장)
3. 레포 목록에서 대상 선택 (체크박스 다중 선택)
4. "강제 동기화 실행" 버튼 클릭
5. RunStatusPanel에서 진행 상황 폴링 확인

UI 컴포넌트 구조:
- `ForceSyncTab.tsx` — 탭 컨테이너
- `PatRegister.tsx` — PAT 입력/저장
- `RepoForceList.tsx` — 레포 선택 체크박스
- `RepoCompareRow.tsx` — 캐시 vs 실시간 비교 행
- `TriggerBar.tsx` — 실행 버튼
- `RunStatusPanel.tsx` — 워크플로 실행 상태 폴링
```

- [ ] **Step 3: 전체 파일 확인**

수정된 `sync.md`를 읽어서 마크다운 구조가 올바른지 확인한다. 섹션 순서가 논리적인지 점검:
1. Arguments
2. Sync Flow
3. Conflict Detection
4. Force Sync (신규)
5. Batch Sync for GitHub Actions

- [ ] **Step 4: 커밋**

```bash
git add skills/project-dashboard/modules/sync.md
git commit -m "docs(skill): add force sync to /project-dashboard sync module"
```

---

### Task 4: 설계 문서에 강제 동기화 반영

**Files:**
- Modify: `docs/superpowers/specs/2026-05-20-project-dashboard-skill-design.md`

- [ ] **Step 1: 서브커맨드 테이블 업데이트**

파일의 섹션 2 "서브커맨드 목록" 테이블에서 `sync` 행을 수정한다:

기존:
```markdown
| `sync` | 외부 소스에서 데이터 동기화 | `/project-dashboard sync` |
```

변경:
```markdown
| `sync` | 외부 소스에서 데이터 동기화 (일반/강제) | `/project-dashboard sync --force` |
```

- [ ] **Step 2: 섹션 4 sync 서브커맨드 목록 확장**

파일의 섹션 4 "서브커맨드" 코드 블록을 다음으로 교체한다:

```markdown
### 서브커맨드

\```
/project-dashboard sync                          # 전체 트랙 동기화
/project-dashboard sync {track}                  # 특정 트랙만 동기화
/project-dashboard sync {track1},{track2}        # 여러 트랙 동기화
/project-dashboard sync --dry-run                # 변경사항 미리보기 (실제 파일 변경 없음)
/project-dashboard sync --force                  # 전체 트랙 강제 동기화
/project-dashboard sync --force {track1},{track2} # 특정 트랙 강제 동기화
\```
```

- [ ] **Step 3: 강제 동기화 하위 섹션 추가**

섹션 4 "충돌 처리" 바로 뒤에 다음 하위 섹션을 추가한다:

```markdown
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
```

- [ ] **Step 4: 전체 파일 확인**

수정된 설계 문서를 읽어서 다음을 점검한다:
- 서브커맨드 테이블과 섹션 4의 내용이 일치하는지
- 상호 참조 링크가 올바른지
- 마크다운 문법 오류 없는지

- [ ] **Step 5: 커밋**

```bash
git add docs/superpowers/specs/2026-05-20-project-dashboard-skill-design.md
git commit -m "docs(spec): add force sync to project-dashboard skill design"
```

---

### Task 5: 최종 검증 및 정리 커밋

**Files:**
- Read: `skills/project-dashboard/modules/sync.md`
- Read: `docs/superpowers/specs/2026-05-20-project-dashboard-skill-design.md`
- Read: `docs/superpowers/specs/2026-05-22-sync-verification-and-force-sync-skill-design.md`

- [ ] **Step 1: 크로스 레퍼런스 검증**

세 문서 간의 상호 참조가 올바른지 확인한다:
- `sync.md`의 force sync 동작 설명이 `2026-05-21-force-sync-design.md`의 명세와 일치하는지
- 설계 문서의 서브커맨드 목록이 `sync.md`의 Arguments 테이블과 일치하는지
- `2026-05-22` 설계 문서의 변경 명세가 실제 적용된 내용과 일치하는지

- [ ] **Step 2: 설계 문서 상태 업데이트**

`docs/superpowers/specs/2026-05-22-sync-verification-and-force-sync-skill-design.md`의 상태를 "완료"로 변경한다:

기존:
```markdown
- **상태:** 승인됨
```

변경:
```markdown
- **상태:** 완료
```

- [ ] **Step 3: 최종 커밋**

```bash
git add docs/superpowers/specs/2026-05-22-sync-verification-and-force-sync-skill-design.md
git commit -m "docs: mark sync verification spec as completed"
```
