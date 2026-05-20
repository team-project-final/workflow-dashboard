# `/project-dashboard` Skill — Phase 1: Core + Status + Config + Edit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `/project-dashboard` Claude Code skill with core routing, `status`, `config`, and `edit` subcommands — immediately usable on the current Synapse Workflow Dashboard project.

**Architecture:** A single skill entry point (`project-dashboard.md`) routes to subcommand modules (`modules/*.md`). Each module contains Claude Code instructions for reading/writing project files (`data/config.json`, `data/*.json`). A shared `references/data-schema.md` documents the data contract.

**Tech Stack:** Claude Code skill (Markdown instruction files), Node.js scripts (validation), JSON data files

---

## File Structure

```
skills/project-dashboard/
├── project-dashboard.md              # Main skill — router + help
├── modules/
│   ├── status.md                     # Progress display in terminal
│   ├── config.md                     # Config management instructions
│   └── edit.md                       # Data editing instructions
└── references/
    └── data-schema.md                # Data contract reference
```

All files are Markdown instruction files for Claude Code. No application code — the skill instructs Claude how to read/write the project's existing JSON files.

---

### Task 1: Data Schema Reference

**Files:**
- Create: `skills/project-dashboard/references/data-schema.md`

This file documents the data contract so all modules share a single source of truth.

- [ ] **Step 1: Create the data-schema.md reference file**

```markdown
# Project Dashboard — Data Schema Reference

This document defines the data contract for project-dashboard projects.
All modules (status, config, edit, sync, init) must read/write data
conforming to these schemas.

## config.json

Location: `data/config.json` (project root)

```json
{
  "version": 1,
  "project": {
    "name": "string — dashboard title",
    "description": "string — optional project description"
  },
  "periods": [
    {
      "id": "string — e.g. 'W1'",
      "label": "string — display label",
      "start": "string — YYYY-MM-DD",
      "end": "string — YYYY-MM-DD"
    }
  ],
  "columns": [
    {
      "id": "string — e.g. 'prd', 'task', 'workflow'",
      "label": "string — display label",
      "type": "string — 'list' | 'checklist' | 'kanban'"
    }
  ],
  "repos": [
    {
      "id": "string — repo identifier, also JSON filename",
      "trackName": "string — display name",
      "owner": "string — person responsible",
      "source": {
        "type": "string — 'github-markdown' | 'notion' | 'linear' | 'manual'",
        "repo": "string — e.g. 'org/repo-name' (github-markdown)",
        "path": "string — e.g. 'docs/project-management/workflow' (github-markdown)",
        "databaseId": "string — Notion database ID (notion)",
        "projectId": "string — Linear project ID (linear)",
        "mapping": {
          "step": "string — field name mapping",
          "phase": "string — field name mapping",
          "done": "string — field name mapping",
          "doneValue": "string — value that means 'done'"
        }
      }
    }
  ],
  "virtualTracks": [
    {
      "id": "string — virtual track identifier",
      "trackName": "string — display name",
      "owner": "string — person responsible",
      "sources": ["string — repo IDs to combine"]
    }
  ]
}
```

### Legacy config format

Older projects may use this format (version 1 without project/periods/columns):

```json
{
  "version": 1,
  "repos": [
    {
      "repo": "string — repo name",
      "tracks": [
        { "name": "string", "owner": "string" }
      ]
    }
  ],
  "virtualTracks": [
    {
      "name": "string",
      "owner": "string",
      "sources": [
        { "repo": "string", "track": "string" }
      ]
    }
  ]
}
```

When encountering legacy format, the skill should read it as-is.
Migration to new format happens only when user runs `/project-dashboard config migrate`.

## Track Data Files

Location: `data/{repo-id}.json`

```json
{
  "repo": "string — matches config repo id",
  "updatedAt": "string — ISO 8601 timestamp",
  "tracks": [
    {
      "name": "string — track name",
      "owner": "string — owner name",
      "weeks": [
        {
          "week": "string — period id (e.g. 'W1')",
          "period": "string — date range (e.g. '05-12~05-16')",
          "steps": [
            {
              "name": "string — step title",
              "status": "'Done' | 'In Progress' | 'Not Started'",
              "phases": [
                {
                  "name": "string — phase title",
                  "total": "number — total check items",
                  "done": "number — completed check items",
                  "items": [
                    {
                      "text": "string — check item label",
                      "done": "boolean"
                    }
                  ]
                }
              ],
              "totalChecks": "number — sum of all phase totals",
              "doneChecks": "number — sum of all phase dones"
            }
          ],
          "totalChecks": "number — sum of all step totalChecks",
          "doneChecks": "number — sum of all step doneChecks"
        }
      ]
    }
  ],
  "prd": [
    {
      "week": "string — period id",
      "items": [
        {
          "id": "string — e.g. 'FR-PL-001'",
          "title": "string",
          "status": "'done' | 'in_progress' | 'not_started'"
        }
      ]
    }
  ],
  "history": [
    {
      "date": "string — YYYY-MM-DD",
      "totalChecks": "number",
      "doneChecks": "number"
    }
  ],
  "changelog": [
    {
      "date": "string — ISO 8601 timestamp",
      "commit": "string — git commit hash",
      "author": "string",
      "file": "string — source file",
      "changes": [
        {
          "type": "'step_added' | 'step_deleted' | 'step_modified' | 'check_done' | 'check_undone' | 'phase_added' | 'phase_deleted'",
          "target": "string — e.g. 'W1 > step-name'",
          "detail": "string — optional detail"
        }
      ]
    }
  ]
}
```

## Progress Calculation

```
check item progress = done ? 1 : 0
phase progress = done / total
step progress = doneChecks / totalChecks
week progress = doneChecks / totalChecks
track progress = sum(all week doneChecks) / sum(all week totalChecks)
overall progress = sum(all track doneChecks) / sum(all track totalChecks)
```

## Progress Color Bands

| Range | Level | Use |
|---|---|---|
| 90-100% | success (green) | On track |
| 60-89% | info (blue) | Progressing |
| 30-59% | warning (orange) | Behind |
| 1-29% | danger (red) | At risk |
| 0% | gray | Not started |

## Virtual Tracks

Virtual tracks merge data from multiple source repos:
- Weeks: concatenate tracks from all source repos
- History: sum doneChecks/totalChecks per date across sources
- Changelog: merge and sort by date descending
- PRD: keep separate per source (prdPerTrack array)

## Edit Log

Location: `data/.edit-log.json`

```json
[
  {
    "timestamp": "string — ISO 8601",
    "track": "string — repo id",
    "action": "string — 'check' | 'uncheck' | 'add-step' | 'add-phase' | 'add-check' | 'rename' | 'delete'",
    "path": "string — e.g. 'W1 > step-name > phase-name > item-text'",
    "detail": "string — what changed"
  }
]
```

Items edited manually get `"source": "manual"` in the check item.
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `cat skills/project-dashboard/references/data-schema.md | head -5`
Expected: Shows the title and first few lines

- [ ] **Step 3: Commit**

```bash
git add skills/project-dashboard/references/data-schema.md
git commit -m "feat(skill): add data schema reference for project-dashboard"
```

---

### Task 2: Main Skill Router

**Files:**
- Create: `skills/project-dashboard/project-dashboard.md`

The main skill file that routes to subcommand modules.

- [ ] **Step 1: Create the main skill file**

```markdown
---
name: project-dashboard
description: Team project progress dashboard — create, manage, and monitor workflow dashboards with multi-source data sync. Subcommands: init, sync, status, config, edit. Use when asked to "project dashboard", "track progress", "workflow dashboard", "team progress", or "project status board".
---

# Project Dashboard

Manage team project workflow dashboards. Track progress across repos, sync data from multiple sources, and visualize completion status.

## Subcommands

Parse the ARGUMENTS to determine which subcommand to run:

| Argument starts with | Action |
|---|---|
| `init` | Read `modules/init.md` and follow it |
| `sync` | Read `modules/sync.md` and follow it |
| `status` | Read `modules/status.md` and follow it |
| `config` | Read `modules/config.md` and follow it |
| `edit` | Read `modules/edit.md` and follow it |
| (empty or `help`) | Show the help below |

**To read a module:** Use the Read tool on the module file path relative to this skill's directory. The module file contains complete instructions for that subcommand.

## Help Output

If no subcommand is provided, show this:

```
📊 /project-dashboard — Team Workflow Dashboard

Subcommands:
  init      Create a new dashboard project (scaffolding)
  sync      Sync data from external sources (GitHub, Notion, Linear)
  status    View progress in terminal
  config    Manage repos, tracks, periods, columns
  edit      Edit check items, steps, phases directly

Examples:
  /project-dashboard status
  /project-dashboard status synapse-platform-svc
  /project-dashboard config add-repo
  /project-dashboard edit synapse-frontend --check "API 연동"

Run /project-dashboard <subcommand> for detailed help.
```

## Project Detection

Before running any subcommand (except `init`), verify this is a dashboard project:

1. Check if `data/config.json` exists in the current working directory
2. If not found, tell the user: "No dashboard project found in this directory. Run `/project-dashboard init` to create one."
3. If found, read it and pass the config to the subcommand module

## Data Schema

The full data contract is documented in `references/data-schema.md`. Read it when you need to understand the structure of config.json or data/*.json files.
```

- [ ] **Step 2: Verify the file**

Run: `head -3 skills/project-dashboard/project-dashboard.md`
Expected: Shows the YAML frontmatter start

- [ ] **Step 3: Commit**

```bash
git add skills/project-dashboard/project-dashboard.md
git commit -m "feat(skill): add main project-dashboard router"
```

---

### Task 3: Status Module

**Files:**
- Create: `skills/project-dashboard/modules/status.md`

- [ ] **Step 1: Create the status module**

```markdown
# Status Module

Display project progress in the terminal. Reads `data/config.json` and `data/*.json` files to calculate and render progress.

## Arguments

Parse remaining arguments after `status`:

| Pattern | Action |
|---|---|
| (empty) | Show all-tracks summary |
| `{track-id}` | Show detailed view for one track |
| `--week {id}` | Filter to specific period (e.g. `--week W3`) |
| `--compare` | Show delta since last history entry |

## All-Tracks Summary

1. Read `data/config.json` to get the list of repos and virtual tracks
2. For each repo, read `data/{repo-id}.json`
3. For virtual tracks, read all source repo files and merge:
   - Sum totalChecks and doneChecks across source repos
4. Calculate per-track progress: `doneChecks / totalChecks * 100`
5. Calculate overall progress: sum of all doneChecks / sum of all totalChecks

**Output format:**

```
📊 {project.name} — 전체 진행률: {overall}%

트랙                     진행률    이번 주 변화
─────────────────────────────────────────────
{trackName}     {bar}  {pct}%   {delta}
...
```

**Progress bar:** 10 characters wide. Use `█` for filled, `░` for empty.
Calculate filled count: `Math.round(pct / 10)`

**Delta calculation:** Compare current doneChecks with the second-to-last history entry.
If only one history entry exists, show `—` instead of delta.

**Color bands** (use in text output descriptions):
- 90-100%: green/success
- 60-89%: blue/info
- 30-59%: orange/warning
- 1-29%: red/danger
- 0%: gray

## Track Detail View

When a track ID is provided:

1. Read the track's data file (or merge virtual track sources)
2. Show per-week breakdown with steps

**Output format:**

```
📋 {trackName} — {overall_pct}%

{week_id} ({period}):
  Step 1: {step_name}   {step_bar} {step_pct}%  {✅ if 100%}
    - Phase 1: {phase_name}   {✅ if done==total} {done}/{total}
    - Phase 2: {phase_name}   🔲 {done}/{total}
  Step 2: {step_name}   {step_bar} {step_pct}%
    ...
```

**Step bar:** 12 characters wide.

## Week Filter (--week)

When `--week {id}` is provided, only show data for that specific period.
Apply to both summary and detail views.

## Compare Mode (--compare)

When `--compare` is provided, show deltas for each metric:
- Read the last two `history` entries per track
- Calculate: `current_done - previous_done` as absolute change
- Calculate: `current_pct - previous_pct` as percentage change
- Show: `+{n} items (+{pct}%)` or `unchanged` if no change

## Reading Data Files

1. Read `data/config.json` using the Read tool
2. Parse JSON to get repos list
3. For each repo in config, read `data/{repo.id}.json` (or `data/{repo.repo}.json` for legacy format)
4. Parse JSON and extract tracks/weeks/steps/phases

**Legacy format detection:** If config has `repos[].tracks` array (not `repos[].trackName`), it's legacy format. Adapt reading logic:
- Legacy: `config.repos[i].repo` → file is `data/{repo}.json`
- New: `config.repos[i].id` → file is `data/{id}.json`
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/modules/status.md
git commit -m "feat(skill): add status module for terminal progress display"
```

---

### Task 4: Config Module

**Files:**
- Create: `skills/project-dashboard/modules/config.md`

- [ ] **Step 1: Create the config module**

```markdown
# Config Module

Manage the project dashboard configuration. All changes modify `data/config.json`.

## Arguments

Parse remaining arguments after `config`:

| Pattern | Action |
|---|---|
| (empty) | Show current config summary |
| `add-repo` | Add a new repo/track |
| `remove-repo` | Remove a repo/track |
| `add-virtual-track` | Create a virtual track |
| `remove-virtual-track` | Remove a virtual track |
| `set-weeks` | Change period structure |
| `set-columns` | Change column structure |
| `set-source` | Change a track's data source |
| `migrate` | Migrate legacy config to new format |

## Show Config Summary

Read `data/config.json` and display:

```
⚙️ Dashboard Configuration

Project: {project.name}
Periods: {periods.length} ({first.id} ~ {last.id})
Columns: {columns.map(c => c.label).join(', ')}

Repos ({repos.length}):
  {id} — {trackName} ({owner}) [{source.type}]
  ...

Virtual Tracks ({virtualTracks.length}):
  {id} — {trackName} ({owner}) ← [{sources.join(', ')}]
  ...
```

## Safety Protocol

Before ANY config modification:

1. Read the current `data/config.json`
2. Save a backup by writing the current content to `data/config.json.bak`
3. Make the modification
4. Write the updated config to `data/config.json`
5. Run validation: `node scripts/validate-data.mjs` (if the script exists)
6. If validation fails:
   - Show the error to the user
   - Ask if they want to rollback
   - If yes, restore from `config.json.bak`

## Add Repo

Ask the user for each field (one at a time):

1. **Repo ID**: identifier used for the data filename (e.g., `synapse-notification-svc`)
2. **Track display name**: shown in the dashboard (e.g., `알림 서비스`)
3. **Owner**: person responsible (e.g., `김철수`)
4. **Data source type**: `github-markdown` / `notion` / `linear` / `manual`
5. Based on source type, ask for source-specific fields:
   - github-markdown: `repo` (org/repo), `path` (workflow dir)
   - notion: `databaseId`
   - linear: `projectId`
   - manual: no additional fields

Then:
1. Add the new repo entry to `config.repos` array
2. Create an empty data file at `data/{repo-id}.json`:

```json
{
  "repo": "{repo-id}",
  "updatedAt": "{current ISO timestamp}",
  "tracks": [
    {
      "name": "{trackName}",
      "owner": "{owner}",
      "weeks": []
    }
  ],
  "prd": [],
  "history": [],
  "changelog": []
}
```

3. Write updated config
4. Run validation
5. Report success

## Remove Repo

1. Show numbered list of current repos
2. Ask which to remove
3. Confirm: "This will remove {id} from config. Delete data/{id}.json too? (y/n)"
4. Remove from config.repos
5. If confirmed, delete the data file
6. Also check virtualTracks — if any reference this repo, warn the user
7. Write updated config

## Add Virtual Track

1. Ask for virtual track ID
2. Ask for display name
3. Ask for owner
4. Show list of available repos, ask which to combine (comma-separated selection)
5. Add to config.virtualTracks
6. Write updated config

## Remove Virtual Track

1. Show numbered list of virtual tracks
2. Ask which to remove
3. Remove from config.virtualTracks
4. Write updated config

## Set Weeks (set-weeks)

1. Show current periods
2. Ask: "How many periods?" (default: current count)
3. For each period, ask: id, label, start date, end date
   - Or offer: "Auto-generate {n} weekly periods starting from {date}?"
4. Replace config.periods
5. Write updated config
6. Warn: "Existing data files reference old period IDs. You may need to update them."

## Set Columns (set-columns)

1. Show current columns
2. Ask: "Define columns (format: id:label:type, comma-separated)"
   - Example: `prd:PRD:list, task:Task:checklist, workflow:Workflow:checklist`
3. Replace config.columns
4. Write updated config

## Set Source (set-source)

1. Ask which repo to update (show list)
2. Ask for new source type
3. Ask for source-specific fields
4. Update the repo's source field
5. Write updated config

## Migrate Legacy Config

Convert old format to new format:

1. Read current config
2. Detect legacy format: has `repos[].tracks` array instead of `repos[].id`
3. If already new format, say so and exit
4. Transform:
   - Add `project: { name: "{directory name} Dashboard", description: "" }`
   - Add `periods` from WEEKS_META in useData.ts (read the file to extract them)
   - Add `columns: [{ id: "prd", label: "PRD", type: "list" }, { id: "task", label: "Task", type: "checklist" }, { id: "workflow", label: "Workflow", type: "checklist" }]`
   - Flatten `repos[].tracks` into individual repo entries with `id`, `trackName`, `owner`
   - Convert `virtualTracks` to new format
5. Show the transformed config to the user for approval
6. Write updated config

## Legacy Format Handling

When reading config, check format:
- **New format**: has `repos[].id` field → use directly
- **Legacy format**: has `repos[].tracks` array → adapt reading logic but don't auto-migrate
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/modules/config.md
git commit -m "feat(skill): add config module for dashboard settings management"
```

---

### Task 5: Edit Module

**Files:**
- Create: `skills/project-dashboard/modules/edit.md`

- [ ] **Step 1: Create the edit module**

```markdown
# Edit Module

Directly edit data in `data/*.json` files. For manual progress updates when external sync is not available or when corrections are needed.

## Arguments

Parse remaining arguments after `edit`:

| Pattern | Action |
|---|---|
| (empty) | Interactive mode — ask which track to edit |
| `{track-id}` | Edit specific track interactively |
| `{track-id} --check {item}` | Mark a check item as done |
| `{track-id} --uncheck {item}` | Mark a check item as not done |
| `{track-id} --add-step` | Add a new step |
| `{track-id} --add-phase` | Add a phase to a step |
| `{track-id} --add-check` | Add a check item to a phase |

## Interactive Mode

1. Read `data/config.json` to get repo list
2. Show numbered list of tracks (repos + virtual tracks)
3. Ask user to select a track
4. Read `data/{track-id}.json`
5. Show current week status (find the most recent week with activity, or the latest period):

```
현재 {week_id} ({period}) 기준:

  1. Step 1: {step_name}       ✅ 완료
  2. Step 2: {step_name}       75%
  3. Step 3: {step_name}       50%

어떤 작업을 하시겠습니까?
  a) 체크아이템 상태 변경
  b) 새 스텝 추가
  c) 새 페이즈 추가
  d) 새 체크아이템 추가
  e) 항목 이름 수정
  f) 항목 삭제
  g) 다른 주차 선택
```

6. Based on selection, follow the corresponding action below
7. After each edit, show updated progress and ask if more edits are needed

## Action: Check/Uncheck Item

**Quick mode** (`--check` / `--uncheck`):
1. Read the track data file
2. Search all weeks/steps/phases/items for an item whose `text` contains the search string
3. If multiple matches, show them and ask which one
4. Toggle the `done` field
5. Recalculate `phase.done`, `step.doneChecks`, `week.doneChecks`
6. Write the updated file
7. Log to edit log

**Interactive mode** (option a):
1. Ask which week (show list)
2. Ask which step (show list with progress)
3. Ask which phase (show list with done/total)
4. Show all check items with current status
5. Ask which to toggle (support multiple: "1,3,5" or "all")
6. Toggle and recalculate
7. Write and log

## Action: Add Step

1. Ask which week to add the step to
2. Ask for step name
3. Ask for initial status: Done / In Progress / Not Started (default: Not Started)
4. Create the step object:

```json
{
  "name": "{step_name}",
  "status": "{status}",
  "phases": [],
  "totalChecks": 0,
  "doneChecks": 0
}
```

5. Append to the week's steps array
6. Write and log

## Action: Add Phase

1. Ask which week
2. Ask which step (show list)
3. Ask for phase name
4. Create the phase object:

```json
{
  "name": "{phase_name}",
  "total": 0,
  "done": 0,
  "items": []
}
```

5. Append to the step's phases array
6. Write and log

## Action: Add Check Item

1. Ask which week
2. Ask which step
3. Ask which phase
4. Ask for check item text
5. Ask if done (default: no)
6. Create the item:

```json
{
  "text": "{item_text}",
  "done": false,
  "source": "manual"
}
```

7. Append to phase.items
8. Update phase.total += 1, phase.done += (done ? 1 : 0)
9. Recalculate step.totalChecks, step.doneChecks, week.totalChecks, week.doneChecks
10. Write and log

## Action: Rename

1. Navigate to the target (week > step > phase > item)
2. Show current name
3. Ask for new name
4. Update the name/text field
5. Write and log

## Action: Delete

1. Navigate to the target
2. Confirm: "Delete '{name}'? This cannot be undone. (y/n)"
3. Remove from parent array
4. Recalculate all counts up the tree
5. Write and log

## Recalculation Rules

After any edit, recalculate bottom-up:

```
phase.total = phase.items.length
phase.done = phase.items.filter(i => i.done).length

step.totalChecks = sum(step.phases.map(p => p.total))
step.doneChecks = sum(step.phases.map(p => p.done))
step.status = doneChecks === totalChecks ? 'Done'
            : doneChecks > 0 ? 'In Progress'
            : 'Not Started'

week.totalChecks = sum(week.steps.map(s => s.totalChecks))
week.doneChecks = sum(week.steps.map(s => s.doneChecks))
```

## Edit Log

After every edit, append to `data/.edit-log.json`:

1. Read existing log (or create empty array if file doesn't exist)
2. Append entry:

```json
{
  "timestamp": "{current ISO timestamp}",
  "track": "{repo-id}",
  "action": "{action type}",
  "path": "{week} > {step} > {phase} > {item}",
  "detail": "{what changed}"
}
```

3. Write updated log

## Writing Data Files

When writing `data/{track}.json`:
1. Read current file content
2. Make modifications in memory
3. Update `updatedAt` to current ISO timestamp
4. Write with 2-space JSON indentation
5. Report: "✅ {track-id} 업데이트 완료. 진행률: {old_pct}% → {new_pct}%"

## Virtual Track Editing

Virtual tracks cannot be edited directly. If user selects a virtual track:
1. Show which source repos compose it
2. Ask which source repo to edit
3. Proceed with that repo's data file
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/modules/edit.md
git commit -m "feat(skill): add edit module for interactive data editing"
```

---

### Task 6: Validation Script Update

**Files:**
- Modify: `scripts/validate-data.mjs`

Update the existing validation script to support the new config format while remaining backward-compatible.

- [ ] **Step 1: Read the current validate-data.mjs**

Run: `cat scripts/validate-data.mjs`

Understand the current validation logic before modifying.

- [ ] **Step 2: Add new-format config detection**

Add a function at the top of the script that detects config format:

```javascript
function detectConfigFormat(config) {
  if (config.repos?.[0]?.id) return 'new';
  if (config.repos?.[0]?.repo) return 'legacy';
  return 'unknown';
}
```

- [ ] **Step 3: Add new-format validation**

Add validation for new config format fields:

```javascript
function validateNewConfig(config) {
  const errors = [];
  
  if (!config.project?.name) {
    errors.push('config.project.name is required');
  }
  
  if (!Array.isArray(config.periods) || config.periods.length === 0) {
    errors.push('config.periods must be a non-empty array');
  }
  
  for (const period of (config.periods || [])) {
    if (!period.id || !period.start || !period.end) {
      errors.push(`Period missing required fields: ${JSON.stringify(period)}`);
    }
  }
  
  if (!Array.isArray(config.columns) || config.columns.length === 0) {
    errors.push('config.columns must be a non-empty array');
  }
  
  for (const col of (config.columns || [])) {
    if (!col.id || !col.label || !col.type) {
      errors.push(`Column missing required fields: ${JSON.stringify(col)}`);
    }
    if (!['list', 'checklist', 'kanban'].includes(col.type)) {
      errors.push(`Unknown column type: ${col.type}`);
    }
  }
  
  for (const repo of (config.repos || [])) {
    if (!repo.id || !repo.trackName || !repo.owner) {
      errors.push(`Repo missing required fields: ${JSON.stringify(repo)}`);
    }
  }
  
  return errors;
}
```

- [ ] **Step 4: Integrate format detection into main validation flow**

In the main validation flow, after reading config:

```javascript
const format = detectConfigFormat(config);
if (format === 'new') {
  const configErrors = validateNewConfig(config);
  if (configErrors.length > 0) {
    configErrors.forEach(e => console.error(`  ❌ ${e}`));
    process.exitCode = 1;
  }
}
// existing legacy validation continues below
```

- [ ] **Step 5: Run validation to verify backward compatibility**

Run: `node scripts/validate-data.mjs`
Expected: Current data still passes validation (legacy format)

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-data.mjs
git commit -m "feat: extend validate-data to support new config format"
```

---

### Task 7: Smoke Test with Current Project

**Files:**
- No new files — testing the skill against the current Synapse project

- [ ] **Step 1: Verify skill file structure is complete**

Run: `find skills/project-dashboard -type f | sort`

Expected output:
```
skills/project-dashboard/modules/config.md
skills/project-dashboard/modules/edit.md
skills/project-dashboard/modules/status.md
skills/project-dashboard/project-dashboard.md
skills/project-dashboard/references/data-schema.md
```

- [ ] **Step 2: Verify data/config.json is readable**

Run: `node -e "const c = JSON.parse(require('fs').readFileSync('data/config.json','utf8')); console.log('Repos:', c.repos.length, 'VTracks:', c.virtualTracks.length)"`

Expected: `Repos: 7 VTracks: 1`

- [ ] **Step 3: Verify data files are readable and parseable**

Run: `node -e "const fs=require('fs'); const files=fs.readdirSync('data').filter(f=>f.endsWith('.json')&&f!=='config.json'); files.forEach(f=>{const d=JSON.parse(fs.readFileSync('data/'+f,'utf8')); const tc=d.tracks?.[0]?.weeks?.reduce((s,w)=>s+w.totalChecks,0)||0; const dc=d.tracks?.[0]?.weeks?.reduce((s,w)=>s+w.doneChecks,0)||0; console.log(f.padEnd(30), dc+'/'+tc, tc>0?Math.round(dc/tc*100)+'%':'N/A')})"`

Expected: Lists all data files with their progress percentages

- [ ] **Step 4: Run existing validation**

Run: `npm run validate:data`
Expected: Passes (possibly with warnings for missing weeks, which is expected)

- [ ] **Step 5: Commit any final adjustments**

If any fixes were needed during smoke testing, commit them:

```bash
git add -A
git commit -m "fix(skill): adjustments from smoke testing"
```

---

## Plan Summary

| Task | What it creates | Depends on |
|---|---|---|
| Task 1 | `references/data-schema.md` | — |
| Task 2 | `project-dashboard.md` (router) | Task 1 |
| Task 3 | `modules/status.md` | Task 1 |
| Task 4 | `modules/config.md` | Task 1 |
| Task 5 | `modules/edit.md` | Task 1 |
| Task 6 | Updated `validate-data.mjs` | Task 1 |
| Task 7 | Smoke test verification | Tasks 1-6 |

## What's NOT in this plan (deferred to Phase 2 & 3)

- **`modules/sync.md`** — requires parser system (Phase 2)
- **`modules/init.md`** — requires scaffold templates (Phase 3)
- **`templates/`** — requires frontend generalization (Phase 3)
- **Notion/Linear parsers** — requires external API integration (Phase 2)
- **GitHub Actions workflow template** — requires init module (Phase 3)
