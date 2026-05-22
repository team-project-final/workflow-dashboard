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

## Risk Highlights

After rendering the summary or detail view, scan the data for risks and append a section:

1. **Delayed tracks**: Any track below 30% in the current or past weeks (danger band)
2. **Unstarted weeks**: Any week that should have started (based on period dates vs today) but has 0% progress
3. **Stalled tracks**: Tracks where the latest two history entries show zero change (no progress)

**Output format** (append after the main view):

```
⚠️ 주요 리스크

- {trackName}: {current_pct}% — {reason}
  (예: "frontend: 12% — W1, W2 모두 목표 대비 지연")
- {trackName}: W{n} 미시작 — 시작일({start_date}) 경과
```

If no risks are found, omit this section entirely.

## Reading Data Files

1. Read `data/config.json` using the Read tool
2. Parse JSON to get repos list
3. For each repo in config, read `data/{repo.id}.json` (or `data/{repo.repo}.json` for legacy format)
4. Parse JSON and extract tracks/weeks/steps/phases

**Legacy format detection:** If config has `repos[].tracks` array (not `repos[].trackName`), it's legacy format. Adapt reading logic:
- Legacy: `config.repos[i].repo` → file is `data/{repo}.json`
- New: `config.repos[i].id` → file is `data/{id}.json`
