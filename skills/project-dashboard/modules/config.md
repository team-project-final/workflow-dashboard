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

For legacy format (without project/periods/columns), show what's available:

```
⚙️ Dashboard Configuration (legacy format)

Repos ({repos.length}):
  {repo} — {tracks.map(t => t.name + ' (' + t.owner + ')').join(', ')}
  ...

Virtual Tracks ({virtualTracks.length}):
  {name} ({owner}) ← [{sources.map(s => s.repo + ':' + s.track).join(', ')}]
  ...

💡 Run /project-dashboard config migrate to upgrade to new format.
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
6. Check virtualTracks — if any reference this repo in their `sources` array:
   - Show which virtual tracks are affected
   - Ask: "가상 트랙 '{virtualTrack.trackName}'에서 이 레포 참조를 제거할까요? (y/n)"
   - If yes, remove the repo ID from `virtualTrack.sources`
   - If the virtual track's `sources` becomes empty after removal, ask: "가상 트랙 '{virtualTrack.trackName}'에 남은 소스가 없습니다. 가상 트랙도 삭제할까요? (y/n)"
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
   - Add `periods` from WEEKS_META in `src/hooks/useData.ts` (read the file to extract them, look for `WEEKS_META` constant)
   - Add `columns: [{ id: "prd", label: "PRD", type: "list" }, { id: "task", label: "Task", type: "checklist" }, { id: "workflow", label: "Workflow", type: "checklist" }]`
   - Flatten `repos[].tracks` into individual repo entries with `id`, `trackName`, `owner`
   - Convert `virtualTracks` to new format with `id`, `trackName`, `owner`, `sources` (array of repo IDs)
5. Show the transformed config to the user for approval
6. Write updated config

## Legacy Format Handling

When reading config, check format:
- **New format**: has `repos[].id` field → use directly
- **Legacy format**: has `repos[].tracks` array → adapt reading logic but don't auto-migrate
