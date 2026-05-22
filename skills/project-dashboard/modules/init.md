# Init Module

Create a new dashboard project via interactive scaffolding.

## Arguments

Parse remaining arguments after `init`:

| Pattern | Action |
|---|---|
| (empty) | Interactive mode — ask all questions |
| `--test` | Self-test: scaffold to temp dir, verify build, clean up |

## Interactive Flow

Ask the user each question one at a time:

### 1. Project Name

"프로젝트 이름을 입력해주세요 (예: Synapse Dashboard):"

Store as `project.name`. Derive directory name: lowercase, spaces to hyphens.

### 2. Output Directory

"프로젝트를 생성할 디렉토리 경로: (기본: ./{project-name-slug})"

Default to `./{project-name}` in current directory. If directory exists, warn and ask to overwrite.

### 3. Period Structure

"주차 구조를 정의합니다. 몇 주차까지 필요한가요? (기본: 5)"

Then: "시작일을 입력해주세요 (YYYY-MM-DD, 기본: 이번 주 월요일):"

Auto-generate weekly periods:
- Calculate each week: start = previous end + 3 days (skip weekends)
- Generate: `[{ id: "W1", label: "W1", start: "...", end: "..." }, ...]`

Show generated periods and ask for confirmation.

### 4. Column Structure

"컬럼 구조를 선택하세요:
  a) PRD / Task / Workflow (기본 3컬럼)
  b) 커스텀 (직접 정의)"

If (a): use default columns `[{ id: "prd", label: "PRD", type: "list" }, { id: "task", label: "Task", type: "checklist" }, { id: "workflow", label: "Workflow", type: "checklist" }]`

If (b): "컬럼을 정의해주세요 (형식: id:label:type, 쉼표 구분). type은 list, checklist, kanban 중 선택"
Example: `task:Task:checklist, review:Review:checklist`

### 5. Track Definitions (repeat)

"트랙을 추가합니다."

For each track:
1. "리포 ID (데이터 파일명): "
2. "트랙 표시명: "
3. "담당자: "
4. "데이터 소스: a) GitHub 마크다운  b) Notion  c) Linear  d) 수동 입력"
5. Based on source type:
   - GitHub: "GitHub 리포 (org/repo): " + "워크플로우 경로 (기본: docs/project-management): "
   - Notion: "Notion 데이터베이스 ID: "
   - Linear: "Linear 프로젝트 ID: "
   - Manual: no additional questions

After each track: "트랙을 더 추가할까요? (y/n)"

### 6. Virtual Tracks

"가상 트랙을 추가할까요? (여러 리포를 하나의 트랙으로 합침) (y/n)"

If yes:
1. "가상 트랙 ID: "
2. "표시명: "
3. "담당자: "
4. Show list of defined repos, ask which to combine: "합칠 리포를 선택하세요 (번호, 쉼표 구분): "

### 7. Base Path

"배포 경로를 입력해주세요 (기본: /):"
Example: `/my-dashboard/` for GitHub Pages subdirectory.

## Scaffold Execution

After collecting all input, build the config object:

```json
{
  "version": 1,
  "project": { "name": "...", "description": "" },
  "periods": [...],
  "columns": [...],
  "repos": [...],
  "virtualTracks": [...],
  "basePath": "/"
}
```

Then run the scaffold generator. All source paths below are relative to **the skill's own directory** (`skills/project-dashboard/`), not the output directory.

1. Write config to a temporary file
2. Run: `node {skill-dir}/scripts/scaffold.mjs {output-dir} {temp-config-path}`
   - `{skill-dir}` = the directory containing this skill (where `project-dashboard.md` lives)
   - If `scripts/scaffold.mjs` does not exist in the skill directory, fall back to using the template files in `{skill-dir}/templates/scaffold/` to copy and populate the project structure directly
3. Delete temporary config file
4. Copy parser scripts from `{skill-dir}/scripts/parsers/` to `{output-dir}/scripts/parsers/` (if the directory exists)
5. Copy `{skill-dir}/scripts/sync.mjs` to `{output-dir}/scripts/sync.mjs` (if the file exists)
6. Copy `{skill-dir}/scripts/validate-data.mjs` to `{output-dir}/scripts/validate-data.mjs` (if the file exists)

Report:

```
✅ 프로젝트가 생성되었습니다!

📁 {output-dir}/
  ├── src/          — React 앱 ({columns.length}개 컬럼, {periods.length}개 주차)
  ├── data/         — config.json + {repos.length}개 트랙 데이터
  ├── scripts/      — 검증 + 파서 + 동기화
  └── package.json

다음 단계:
  cd {output-dir}
  npm install
  npm run dev        — 개발 서버 시작
  npm run sync       — 데이터 동기화
```

## Self-Test (--test)

When `--test` is passed:

1. Create a temp directory
2. Build a minimal test config:
   ```json
   {
     "version": 1,
     "project": { "name": "Test Dashboard" },
     "periods": [{ "id": "W1", "label": "W1", "start": "2026-01-01", "end": "2026-01-07" }],
     "columns": [{ "id": "task", "label": "Task", "type": "checklist" }],
     "repos": [{ "id": "test-repo", "trackName": "Test", "owner": "tester", "source": { "type": "manual" } }],
     "virtualTracks": []
   }
   ```
3. Build a minimal test repo data file (`data/test-repo.json`):
   ```json
   {
     "repo": "test-repo",
     "updatedAt": "2026-01-01T00:00:00.000Z",
     "tracks": [
       {
         "name": "Test",
         "owner": "tester",
         "weeks": [
           {
             "week": "W1",
             "period": "01-01~01-07",
             "steps": [
               {
                 "step": "Setup",
                 "phases": [
                   { "phase": "Init", "checks": [{ "text": "Project init", "done": true }], "total": 1, "done": 1 }
                 ],
                 "totalChecks": 1,
                 "doneChecks": 1
               }
             ],
             "totalChecks": 1,
             "doneChecks": 1
           }
         ]
       }
     ],
     "prd": [{ "week": "W1", "items": [{ "text": "Test PRD item", "done": true }] }],
     "history": [],
     "changelog": []
   }
   ```
4. Run scaffold generator
5. Run: `cd {temp-dir} && npm install && npm run build`
6. Run: `npm run validate:data`
7. If all pass: "✅ Self-test passed"
8. Clean up temp directory
9. If any step fails: show error and keep temp directory for debugging
