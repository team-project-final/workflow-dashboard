---
name: project-dashboard
description: Team project progress dashboard — create, manage, and monitor workflow dashboards with multi-source data sync. Subcommands: init, sync, status, config, edit. Use when asked to "project dashboard", "track progress", "workflow dashboard", "team progress", "project status board", "진행률 확인", "프로젝트 현황", "대시보드 만들기", "데이터 동기화", "워크플로우 대시보드", "팀 진행 상황", or "프로젝트 현황판".
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
