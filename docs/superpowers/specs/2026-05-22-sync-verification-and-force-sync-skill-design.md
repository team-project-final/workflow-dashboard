# 동기화 검증 및 강제 동기화 스킬 반영 설계

- **작성일:** 2026-05-22
- **상태:** 완료
- **관련 문서:**
  - [project-dashboard 스킬 설계](2026-05-20-project-dashboard-skill-design.md)
  - [force sync 설계](2026-05-21-force-sync-design.md)

---

## 1. 요약

세 가지 작업을 수행한다:

1. **데이터 검증** — `validate:data` + `sync:dry`로 7개 레포의 JSON 무결성 및 마크다운 일치 확인
2. **스킬 모듈 업데이트** — `skills/project-dashboard/modules/sync.md`에 강제 동기화 기능 반영
3. **설계 문서 업데이트** — `2026-05-20-project-dashboard-skill-design.md`에 force sync 명세 추가

## 2. 범위

### 포함

| 항목 | 설명 |
|------|------|
| 데이터 무결성 검증 | `npm run validate:data` 실행 |
| 동기화 상태 확인 | `npm run sync:dry` 실행, 차이 보고 |
| sync.md 업데이트 | `--force` 옵션 및 다중 레포 선택 추가 |
| 설계 문서 업데이트 | sync 서브커맨드 테이블 + 섹션 4 보강 |
| 문제 수정 | 검증 중 발견된 문제 수정 |

### 제외

| 항목 | 사유 |
|------|------|
| Notion/Linear 파서 구현 | 현재 프로젝트에서 미사용 |
| Phase 3 (init/scaffold) | 별도 작업 사이클 |
| Settings UI 코드 수정 | 이미 구현 완료 |
| sync-data.yml 수정 | 이미 force 기능 구현 완료 |

## 3. sync.md 변경 명세

### 3.1 Arguments 테이블 확장

기존:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `--dry-run` | Preview changes without writing files |

변경 후:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `{repo1},{repo2},...` | 콤마 구분으로 여러 레포 동기화 |
| `--dry-run` | Preview changes without writing files |
| `--force` | md5 비교 우회 + history/changelog 재계산 |
| `--force {repo1},{repo2}` | 특정 레포만 강제 동기화 |

### 3.2 Force Sync 섹션 추가

`sync.md`에 "Force Sync" 섹션을 신설하여 다음을 문서화:

1. **동작 차이**: 일반 sync는 md5 비교 후 변경분만 처리. force는 md5 우회 + `updatedAt` 갱신 + history/changelog 전체 재계산
2. **로컬 실행 경로**: `npm run sync -- --force --repos platform-svc,frontend`
3. **원격 트리거 경로**: GitHub Actions `workflow_dispatch` API 호출 (PAT 필요)
   - POST `/repos/{owner}/{repo}/actions/workflows/sync-data.yml/dispatches`
   - body: `{ "ref": "main", "inputs": { "repos": "...", "force": "true" } }`
4. **Settings UI 연동**: ForceSyncTab → PAT 등록 → 레포 선택 → 트리거 → RunStatusPanel로 폴링

### 3.3 커밋 메시지 포맷

force sync 시 커밋 메시지에 `[force]` 마커가 추가됨:
```
data: sync workflow data
  - update synapse-platform-svc (dev) from abc1234 [force]
```

## 4. 설계 문서 변경 명세

`2026-05-20-project-dashboard-skill-design.md` 섹션 4 (sync) 변경:

1. 서브커맨드 테이블에 `--force` 옵션 행 추가
2. "강제 동기화" 하위 섹션 추가 (동작 원리, 실행 경로 2가지)
3. 아키텍처 다이어그램에 force 경로 주석 추가
4. `2026-05-21-force-sync-design.md` 상호 참조 링크

## 5. 작업 순서

1. `npm run validate:data` 실행 → 오류 확인
2. `npm run sync:dry` 실행 → 마크다운 ↔ JSON 차이 확인
3. 문제 발견 시 수정
4. `skills/project-dashboard/modules/sync.md` 업데이트
5. `docs/superpowers/specs/2026-05-20-project-dashboard-skill-design.md` 업데이트
6. 커밋
