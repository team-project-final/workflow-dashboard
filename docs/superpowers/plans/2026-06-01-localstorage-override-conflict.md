# localStorage Override Conflict Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when synced server data is newer than a local DataEditor override (which currently masks it forever) and surface it on the main dashboard via a banner + per-card badge with one-click refresh, while keeping local-first rendering.

**Architecture:** `useData` fetches each configured repo's server JSON once, pairs it with the localStorage override, derives both the effective (local-first) render data and an `OverrideStatus[]`. A pure `computeOverrideStatus` helper decides `serverNewer` by comparing ISO `updatedAt` strings. The Dashboard renders an `<OverrideBanner>` and passes a `staleOverride` flag into each `<TrackCard>`. Refresh = remove the localStorage key(s) and re-run the effect.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind. No test runner for `.tsx`/`.ts` exists (project `npm test` only covers parser `.mjs` fixtures), so automated gates are `npm run lint` + `npm run build` (tsc), plus a manual browser verification checklist (consistent with prior specs in this repo).

---

## File Structure

- Create: `src/utils/overrideStatus.ts` — `OverrideStatus` type + pure `computeOverrideStatus`. Single responsibility: decide override/conflict state from two `RepoData` snapshots.
- Modify: `src/hooks/useData.ts` — fetch server-always, expose `overrides` + `clearOverrides`, add `version` to re-run. (`fetchRepoJson` stays for `useRepoData`.)
- Create: `src/components/OverrideBanner.tsx` — global conflict banner with refresh buttons.
- Modify: `src/components/TrackCard.tsx` — optional `staleOverride` badge.
- Modify: `src/pages/Dashboard.tsx` — wire overrides into banner + cards.

---

## Task 1: Pure `computeOverrideStatus` helper

**Files:**
- Create: `src/utils/overrideStatus.ts`

No `.ts` unit-test runner exists in this repo, so verification is tsc typecheck (Task 2's build) plus the documented input/output table below. The function is pure and total.

- [ ] **Step 1: Create the helper file**

Create `src/utils/overrideStatus.ts` with exactly:

```ts
import type { RepoData } from '../types'

export interface OverrideStatus {
  repo: string
  active: boolean
  serverNewer: boolean
  serverUpdatedAt: string
  overrideUpdatedAt: string
}

/**
 * Decide local-override / conflict state for one repo.
 * serverNewer is true only when a local override exists AND the server has a
 * timestamp strictly later than the override's (ISO 8601 → lexicographic compare).
 * Server fetch failure (server=null) yields serverNewer=false (no offline false-positive).
 */
export function computeOverrideStatus(
  repo: string,
  override: RepoData | null,
  server: RepoData | null,
): OverrideStatus {
  const active = !!override
  const overrideUpdatedAt = override?.updatedAt ?? ''
  const serverUpdatedAt = server?.updatedAt ?? ''
  const serverNewer = active && !!serverUpdatedAt && serverUpdatedAt > overrideUpdatedAt
  return { repo, active, serverNewer, serverUpdatedAt, overrideUpdatedAt }
}
```

- [ ] **Step 2: Verify correctness against the truth table (reasoning check)**

Confirm by inspection that the implementation yields:

| override | server | active | serverNewer |
|---|---|---|---|
| `null` | `{updatedAt:'2026-06-01'}` | false | false |
| `{updatedAt:'2026-05-29'}` | `{updatedAt:'2026-06-01'}` | true | **true** |
| `{updatedAt:'2026-06-01'}` | `{updatedAt:'2026-06-01'}` | true | false |
| `{updatedAt:'2026-06-01'}` | `null` (offline) | true | false |
| `{updatedAt:''}` (imported) | `{updatedAt:'2026-06-01'}` | true | **true** |

- [ ] **Step 3: Commit**

```bash
git add src/utils/overrideStatus.ts
git commit -m "feat: add computeOverrideStatus pure helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire override detection into `useData`

**Files:**
- Modify: `src/hooks/useData.ts`

This replaces the effect body so each configured repo's server JSON is fetched once and paired with its localStorage override — deriving effective render data AND `overrides` from the same fetch (no double fetch). `fetchRepoJson` is kept because `useRepoData` still uses it.

- [ ] **Step 1: Update imports**

At the top of `src/hooks/useData.ts`, change the React import line:
```ts
import { useState, useEffect } from 'react'
```
to:
```ts
import { useState, useEffect, useCallback } from 'react'
```

And add this import after the existing `import { useConfig } from './useConfig'` line:
```ts
import { computeOverrideStatus, type OverrideStatus } from '../utils/overrideStatus'
```

- [ ] **Step 2: Add a server-only fetch function**

Immediately after the existing `fetchRepoJson` function (the one that does `loadLocalData` first), add:

```ts
function fetchServerJson(repo: string): Promise<RepoData | null> {
  return fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
}
```

- [ ] **Step 3: Replace the entire `useData` function**

Replace the whole existing `export function useData() { ... }` (everything from `export function useData()` down to its closing `}` before `export function useRepoData`) with:

```ts
export function useData() {
  const { config, loading: configLoading } = useConfig()
  const [data, setData] = useState<RepoData[]>([])
  const [rawByRepo, setRawByRepo] = useState<Record<string, RepoData | null>>({})
  const [overrides, setOverrides] = useState<OverrideStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const clearOverrides = useCallback((repos: string[]) => {
    repos.forEach(r => localStorage.removeItem(LS_DATA_PREFIX + r))
    setVersion(v => v + 1)
  }, [])

  useEffect(() => {
    if (configLoading || !config) return

    const vtSourceRepos = new Set(config.virtualTracks.flatMap(vt => vt.sources.map(s => s.repo)))
    const regularRepos = config.repos.filter(r => !vtSourceRepos.has(r.repo))

    Promise.all(
      config.repos.map(def =>
        fetchServerJson(def.repo).then(server =>
          [def.repo, { local: loadLocalData(def.repo), server }] as const
        )
      )
    )
      .then(entries => {
        const layers = Object.fromEntries(entries) as Record<string, { local: RepoData | null; server: RepoData | null }>
        const effective = (repo: string): RepoData | null =>
          layers[repo]?.local ?? layers[repo]?.server ?? null

        const regularResults = regularRepos.map(def => normalizeRepoData(effective(def.repo), def))

        const vtResults = config.virtualTracks.map(vtDef => {
          const sourceDefs = vtDef.sources.map(s => {
            const repoDef = config.repos.find(r => r.repo === s.repo)
            return repoDef || { repo: s.repo, tracks: [{ name: s.track, owner: vtDef.owner }] }
          })
          return mergeVirtualTrackData(vtDef, sourceDefs.map(sd => effective(sd.repo)), sourceDefs)
        })

        const raws = Object.fromEntries(
          config.repos.map(def => [def.repo, effective(def.repo)]),
        ) as Record<string, RepoData | null>

        const ovr = config.repos.map(def =>
          computeOverrideStatus(def.repo, layers[def.repo].local, layers[def.repo].server),
        )

        setData([...regularResults, ...vtResults])
        setRawByRepo(raws)
        setOverrides(ovr)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [config, configLoading, version])

  const totalChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0), 0)
  const doneChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0), 0)
  const overallPercent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  return { data, rawByRepo, overrides, clearOverrides, loading, error, overallPercent, totalChecks, doneChecks }
}
```

Leave `useRepoData` and all module-level helpers (`loadLocalData`, `normalizeRepoData`, `mergeVirtualTrackData`, `fetchRepoJson`, etc.) unchanged.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run build`
Expected: `tsc -b` passes and `vite build` succeeds (no type errors). 

Run: `npm run lint`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useData.ts
git commit -m "feat: detect server-newer overrides in useData

Fetches each repo's server JSON once, pairs with the localStorage
override, exposes overrides[] + clearOverrides() while keeping
local-first render data.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `<OverrideBanner>` component

**Files:**
- Create: `src/components/OverrideBanner.tsx`

- [ ] **Step 1: Create the banner component**

Create `src/components/OverrideBanner.tsx` with exactly:

```tsx
import type { OverrideStatus } from '../utils/overrideStatus'

interface Props {
  overrides: OverrideStatus[]
  onRefresh: (repos: string[]) => void
}

function fmt(iso: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—'
}

export default function OverrideBanner({ overrides, onRefresh }: Props) {
  const stale = overrides.filter(o => o.serverNewer)
  if (stale.length === 0) return null

  return (
    <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-amber-800">
          ⚠️ 로컬에서 편집한 {stale.length}개 레포에 서버 최신본이 있습니다.
        </span>
        <button
          onClick={() => onRefresh(stale.map(o => o.repo))}
          className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-md font-medium"
        >
          전체 갱신
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {stale.map(o => (
          <li key={o.repo} className="flex items-center justify-between text-xs text-amber-800">
            <span>
              <span className="font-medium">{o.repo}</span>
              <span className="text-amber-600"> — 로컬 {fmt(o.overrideUpdatedAt)} → 서버 {fmt(o.serverUpdatedAt)}</span>
            </span>
            <button
              onClick={() => onRefresh([o.repo])}
              className="px-2 py-1 border border-amber-300 text-amber-700 rounded"
            >
              갱신
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: passes (component compiles; it is not yet rendered anywhere, which is fine).

- [ ] **Step 3: Commit**

```bash
git add src/components/OverrideBanner.tsx
git commit -m "feat: add OverrideBanner for stale local overrides

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `<TrackCard>` stale badge

**Files:**
- Modify: `src/components/TrackCard.tsx`

- [ ] **Step 1: Add the prop**

In `src/components/TrackCard.tsx`, change the props interface:
```ts
interface TrackCardProps {
  repoData: RepoData
  trackName: string
  owner: string
}
```
to:
```ts
interface TrackCardProps {
  repoData: RepoData
  trackName: string
  owner: string
  staleOverride?: boolean
}
```
And change the function signature:
```ts
export default function TrackCard({ repoData, trackName, owner }: TrackCardProps) {
```
to:
```ts
export default function TrackCard({ repoData, trackName, owner, staleOverride }: TrackCardProps) {
```

- [ ] **Step 2: Make the container relative and render the badge**

In the returned JSX, change the outer `<div>`'s className (the one with `onClick={() => navigate(...)}`) from:
```tsx
      className={`bg-white border-2 ${!hasData ? 'border-stone-200' : progressBorder(percent)} rounded-xl p-4 text-center cursor-pointer
        hover:shadow-lg transition-shadow`}
    >
```
to (add `relative` and insert the badge as the first child):
```tsx
      className={`relative bg-white border-2 ${!hasData ? 'border-stone-200' : progressBorder(percent)} rounded-xl p-4 text-center cursor-pointer
        hover:shadow-lg transition-shadow`}
    >
      {staleOverride && (
        <span
          title="서버에 더 최신 데이터가 있습니다"
          className="absolute top-1.5 right-1.5 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-semibold"
        >
          ●
        </span>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrackCard.tsx
git commit -m "feat: add stale-override badge to TrackCard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire banner + badges into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace the Dashboard component**

Replace the entire contents of `src/pages/Dashboard.tsx` with:

```tsx
import { useData } from '../hooks/useData'
import Header from '../components/Header'
import TrackCard from '../components/TrackCard'
import ProgressTable from '../components/ProgressTable'
import TimelineChart from '../components/TimelineChart'
import OverrideBanner from '../components/OverrideBanner'

export default function Dashboard() {
  const { data, loading, overallPercent, overrides, clearOverrides } = useData()

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>

  const staleSet = new Set(overrides.filter(o => o.serverNewer).map(o => o.repo))

  const trackEntries = data.flatMap(d => {
    if (d.tracks.length > 1 && d.tracks[0].owner === d.tracks[1]?.owner) {
      return [{ repoData: d, trackName: d.repo, owner: d.tracks[0].owner, repos: d.tracks.map(t => t.name) }]
    }
    return d.tracks.map(t => ({ repoData: d, trackName: t.name, owner: t.owner, repos: [d.repo] }))
  })

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} />

      <OverrideBanner overrides={overrides} onRefresh={clearOverrides} />

      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-stone-600 mb-2">트랙별 현황</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {trackEntries.map(e => (
            <TrackCard
              key={e.trackName}
              repoData={e.repoData}
              trackName={e.trackName}
              owner={e.owner}
              staleOverride={e.repos.some(r => staleSet.has(r))}
            />
          ))}
        </div>
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressTable data={data} />
        <TimelineChart data={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build`
Expected: passes (no type errors; `repos` is consumed locally, only declared props are passed to `<TrackCard>`).

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: surface stale overrides on dashboard banner + cards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build + lint gate**

Run: `npm run lint && npm run validate:data && npm run build`
Expected: all exit 0.

- [ ] **Step 2: Run the dev server and verify scenarios**

Start: `npm run dev` (serves `http://127.0.0.1:5173/workflow-dashboard/`). Verify in a browser:

1. Fresh load, no overrides → no banner, no card badges.
2. In Settings → 데이터 편집, toggle a check on one repo (e.g. `synapse-frontend`), return to dashboard → still NO banner (override `updatedAt` not older than server).
3. Simulate a newer server: in DevTools console run
   `(()=>{const k='dashboard-data-synapse-frontend';const o=JSON.parse(localStorage.getItem(k));o.updatedAt='2000-01-01T00:00:00.000Z';localStorage.setItem(k,JSON.stringify(o));})()`
   then reload → banner appears listing `synapse-frontend`, and that track's card shows the amber ● badge.
4. Click `갱신` on the banner row → banner row + card badge disappear; data now matches server.
5. Repeat with two repos overridden+staled → `전체 갱신` clears both.
6. team-lead card: override `synapse-gitops` and stale it (as in step 3) → team-lead card shows the badge; refreshing clears it.
7. Offline check: in DevTools Network set offline, reload → no banner (server fetch fails → no false positive), existing data still renders.

- [ ] **Step 2 note:** This plan does not push. After verification, integration/landing is handled separately (the user works on `main` directly per the prior decision and will confirm before any push).

---

## Notes

- **No double fetch:** the new effect fetches each configured repo's server JSON exactly once and derives both render data and override status from it.
- **`fetchRepoJson` retained:** `useRepoData` (detail pages) still uses local-first `fetchRepoJson`; only `useData` (dashboard aggregate) changed.
- **Out of scope (per spec):** plain "edited" indicator, auto-discard, 3-way item merge, adding a TS test runner, branch-selection behavior. Separately noted latent issue (not in this plan): `ChangeDetail.type` in `src/types/index.ts` does not list `boxes_added`/`boxes_removed`; harmless because JSON is untyped at runtime, but a future cleanup could align it with the validator.
