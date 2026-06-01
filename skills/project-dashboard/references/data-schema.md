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
  ],
  "basePath": "string — deploy base path (default: '/'), e.g. '/my-dashboard/' for GitHub Pages subdirectory"
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
                      "done": "boolean",
                      "source": "string — optional. 'manual' if edited via /project-dashboard edit, 'sync' if from external sync. Omitted for legacy items."
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
          "type": "change type id — 단일 소스: src/constants/changeTypes.js (step_added, step_deleted, step_modified, check_done, check_undone, phase_added, phase_deleted, boxes_added, boxes_removed)",
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

## Edit Log vs Changelog

These are two separate change tracking mechanisms:

| | Edit Log | Changelog |
|---|---|---|
| Location | `data/.edit-log.json` | `data/{repo-id}.json → changelog[]` |
| Written by | `/project-dashboard edit` (manual edits) | `/project-dashboard sync` (external sync) |
| Scope | Cross-repo (single file for all tracks) | Per-repo (embedded in each data file) |
| Purpose | Audit trail for manual edits | Git-based change history from source repos |
| Includes | User actions (check, uncheck, add, delete) | Commit-level diffs (step_added, check_done, boxes_added, etc.) |

Manual edits are **not** written to `changelog[]`. The changelog only captures changes from external sync operations. To see a complete history of all changes, consult both sources.
