# Sync Deploy Validation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the frozen GitHub Pages deploy by making `validate-data.mjs` accept the `boxes_added` / `boxes_removed` changelog types the parser emits, and add a pre-commit validation gate to `sync-data.yml` so invalid data never reaches `main`.

**Architecture:** Two independent edits. (1) Widen the validator's `CHANGE_TYPES` whitelist — unblocks `Build & Deploy` immediately. (2) Insert `npm run validate:data` before `git add` in the sync workflow so `set -e` aborts the run on bad data. No new modules, no data migration.

**Tech Stack:** Node ESM scripts, GitHub Actions (bash steps), npm scripts.

---

## File Structure

- Modify: `scripts/validate-data.mjs` — add two entries to the `CHANGE_TYPES` Set (L71-79).
- Modify: `.github/workflows/sync-data.yml` — add a `validate:data` call inside the commit block (L154-160), before `git add`.

No files are created. No tests files are added — `validate-data.mjs` is a CLI script with no exported functions, so the real `data/*.json` (which contains the failing change types after the rebase) serves as the red/green fixture.

---

## Task 1: Sync local with remote and fix the validator

The remote `main` is ~28 commits ahead and contains the 06-01 data with the offending `boxes_added`/`boxes_removed` changelog entries. Local must be rebased onto it to reproduce the failure.

**Files:**
- Modify: `scripts/validate-data.mjs:71-79`

- [ ] **Step 1: Rebase local onto remote main**

Local has the spec/plan commits; remote has the fresh data. Rebase to combine.

```bash
git fetch origin main
git pull --rebase origin main
```

Expected: rebase succeeds, working tree now contains 06-01 `data/*.json` plus the local docs commits on top. If a conflict occurs it will only be in `docs/` — keep both sides.

- [ ] **Step 2: Reproduce the failure (red)**

Run: `npm run validate:data`

Expected: FAIL (exit 1) ending with `Data validation failed:` and multiple lines like:
```
- synapse-gitops.json: unknown changelog change type "boxes_removed"
- synapse-engagement-svc.json: unknown changelog change type "boxes_added"
```

This confirms local now reproduces exactly what `Build & Deploy` hits in CI.

- [ ] **Step 3: Add the two missing change types**

In `scripts/validate-data.mjs`, replace the `CHANGE_TYPES` Set (currently lines 71-79):

```js
const CHANGE_TYPES = new Set([
  'step_added',
  'step_deleted',
  'step_modified',
  'check_done',
  'check_undone',
  'phase_added',
  'phase_deleted',
])
```

with:

```js
const CHANGE_TYPES = new Set([
  'step_added',
  'step_deleted',
  'step_modified',
  'check_done',
  'check_undone',
  'phase_added',
  'phase_deleted',
  'boxes_added',    // 박스(체크 항목) 총개수 증가 — parse-workflow.mjs가 생성
  'boxes_removed',  // 박스(체크 항목) 총개수 감소 — parse-workflow.mjs가 생성
])
```

- [ ] **Step 4: Verify the fix (green)**

Run: `npm run validate:data`

Expected: PASS (exit 0) ending with `Data validation passed with N warning(s).`. The only remaining lines under `Data warnings:` should be the non-blocking `synapse-shared.json: team-lead is missing W5` (and any other pre-existing warnings) — NO `Data validation failed:` block.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-data.mjs
git commit -m "fix: accept boxes_added/boxes_removed changelog types in validator

Parser emits these two types but the validator whitelist rejected them,
failing validate:data and blocking Build & Deploy since 05-29.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add the pre-commit validation gate to the sync workflow

Make the sync workflow validate generated data before committing, so bad data is caught at the source instead of at deploy time.

**Files:**
- Modify: `.github/workflows/sync-data.yml:154-160`

- [ ] **Step 1: Insert the validate step before `git add`**

In `.github/workflows/sync-data.yml`, find this block (starts ~line 154):

```bash
          # 변경된 파일이 있으면 커밋
          if [ ${#UPDATED[@]} -gt 0 ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"

            git add data/*.json
```

Replace it with:

```bash
          # 변경된 파일이 있으면 커밋
          if [ ${#UPDATED[@]} -gt 0 ]; then
            # 커밋 전 데이터 검증 — 잘못된 데이터가 main에 들어가지 않도록 차단 (set -e로 실패 시 잡 중단)
            npm run validate:data

            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"

            git add data/*.json
```

Leave the rest of the block (the `git diff --cached --quiet` check, commit message build, push, and Build & Deploy dispatch) unchanged.

- [ ] **Step 2: Sanity-check YAML validity**

The whole script is one bash `run:` block, so indentation must stay at 12 spaces for the new lines. Verify the file still parses as YAML:

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/sync-data.yml','utf8');if(!/npm run validate:data/.test(s))throw new Error('validate step missing');if(s.indexOf('npm run validate:data')>s.indexOf('git add data/*.json'))throw new Error('validate must come before git add');console.log('OK: validate gate placed before git add')"`

Expected: prints `OK: validate gate placed before git add`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync-data.yml
git commit -m "ci: validate data before committing in sync workflow

Adds an npm run validate:data gate before git add so invalid data
fails the sync run instead of silently committing and breaking deploy.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Push and verify the deploy recovers

**Files:** none (verification only)

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

Expected: push succeeds. The push touches `scripts/**` and `.github/workflows/**`, which match `build.yml`'s `paths`, so `Build & Deploy` triggers automatically.

- [ ] **Step 2: Watch the Build & Deploy run**

Run: `gh run list --workflow "Build & Deploy" --limit 1`

Then watch the most recent run:

Run: `gh run watch $(gh run list --workflow "Build & Deploy" --limit 1 --json databaseId --jq '.[0].databaseId')`

Expected: run completes with `success` (the `validate:data` step now passes, `build` + `deploy` jobs both green).

- [ ] **Step 3: Confirm Pages shows current data**

Open the live dashboard (`https://team-project-final.github.io/workflow-dashboard/`) and confirm the overall progress / weekly table reflect 06-01 data, not 05-29. Cross-check one repo's `updatedAt` against `data/<repo>.json` on `main`.

Expected: dashboard reflects the latest synced data; the freeze is resolved.

---

## Notes

- **No data migration:** once the validator accepts the two types, the already-committed 06-01 data passes as-is.
- **Out of scope (separate cycles):** unused validator types cleanup (`step_modified`, `phase_added`, etc.), single-source-of-truth refactor for change types, the branch-selection heuristic causing cross-service branch drift, and the client `fetchRepoJson` localStorage-first behavior.
