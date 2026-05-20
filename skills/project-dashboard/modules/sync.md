# Sync Module

Synchronize data from external sources into `data/*.json` files. Uses the parser system in `scripts/parsers/` for data transformation.

## Arguments

Parse remaining arguments after `sync`:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `--dry-run` | Preview changes without writing files |

## Sync Flow

### Step 1: Read Config

1. Read `data/config.json`
2. Identify source type for each repo

### Step 2: Route by Source Type

For each repo (or the specified repo):

#### Source: `github-markdown`

1. Check if `DOCS_DIR` env var is set or if the sync script can locate the docs
2. If running locally:
   - Ask user: "GitHub 리포에서 최신 docs를 가져올까요? (gh CLI 필요)"
   - If yes, run:
     ```bash
     TMPDIR=$(mktemp -d)
     gh api "repos/{source.repo}/tarball" > "$TMPDIR/archive.tar.gz"
     tar -xzf "$TMPDIR/archive.tar.gz" -C "$TMPDIR"
     ```
   - Set DOCS_DIR to extracted path
3. Run: `DOCS_DIR="$docsPath" node scripts/sync.mjs {repo-id}`
4. If `--dry-run`, add `--dry-run` flag

#### Source: `notion`

1. Read the repo's `source.databaseId` and `source.mapping` from config
2. Use Notion MCP tools to query the database:
   - Call `notion-fetch` with the database URL
   - Extract pages with their properties
3. Format the response as `{ pages: [...] }` matching the Notion parser's expected input
4. Write a temporary JSON file with the Notion data
5. Run the transform step via Node.js:
   ```bash
   node -e "
     import parser from './scripts/parsers/notion.mjs';
     const raw = JSON.parse(require('fs').readFileSync('/tmp/notion-data.json'));
     const result = parser.transform(raw, { mapping: {source.mapping}, periodMap: {periodMap} });
     console.log(JSON.stringify(result));
   "
   ```
6. Merge the result into `data/{repo-id}.json` (preserve history, append changelog)

#### Source: `linear`

1. Read the repo's `source.projectId` from config
2. Ask user for Linear API token if not in environment (`LINEAR_API_KEY`)
3. Execute the GraphQL query from the parser:
   ```bash
   curl -s -X POST https://api.linear.app/graphql \
     -H "Authorization: $LINEAR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"query": "...", "variables": {"projectId": "{source.projectId}"}}'
   ```
4. Pass the response to the Linear parser's transform function
5. Merge the result into `data/{repo-id}.json`

#### Source: `manual`

Skip — manual sources are edited via `/project-dashboard edit`.

### Step 3: Post-Sync

1. Run `node scripts/validate-data.mjs` to verify data integrity
2. Show summary:

```
📊 Sync 완료

트랙                       결과     변경
────────────────────────────────────────
synapse-platform-svc      ✅ 동기화   +5 checks
synapse-frontend          ✅ 동기화   +12 checks
synapse-knowledge-svc     ⏭️ 변경없음  —
notification-svc          ❌ 오류     DOCS_DIR 미설정
```

3. If any errors occurred, show them with suggested fixes

## Conflict Detection

When merging synced data with existing data:

1. Read existing `data/{repo-id}.json`
2. Check for items with `"source": "manual"` (edited via `/project-dashboard edit`)
3. If the synced data changes an item that was manually edited:
   - Show the conflict: "'{item.text}' was manually set to {done/not done} but sync says {opposite}"
   - Ask: "Keep manual edit / Use synced value / Skip this item"
4. Apply the user's choice

## Batch Sync for GitHub Actions

When running in CI (detected by `GITHUB_ACTIONS` env var):

1. The GitHub Actions workflow handles repo fetching and DOCS_DIR setup
2. Run: `node scripts/sync.mjs` (no interactive prompts)
3. All repos are processed automatically
4. Conflicts are resolved by preferring synced data (CI has no interactive input)
