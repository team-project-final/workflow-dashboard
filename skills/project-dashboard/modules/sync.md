# Sync Module

Synchronize data from external sources into `data/*.json` files. Uses the parser system in `scripts/parsers/` for data transformation.

## Arguments

Parse remaining arguments after `sync`:

| Pattern | Action |
|---|---|
| (empty) | Sync all repos |
| `{repo-id}` | Sync only this repo |
| `{repo1},{repo2},...` | 콤마 구분으로 여러 레포 동기화 |
| `--dry-run` | Preview changes without writing files |
| `--force` | md5 비교 우회 + history/changelog 재계산 |
| `--force {repo1},{repo2}` | 특정 레포만 강제 동기화 |

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
   node --input-type=module -e "
     import parser from './scripts/parsers/notion.mjs';
     import { readFileSync } from 'fs';
     const raw = JSON.parse(readFileSync('/tmp/notion-data.json', 'utf-8'));
     const result = parser.transform(raw, { mapping: ${JSON.stringify(source.mapping)}, periodMap: ${JSON.stringify(periodMap)} });
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

## Force Sync

강제 동기화는 md5 체크섬 비교를 우회하고 history/changelog를 재계산한다. 데이터가 의심스럽거나 history가 꼬였을 때 사용한다.

### 동작 차이

| | 일반 sync | 강제 sync |
|---|---|---|
| md5 비교 | 변경 시만 커밋 | 우회 — 항상 처리 |
| updatedAt | 변경 시만 갱신 | 항상 갱신 |
| history | 기존에 append | 전체 재계산 |
| changelog | diff 기반 추가 | 전체 재계산 |
| 커밋 메시지 | `- update repo (branch) from sha` | `- update repo (branch) from sha [force]` |

### 실행 경로 1: 로컬

```bash
# 전체 레포 강제 동기화
DOCS_DIR=/path/to/docs npm run sync -- --force

# 특정 레포만
DOCS_DIR=/path/to/docs npm run sync -- --force synapse-platform-svc
```

### 실행 경로 2: GitHub Actions (원격 트리거)

GitHub Actions `workflow_dispatch` API를 호출한다. PAT(Personal Access Token)가 필요하다.

```bash
curl -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/team-project-final/workflow-dashboard/actions/workflows/sync-data.yml/dispatches \
  -d '{"ref":"main","inputs":{"repos":"synapse-platform-svc,synapse-frontend","force":"true"}}'
```

### 실행 경로 3: 대시보드 Settings UI

1. Settings → 강제 동기화 탭 이동
2. PAT 등록 (최초 1회, localStorage에 저장)
3. 레포 목록에서 대상 선택 (체크박스 다중 선택)
4. "강제 동기화 실행" 버튼 클릭
5. RunStatusPanel에서 진행 상황 폴링 확인

> **Note:** 강제 동기화 UI 컴포넌트(ForceSyncTab, PatRegister 등)는 기본 scaffold에 포함되지 않습니다. 이 기능이 필요하면 Settings 페이지(`src/pages/Settings.tsx`)에 새 탭을 추가하여 구현하세요.

## Batch Sync for GitHub Actions

When running in CI (detected by `GITHUB_ACTIONS` env var):

1. The GitHub Actions workflow handles repo fetching and DOCS_DIR setup
2. Run: `node scripts/sync.mjs` (no interactive prompts)
3. All repos are processed automatically
4. Conflicts are resolved by preferring synced data (CI has no interactive input)
