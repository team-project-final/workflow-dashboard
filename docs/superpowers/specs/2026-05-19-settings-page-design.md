# Settings Page — Design Spec

> **Date**: 2026-05-19
> **Status**: Draft
> **Scope**: 레포/트랙/담당자 매핑 UI 관리 + 데이터 직접 편집 + Import/Export

---

## 1. 문제

현재 workflow-dashboard는 레포, 트랙, 담당자, 주차 기간 등의 설정이 5개 이상의 파일에 하드코딩되어 있다. 레포를 하나 추가하거나 담당자를 변경하려면 `validate-data.mjs`, `parse-workflow.mjs`, `parse-prd.mjs`, `useData.ts`, `TimelineChart.tsx` 등을 동시에 수정해야 한다.

파서가 연결되지 않은 레포나 수동으로 진행 상황을 관리하고 싶은 경우에는 코드를 거치지 않고는 불가능하다.

## 2. 해결책

`/settings` 라우트에 설정 페이지를 추가한다. 3개 탭으로 구성:

1. **레포/트랙 관리** — 레포-트랙-담당자 매핑 CRUD, 가상 트랙(병합) 설정
2. **데이터 편집** — Step/Phase/체크항목 직접 CRUD
3. **Import/Export** — config.json 내보내기/가져오기, localStorage 초기화

설정은 `data/config.json`을 기본값(source of truth)으로 하고, 사용자가 UI에서 변경하면 localStorage에 오버라이드로 저장한다. Export 기능으로 JSON을 다운로드하여 `data/config.json`에 커밋하면 파서/CI와 동기화된다.

## 3. config.json 스키마

```jsonc
{
  "version": 1,
  "repos": [
    {
      "repo": "synapse-platform-svc",
      "tracks": [
        { "name": "platform", "owner": "김해준" }
      ]
    },
    {
      "repo": "synapse-knowledge-svc",
      "tracks": [
        { "name": "knowledge-1", "owner": "김현지" },
        { "name": "knowledge-2", "owner": "박은서" }
      ]
    },
    {
      "repo": "synapse-engagement-svc",
      "tracks": [
        { "name": "engagement", "owner": "한승완" }
      ]
    },
    {
      "repo": "synapse-learning-svc",
      "tracks": [
        { "name": "learning-card", "owner": "조유지" },
        { "name": "learning-ai", "owner": "김나경" }
      ]
    },
    {
      "repo": "synapse-frontend",
      "tracks": [
        { "name": "frontend", "owner": "전원" }
      ]
    },
    {
      "repo": "synapse-gitops",
      "tracks": [
        { "name": "team-lead", "owner": "김민구" }
      ]
    },
    {
      "repo": "synapse-shared",
      "tracks": [
        { "name": "team-lead", "owner": "김민구" }
      ]
    }
  ],
  "virtualTracks": [
    {
      "name": "team-lead",
      "owner": "김민구",
      "sources": [
        { "repo": "synapse-gitops", "track": "team-lead" },
        { "repo": "synapse-shared", "track": "team-lead" }
      ]
    }
  ]
}
```

**필드 설명:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `version` | number | 스키마 버전. 향후 마이그레이션용 |
| `repos[]` | array | 등록된 레포 목록 |
| `repos[].repo` | string | 레포 이름. `data/{repo}.json` 파일명과 일치 |
| `repos[].tracks[]` | array | 해당 레포의 트랙 목록 |
| `repos[].tracks[].name` | string | 트랙 이름. JSON 내 `tracks[].name`과 일치 |
| `repos[].tracks[].owner` | string | 담당자 이름 |
| `virtualTracks[]` | array | 가상 트랙(여러 레포 병합) 목록 |
| `virtualTracks[].name` | string | 가상 트랙 표시명 |
| `virtualTracks[].owner` | string | 가상 트랙 담당자 |
| `virtualTracks[].sources[]` | array | 병합할 소스 레포/트랙 쌍 |

## 4. 데이터 흐름

```
앱 로드:
  fetch data/config.json (기본 설정)
    → localStorage 오버라이드 확인
    → 병합된 설정으로 data/{repo}.json fetch 대상 결정
    → 각 레포 JSON + localStorage 데이터 오버라이드 병합
    → 렌더링

설정 변경 (레포/트랙 관리 탭):
  UI 편집 → localStorage["dashboard-config"] 저장 → useConfig 훅이 반응 → 대시보드 재렌더

데이터 편집 (데이터 편집 탭):
  UI 편집 → localStorage["dashboard-data-{repo}"] 저장 → useData 훅이 오버라이드 병합

파서/CI 동기화:
  Export → config.json 다운로드 → data/config.json 커밋
  → validate-data.mjs가 config.json에서 EXPECTED_REPOS 읽기
  → parse-workflow.mjs가 config.json에서 ownerMap 읽기
```

### localStorage 키 구조

| 키 | 값 | 용도 |
|----|-----|------|
| `dashboard-config` | config.json 전체 (JSON string) | 레포/트랙 설정 오버라이드 |
| `dashboard-data-{repo}` | 해당 레포 JSON 전체 (JSON string) | 데이터 오버라이드 |

## 5. 라우팅

| 라우트 | 컴포넌트 | 설명 |
|--------|----------|------|
| `/` | Dashboard | 기존 대시보드 (변경 없음) |
| `/detail/:repo` | Detail | 기존 상세 페이지 (변경 없음) |
| `/settings` | Settings | 새 설정 페이지 |

Header.tsx에 Settings 링크 추가.

## 6. 설정 페이지 구성

### 6.1 탭 1: 레포/트랙 관리

**화면 구성:**
- 등록된 레포 카드 목록 (스크롤)
- 각 카드: 레포명, 트랙/담당자 요약, 편집/삭제 버튼
- 가상 트랙은 파란 배경으로 구분, "🔗 가상 트랙 — 병합" 뱃지 표시
- 상단 "레포 추가" 버튼 → 추가 모달

**레포 편집 모달:**
- 레포 이름 입력 (data/ 폴더 JSON 파일명과 일치 필요)
- 트랙 목록: 트랙명 + 담당자 입력. 동적 추가/삭제
- 저장 시 config의 repos[] 업데이트

**가상 트랙 편집 모달:**
- 가상 트랙 이름, 담당자 입력
- 소스 레포 목록: 등록된 repos[] 중에서 선택. 동적 추가/삭제
- "history와 PRD 데이터가 소스 레포에서 합산됩니다" 경고 표시
- 저장 시 config의 virtualTracks[] 업데이트

**삭제 확인:**
- 레포 삭제 시 확인 다이얼로그 표시
- 가상 트랙의 소스 레포가 삭제되면 경고

### 6.2 탭 2: 데이터 편집

**화면 구성:**
- 상단: 레포 드롭다운 선택 + 주차 버튼 (W1~W5)
- 선택된 레포/주차의 Step 목록 (아코디언)
- 각 Step: 이름, 진행률 뱃지, 편집/삭제 버튼
- Step 펼치면: Phase → 체크항목 트리

**편집 기능:**
- Step 추가: 이름 입력 → 빈 Step 생성
- Step 삭제: 확인 후 제거
- Phase 내 체크항목: 체크박스 토글, 항목 추가(텍스트 입력), 항목 삭제
- 모든 변경은 즉시 localStorage에 저장

**제약:**
- 주차(W1~W5) 자체는 고정. Step/Phase/항목만 편집 가능
- 편집된 데이터는 노란색 인디케이터로 "수정됨" 표시

### 6.3 탭 3: Import/Export

**설정 내보내기 (config.json):**
- 현재 활성 설정(기본값 + localStorage 오버라이드)을 config.json으로 다운로드
- 이 파일을 `data/config.json`에 커밋하면 파서/CI에서 참조

**데이터 내보내기:**
- 등록된 각 레포별 JSON 파일 다운로드
- 수정된 파일은 노란색 뱃지("수정됨") 표시
- 다운로드 시 원본 + localStorage 오버라이드가 병합된 최종 JSON

**설정 가져오기:**
- config.json 파일 업로드 → localStorage에 반영
- version 필드 확인하여 호환성 검증

**전체 초기화:**
- localStorage의 `dashboard-config`, `dashboard-data-*` 키 전부 삭제
- 확인 다이얼로그 필수
- 원본 data/*.json으로 복원

## 7. 파서 스크립트 변경

### validate-data.mjs

**변경 전:**
```javascript
const EXPECTED_REPOS = [
  { repo: 'synapse-platform-svc', tracks: ['platform'] },
  // ... 하드코딩
]
```

**변경 후:**
```javascript
const configPath = path.resolve('data/config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const EXPECTED_REPOS = config.repos.map(r => ({
  repo: r.repo,
  tracks: r.tracks.map(t => t.name),
}))
```

### parse-workflow.mjs

**변경 전:**
```javascript
const ownerMap = { 'platform': '김해준', ... }
const trackAliasMap = { 'gitops': 'team-lead' }
```

**변경 후:**
```javascript
const configPath = path.resolve(path.dirname(outputPath), 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const ownerMap = {}
for (const repo of config.repos) {
  for (const track of repo.tracks) {
    ownerMap[track.name] = track.owner
  }
}
// trackAliasMap 삭제 — config에서 명시적 매핑
```

`periodMap`은 유지 (주차 정의는 고정 범위).

### parse-prd.mjs

`REPO_FR_PREFIXES`는 유지 (범위 A에서 제외).

## 8. useData 훅 변경

### 새 훅: useConfig

```typescript
function useConfig(): Config {
  // 1. fetch data/config.json
  // 2. localStorage["dashboard-config"] 확인
  // 3. localStorage가 있으면 오버라이드, 없으면 기본값
  // 4. Config 타입 반환
}
```

### useData 변경

**변경 전:** `DEFAULT_TRACKS`, `TEAM_LEAD_CONFIG` 하드코딩에서 레포 목록 결정

**변경 후:** `useConfig()`에서 받은 config로 레포 목록 + 가상 트랙 결정. 각 레포 데이터 fetch 후 `localStorage["dashboard-data-{repo}"]` 오버라이드 병합.

## 9. 새 파일 목록

| 파일 | 용도 |
|------|------|
| `data/config.json` | 설정 source of truth |
| `src/pages/Settings.tsx` | 설정 페이지 (3탭 컨테이너) |
| `src/components/settings/RepoManager.tsx` | 탭 1: 레포/트랙 관리 |
| `src/components/settings/RepoEditModal.tsx` | 레포 편집 모달 |
| `src/components/settings/VirtualTrackModal.tsx` | 가상 트랙 편집 모달 |
| `src/components/settings/DataEditor.tsx` | 탭 2: 데이터 편집 |
| `src/components/settings/ImportExport.tsx` | 탭 3: Import/Export |
| `src/hooks/useConfig.ts` | config 로드/저장 훅 |
| `src/types/config.ts` | Config 타입 정의 |

## 10. 기존 파일 변경 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/App.tsx` | `/settings` 라우트 추가 |
| `src/components/Header.tsx` | Settings 링크 추가 |
| `src/hooks/useData.ts` | `DEFAULT_TRACKS`, `TEAM_LEAD_CONFIG` 제거 → `useConfig()` 사용 |
| `src/types/index.ts` | Config 관련 타입 import (또는 config.ts에서 분리) |
| `src/components/TimelineChart.tsx` | 미등록 트랙에 자동 색상 할당 fallback 추가 |
| `scripts/validate-data.mjs` | `EXPECTED_REPOS` → config.json에서 읽기 |
| `scripts/parse-workflow.mjs` | `ownerMap`, `trackAliasMap` → config.json에서 읽기 |

## 11. 범위 외 (의도적 제외)

- 주차(W1~W5) 정의 변경 UI — 고정
- PRD prefix 매핑 UI — `parse-prd.mjs`에서 유지
- 트랙 색상 커스터마이즈 UI — 자동 색상 fallback으로 대응
- 서버 사이드 저장 — 정적 배포 유지, localStorage + JSON export
- 인증/권한 — 설정 페이지 접근 제한 없음
