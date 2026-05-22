# /project-dashboard 스킬 E2E 테스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 테스트 폴더에서 `/project-dashboard` 스킬의 init → config → edit → status → build → dev 전체 워크플로우를 검증한다.

**Architecture:** 스킬 모듈의 지시대로 파일을 생성/수정하며 각 단계의 결과물을 검증한다. 스킬이 "사용자에게 질문하라"고 지시하는 부분은 미리 정해진 답변으로 대체한다. 테스트 완료 후 폴더를 정리한다.

**Tech Stack:** Node.js (scaffold, validate), React 19 + Vite (생성된 대시보드)

---

### Task 1: init — 스캐폴드 생성

**Files:**
- Create: `C:\workspace\test-portfolio-dashboard\` (전체 프로젝트 디렉토리)
- Run: `scripts/scaffold.mjs`

init 모듈의 대화형 질문에 대한 미리 정해진 답변으로 config를 작성한 뒤 scaffold를 실행한다.

- [ ] **Step 1: config JSON 작성**

`C:\workspace\team-project-final\workflow-dashboard` 디렉토리에서 임시 config 파일을 작성한다:

```json
{
  "version": 1,
  "project": {
    "name": "포트폴리오 대시보드",
    "description": "개인 포트폴리오 사이트 제작 관리용 대시보드"
  },
  "periods": [
    { "id": "W1", "label": "W1", "start": "2026-05-25", "end": "2026-05-29" },
    { "id": "W2", "label": "W2", "start": "2026-06-01", "end": "2026-06-05" },
    { "id": "W3", "label": "W3", "start": "2026-06-08", "end": "2026-06-12" },
    { "id": "W4", "label": "W4", "start": "2026-06-15", "end": "2026-06-19" }
  ],
  "columns": [
    { "id": "prd", "label": "PRD", "type": "list" },
    { "id": "task", "label": "Task", "type": "checklist" },
    { "id": "workflow", "label": "Workflow", "type": "checklist" }
  ],
  "repos": [
    { "id": "design", "trackName": "디자인", "owner": "alice", "source": { "type": "manual" } },
    { "id": "dev", "trackName": "개발", "owner": "bob", "source": { "type": "manual" } },
    { "id": "content", "trackName": "콘텐츠", "owner": "carol", "source": { "type": "manual" } }
  ],
  "virtualTracks": [],
  "basePath": "/"
}
```

파일 경로: `/tmp/test-portfolio-config.json` (또는 Windows temp 경로)

- [ ] **Step 2: scaffold 실행**

```bash
node scripts/scaffold.mjs "C:\workspace\test-portfolio-dashboard" /tmp/test-portfolio-config.json
```

Expected: 성공 메시지 + 파일 목록 출력.

- [ ] **Step 3: 생성된 파일 구조 확인**

```bash
ls -la C:\workspace\test-portfolio-dashboard/
ls -la C:\workspace\test-portfolio-dashboard/data/
ls -la C:\workspace\test-portfolio-dashboard/src/
```

Expected:
- `data/config.json` 존재
- `data/design.json`, `data/dev.json`, `data/content.json` 존재 (빈 데이터)
- `src/` 디렉토리에 App.tsx, pages/, components/, hooks/, types/ 존재
- `package.json` 존재

- [ ] **Step 4: config.json 내용 검증**

```bash
node -e "const c = require('./data/config.json'); console.log('project:', c.project.name); console.log('periods:', c.periods.length); console.log('columns:', c.columns.length); console.log('repos:', c.repos.length)"
```

`C:\workspace\test-portfolio-dashboard` 에서 실행.

Expected:
```
project: 포트폴리오 대시보드
periods: 4
columns: 3
repos: 3
```

- [ ] **Step 5: 빈 데이터 파일 검증**

`data/design.json`을 읽어서 구조 확인:
- `repo` = "design"
- `tracks[0].name` = "디자인"
- `tracks[0].owner` = "alice"
- `tracks[0].weeks` = []

- [ ] **Step 6: validate-data 스크립트 복사**

init 모듈에 따르면 scaffold 후 scripts를 복사해야 한다:

```bash
cp scripts/validate-data.mjs C:\workspace\test-portfolio-dashboard/scripts/
cp scripts/sync.mjs C:\workspace\test-portfolio-dashboard/scripts/
cp -r scripts/parsers/ C:\workspace\test-portfolio-dashboard/scripts/parsers/
```

원본 프로젝트(`C:\workspace\team-project-final\workflow-dashboard`)에서 실행.

- [ ] **Step 7: npm install**

```bash
cd C:\workspace\test-portfolio-dashboard && npm install
```

Expected: exit code 0, `node_modules/` 생성.

- [ ] **Step 8: npm run build**

```bash
cd C:\workspace\test-portfolio-dashboard && npm run build
```

Expected: exit code 0, `dist/` 디렉토리 생성.

---

### Task 2: config — 가상 트랙 추가

**Files:**
- Modify: `C:\workspace\test-portfolio-dashboard\data\config.json`

config 모듈의 `add-virtual-track` 지시를 따른다.

- [ ] **Step 1: config.json 백업**

config 모듈의 Safety Protocol에 따라 백업 생성:

```bash
cp C:\workspace\test-portfolio-dashboard/data/config.json C:\workspace\test-portfolio-dashboard/data/config.json.bak
```

- [ ] **Step 2: 가상 트랙 추가**

`C:\workspace\test-portfolio-dashboard\data\config.json`의 `virtualTracks` 배열에 추가:

```json
{
  "id": "creative",
  "trackName": "크리에이티브",
  "owner": "alice",
  "sources": ["design", "content"]
}
```

- [ ] **Step 3: 검증**

```bash
cd C:\workspace\test-portfolio-dashboard && node scripts/validate-data.mjs
```

Expected: 통과 (exit code 0). 실패 시 config.json.bak에서 롤백.

---

### Task 3: edit — 더미 데이터 입력

**Files:**
- Modify: `C:\workspace\test-portfolio-dashboard\data\design.json`
- Create: `C:\workspace\test-portfolio-dashboard\data\.edit-log.json`

edit 모듈의 지시를 따라 W1 design 트랙에 Step, Phase, Check Item을 추가한다.

- [ ] **Step 1: design.json에 W1 데이터 구조 작성**

`data/design.json`의 `tracks[0].weeks` 배열에 W1 데이터를 추가한다. 전체 파일 내용:

```json
{
  "repo": "design",
  "updatedAt": "2026-05-22T10:00:00.000Z",
  "tracks": [
    {
      "name": "디자인",
      "owner": "alice",
      "weeks": [
        {
          "week": "W1",
          "period": "05-25~05-29",
          "steps": [
            {
              "name": "UI 디자인",
              "status": "In Progress",
              "phases": [
                {
                  "name": "와이어프레임",
                  "total": 3,
                  "done": 2,
                  "items": [
                    { "text": "메인 페이지 레이아웃", "done": false, "source": "manual" },
                    { "text": "프로젝트 카드 컴포넌트", "done": true, "source": "manual" },
                    { "text": "네비게이션 구조", "done": true, "source": "manual" }
                  ]
                },
                {
                  "name": "비주얼 디자인",
                  "total": 2,
                  "done": 0,
                  "items": [
                    { "text": "색상 팔레트 선정", "done": false, "source": "manual" },
                    { "text": "타이포그래피 선정", "done": false, "source": "manual" }
                  ]
                }
              ],
              "totalChecks": 5,
              "doneChecks": 2
            },
            {
              "name": "에셋 준비",
              "status": "In Progress",
              "phases": [
                {
                  "name": "이미지",
                  "total": 2,
                  "done": 1,
                  "items": [
                    { "text": "프로필 사진 촬영", "done": true, "source": "manual" },
                    { "text": "프로젝트 스크린샷", "done": false, "source": "manual" }
                  ]
                }
              ],
              "totalChecks": 2,
              "doneChecks": 1
            }
          ],
          "totalChecks": 7,
          "doneChecks": 3
        }
      ]
    }
  ],
  "prd": [],
  "history": [
    {
      "date": "2026-05-22",
      "totalChecks": 7,
      "doneChecks": 3
    }
  ],
  "changelog": []
}
```

- [ ] **Step 2: 합계 검증**

작성한 데이터의 합계를 수동 확인:
- Phase "와이어프레임": total=3, done=2 ✓
- Phase "비주얼 디자인": total=2, done=0 ✓
- Phase "이미지": total=2, done=1 ✓
- Step "UI 디자인": totalChecks=5, doneChecks=2 ✓
- Step "에셋 준비": totalChecks=2, doneChecks=1 ✓
- Week W1: totalChecks=7, doneChecks=3 ✓
- 진행률: 3/7 = 42% ✓

- [ ] **Step 3: edit-log 작성**

edit 모듈에 따라 `data/.edit-log.json` 생성:

```json
[
  {
    "timestamp": "2026-05-22T10:00:00.000Z",
    "track": "design",
    "action": "add-step",
    "path": "W1 > UI 디자인",
    "detail": "W1에 Step 추가: UI 디자인 (5 checks)"
  },
  {
    "timestamp": "2026-05-22T10:00:01.000Z",
    "track": "design",
    "action": "add-step",
    "path": "W1 > 에셋 준비",
    "detail": "W1에 Step 추가: 에셋 준비 (2 checks)"
  }
]
```

- [ ] **Step 4: validate-data 실행**

```bash
cd C:\workspace\test-portfolio-dashboard && node scripts/validate-data.mjs
```

Expected: 통과 (경고는 허용 — W2~W4 빈 주차 가능).

---

### Task 4: status — 터미널 진행률 확인

**Files:**
- Read: `C:\workspace\test-portfolio-dashboard\data\*.json`

status 모듈의 지시를 따라 진행률을 터미널에 출력한다.

- [ ] **Step 1: 전체 요약 출력**

status 모듈 형식에 따라 각 트랙의 진행률을 계산하고 출력한다:

```bash
cd C:\workspace\test-portfolio-dashboard && node -e "
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync('data/config.json', 'utf-8'));

  console.log('📊 ' + config.project.name + ' — 전체 진행률');
  console.log('');
  console.log('트랙                     진행률');
  console.log('─────────────────────────────────────────────');

  let totalAll = 0, doneAll = 0;
  for (const repo of config.repos) {
    const data = JSON.parse(fs.readFileSync('data/' + repo.id + '.json', 'utf-8'));
    const total = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + (w.totalChecks || 0), 0), 0);
    const done = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + (w.doneChecks || 0), 0), 0);
    totalAll += total; doneAll += done;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    console.log(repo.trackName.padEnd(25) + bar + '  ' + pct + '%');
  }
  const overallPct = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0;
  console.log('');
  console.log('전체: ' + doneAll + '/' + totalAll + ' (' + overallPct + '%)');
"
```

Expected:
```
📊 포트폴리오 대시보드 — 전체 진행률

트랙                     진행률
─────────────────────────────────────────────
디자인                    ████░░░░░░  42%
개발                      ░░░░░░░░░░  0%
콘텐츠                    ░░░░░░░░░░  0%

전체: 3/7 (42%)
```

- [ ] **Step 2: design 트랙 상세 확인**

design 트랙의 W1 상세 데이터를 읽어서 Step/Phase 레벨의 진행률이 정확한지 확인:

```bash
cd C:\workspace\test-portfolio-dashboard && node -e "
  const data = JSON.parse(require('fs').readFileSync('data/design.json', 'utf-8'));
  const w1 = data.tracks[0].weeks[0];
  console.log('📋 디자인 — ' + Math.round(w1.doneChecks / w1.totalChecks * 100) + '%');
  console.log('');
  console.log(w1.week + ' (' + w1.period + '):');
  for (const step of w1.steps) {
    const pct = step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0;
    const filled = Math.round(pct * 12 / 100);
    const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
    const mark = pct === 100 ? ' ✅' : '';
    console.log('  ' + step.name + '   ' + bar + ' ' + pct + '%' + mark);
    for (const phase of step.phases) {
      const pm = phase.done === phase.total ? '✅' : '🔲';
      console.log('    - ' + phase.name + '   ' + pm + ' ' + phase.done + '/' + phase.total);
    }
  }
"
```

Expected:
```
📋 디자인 — 42%

W1 (05-25~05-29):
  UI 디자인   █████░░░░░░░ 40%
    - 와이어프레임   🔲 2/3
    - 비주얼 디자인   🔲 0/2
  에셋 준비   ██████░░░░░░ 50%
    - 이미지   🔲 1/2
```

---

### Task 5: build — 빌드 검증

**Files:**
- Read: `C:\workspace\test-portfolio-dashboard\dist\` (빌드 출력)

- [ ] **Step 1: TypeScript 빌드 체크**

```bash
cd C:\workspace\test-portfolio-dashboard && npx tsc -b --noEmit
```

Expected: exit code 0, 에러 없음.

- [ ] **Step 2: Vite 빌드**

```bash
cd C:\workspace\test-portfolio-dashboard && npm run build
```

Expected: exit code 0, `dist/` 디렉토리에 `index.html` + `assets/` 존재.

- [ ] **Step 3: 빌드 출력 확인**

```bash
ls C:\workspace\test-portfolio-dashboard/dist/
ls C:\workspace\test-portfolio-dashboard/dist/assets/
```

Expected: `index.html`, `assets/` 안에 `.js`, `.css` 파일 존재.

---

### Task 6: dev 서버 + 브라우저 확인

**Files:**
- Read: 브라우저에서 localhost 확인

- [ ] **Step 1: dev 서버 시작**

```bash
cd C:\workspace\test-portfolio-dashboard && npm run dev
```

백그라운드로 실행. 포트 번호 확인 (기본 5173).

- [ ] **Step 2: 브라우저에서 대시보드 확인**

브라우저로 `http://localhost:5173` 접속. 확인 항목:
- 페이지 타이틀에 "포트폴리오 대시보드" 표시
- 3개 트랙 카드 렌더링 (디자인, 개발, 콘텐츠)
- 디자인 트랙에 진행률 표시

- [ ] **Step 3: 디테일 페이지 확인**

디자인 트랙 카드 클릭 → 상세 페이지에서:
- W1 탭에 "UI 디자인", "에셋 준비" 두 Step 표시
- 체크아이템 목록 표시 (done/not done 구분)

- [ ] **Step 4: dev 서버 종료**

dev 서버 프로세스를 종료한다.

---

### Task 7: 정리

- [ ] **Step 1: 테스트 결과 요약**

모든 단계의 통과/실패를 정리한다:
- Task 1 (init): scaffold 생성 + 빌드 성공 여부
- Task 2 (config): 가상 트랙 추가 + 검증 통과 여부
- Task 3 (edit): 데이터 입력 + 합계 정확 여부
- Task 4 (status): 진행률 출력 정확 여부
- Task 5 (build): 빌드 성공 여부
- Task 6 (dev): 브라우저 렌더링 여부

- [ ] **Step 2: 테스트 폴더 정리 여부 확인**

사용자에게 테스트 폴더 삭제 여부를 확인한다:

```bash
rm -rf C:\workspace\test-portfolio-dashboard
```

사용자가 유지를 원하면 삭제하지 않는다.

- [ ] **Step 3: 발견된 문제 기록 (조건부)**

스킬 동작에서 문제가 발견되면 원본 프로젝트에 이슈로 기록하거나 스킬 파일을 수정한다.
