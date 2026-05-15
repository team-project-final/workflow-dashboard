# Synapse Workflow Dashboard

Synapse team workflow status dashboard for GitHub Pages.

The app reads static JSON files from `data/` and renders:

- overall progress across all services
- track cards by owner
- weekly progress table
- progress trend chart
- repository detail pages with PRD, TASK, WORKFLOW, and changelog tabs

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Chart.js
- GitHub Pages

## Local Setup

```bash
npm install
npm run dev
```

Vite serves the app at:

```text
http://127.0.0.1:5173/workflow-dashboard/
```

The app uses `HashRouter`, so detail pages look like:

```text
http://127.0.0.1:5173/workflow-dashboard/#/detail/synapse-platform-svc
```

## Checks

Run all local checks before pushing:

```bash
npm run lint
npm run validate:data
npm run build
```

`npm run validate:data` checks every `data/*.json` file for:

- expected repo files
- expected track names
- PRD weeks W1-W5
- unknown week names
- week total versus step totals
- step total versus phase totals
- changelog entry shape and known change types

Missing `tracks[].weeks` entries are currently warnings, not hard failures. The app normalizes missing weeks into explicit empty weeks so the UI stays consistent for W1-W5.

## Data Contract

The dashboard operates on five project weeks:

| Week | Period |
| --- | --- |
| W1 | 05-12~05-16 |
| W2 | 05-19~05-23 |
| W3 | 05-26~05-29 |
| W4 | 06-01~06-05 |
| W5 | 06-08~06-12 |

Each repo file should follow this shape:

```json
{
  "repo": "synapse-platform-svc",
  "updatedAt": "2026-05-15T06:29:18.823Z",
  "tracks": [
    {
      "name": "platform",
      "owner": "김해준",
      "weeks": [
        {
          "week": "W1",
          "period": "05-12~05-16",
          "steps": [],
          "totalChecks": 0,
          "doneChecks": 0
        }
      ]
    }
  ],
  "prd": [
    {
      "week": "W1",
      "items": []
    }
  ],
  "history": [],
  "changelog": []
}
```

Expected repo files:

- `data/synapse-platform-svc.json`
- `data/synapse-engagement-svc.json`
- `data/synapse-knowledge-svc.json`
- `data/synapse-learning-svc.json`
- `data/synapse-frontend.json`
- `data/synapse-shared.json`

Expected tracks:

| Repo | Tracks |
| --- | --- |
| `synapse-platform-svc` | `platform` |
| `synapse-engagement-svc` | `engagement` |
| `synapse-knowledge-svc` | `knowledge-1`, `knowledge-2` |
| `synapse-learning-svc` | `learning-card`, `learning-ai` |
| `synapse-frontend` | `frontend` |
| `synapse-shared` | `team-lead` |

## Data Updates

After updating JSON files:

```bash
npm run validate:data
npm run build
```

If `validate:data` reports warnings for missing track weeks, the dashboard will still render those weeks as empty. If it reports errors, fix the JSON before pushing.

## Deployment

Deployment is handled by `.github/workflows/build.yml`.

On push to `main`, GitHub Actions:

1. installs dependencies with `npm ci`
2. runs `npm run lint`
3. runs `npm run validate:data`
4. runs `npm run build`
5. copies `data/` into `dist/data`
6. deploys `dist/` to GitHub Pages

The Vite base path is configured as `/workflow-dashboard/` in `vite.config.ts`.
