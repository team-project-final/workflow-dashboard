# /project-dashboard 스킬 E2E 테스트 설계

- **작성일:** 2026-05-22
- **상태:** 승인됨
- **관련 문서:** [project-dashboard 스킬 설계](2026-05-20-project-dashboard-skill-design.md)

---

## 1. 요약

`/project-dashboard` 스킬의 핵심 모듈(init, config, edit, status)을 외부 테스트 폴더에서 순차 실행하여 end-to-end 검증한다. 가상 시나리오 "개인 포트폴리오 사이트 제작 관리"를 사용한다.

## 2. 테스트 환경

- **폴더:** `C:\workspace\test-portfolio-dashboard`
- **데이터 소스:** 모두 `manual` (외부 레포 없이 독립 테스트)
- **스킬 위치:** `C:\workspace\team-project-final\workflow-dashboard\skills\project-dashboard\`

## 3. 프로젝트 설정

| 항목 | 값 |
|------|-----|
| 프로젝트 이름 | 포트폴리오 대시보드 |
| 기간 | 4주 (W1~W4) |
| 컬럼 | PRD, Task, Workflow (기본 3컬럼) |
| 데이터 소스 | 전트랙 manual |

### 트랙

| ID | 표시명 | 담당자 |
|----|--------|--------|
| design | 디자인 | alice |
| dev | 개발 | bob |
| content | 콘텐츠 | carol |

### 가상 트랙 (config 테스트에서 추가)

| ID | 표시명 | 소스 |
|----|--------|------|
| creative | 크리에이티브 | design + content |

## 4. 테스트 시나리오

### 단계 1: init

스킬의 `init` 모듈을 실행하여 스캐폴드 생성.

**검증:**
- `config.json` 생성 — project.name, periods(4주), columns(3), repos(3트랙)
- 빈 데이터 파일 3개 — `data/design.json`, `data/dev.json`, `data/content.json`
- `package.json` 존재
- `npm install && npm run build` 성공

### 단계 2: config

`config` 모듈로 가상 트랙 "크리에이티브" 추가.

**검증:**
- `config.json`에 `virtualTracks` 배열에 creative 항목 존재
- `npm run validate:data` 통과 (또는 `node scripts/validate-data.mjs`)

### 단계 3: edit

`edit` 모듈로 W1 design 트랙에 더미 데이터 입력.

**입력 데이터:**
```
Step 1: UI 디자인
  Phase 1: 와이어프레임
    - [ ] 메인 페이지 레이아웃
    - [x] 프로젝트 카드 컴포넌트
    - [x] 네비게이션 구조
  Phase 2: 비주얼 디자인
    - [ ] 색상 팔레트 선정
    - [ ] 타이포그래피 선정
Step 2: 에셋 준비
  Phase 1: 이미지
    - [x] 프로필 사진 촬영
    - [ ] 프로젝트 스크린샷
```

**검증:**
- `data/design.json`에 W1 > 2 steps, 3 phases, 7 checks 반영
- doneChecks = 3, totalChecks = 7
- 진행률 = 42%

### 단계 4: status

`status` 모듈로 터미널 출력 확인.

**검증:**
- design 트랙 42% 표시
- dev, content 트랙 0% 표시
- 전체 진행률 계산 정확

### 단계 5: build

`npm run build` 실행.

**검증:**
- exit code 0
- `dist/` 디렉토리 생성

### 단계 6: dev 서버 + 브라우저 확인

`npm run dev` 실행 후 브라우저에서 확인.

**검증:**
- 대시보드 페이지 렌더링
- 3개 트랙 카드 표시
- design 트랙 진행률 표시

## 5. 성공 기준

- 각 단계에서 에러 없이 완료
- 데이터 편집 후 진행률이 정확히 반영
- 빌드된 대시보드가 브라우저에서 정상 렌더링

## 6. 범위 외

- sync 모듈 (외부 레포 없이 테스트 불가)
- GitHub Actions 연동
- Notion/Linear 데이터 소스
