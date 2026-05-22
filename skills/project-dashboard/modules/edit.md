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
2. Search all weeks/steps/phases/items for an item whose `text` matches the search string:
   - First try exact match (case-insensitive)
   - If no exact match, fall back to substring match (case-insensitive)
3. If multiple matches, show them numbered with their full path (week > step > phase) and ask which one
4. If no matches found, report: "'{search}' 항목을 찾을 수 없습니다."
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
