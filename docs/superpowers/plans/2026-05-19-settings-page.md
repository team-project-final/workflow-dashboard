# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page with 3 tabs (repo/track management, data editing, import/export) that replaces hardcoded configuration with a `data/config.json` file + localStorage overrides.

**Architecture:** A new `data/config.json` serves as the source of truth for repo-track-owner mappings. A `useConfig` hook loads this file, merges any localStorage overrides, and exposes the active config. The existing `useData` hook is refactored to consume `useConfig` instead of hardcoded constants. Parser scripts (`validate-data.mjs`, `parse-workflow.mjs`) are updated to read from `config.json`. A new Settings page provides CRUD UI for repos/tracks, inline data editing, and import/export.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vite 8, react-router-dom 7

---

### Task 1: Create `data/config.json` and Config types

**Files:**
- Create: `data/config.json`
- Create: `src/types/config.ts`

- [ ] **Step 1: Create `data/config.json`**

Extract current hardcoded values into the config file:

```json
{
  "version": 1,
  "repos": [
    {
      "repo": "synapse-platform-svc",
      "tracks": [{ "name": "platform", "owner": "김해준" }]
    },
    {
      "repo": "synapse-engagement-svc",
      "tracks": [{ "name": "engagement", "owner": "한승완" }]
    },
    {
      "repo": "synapse-knowledge-svc",
      "tracks": [
        { "name": "knowledge-1", "owner": "김현지" },
        { "name": "knowledge-2", "owner": "박은서" }
      ]
    },
    {
      "repo": "synapse-learning-svc",
      "tracks": [
        { "name": "learning-card", "owner": "조유지" },
        { "name": "learning-ai", "owner": "김나경" }
      ]
    },
    {
      "repo": "synapse-frontend",
      "tracks": [{ "name": "frontend", "owner": "전원" }]
    },
    {
      "repo": "synapse-gitops",
      "tracks": [{ "name": "team-lead", "owner": "김민구" }]
    },
    {
      "repo": "synapse-shared",
      "tracks": [{ "name": "team-lead", "owner": "김민구" }]
    }
  ],
  "virtualTracks": [
    {
      "name": "team-lead",
      "owner": "김민구",
      "sources": [
        { "repo": "synapse-gitops", "track": "team-lead" },
        { "repo": "synapse-shared", "track": "team-lead" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create `src/types/config.ts`**

```typescript
export interface TrackDef {
  name: string
  owner: string
}

export interface RepoDef {
  repo: string
  tracks: TrackDef[]
}

export interface VirtualTrackSource {
  repo: string
  track: string
}

export interface VirtualTrackDef {
  name: string
  owner: string
  sources: VirtualTrackSource[]
}

export interface DashboardConfig {
  version: number
  repos: RepoDef[]
  virtualTracks: VirtualTrackDef[]
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (new files are standalone, no imports yet)

- [ ] **Step 4: Commit**

```bash
git add data/config.json src/types/config.ts
git commit -m "feat: add config.json and Config types"
```

---

### Task 2: Create `useConfig` hook

**Files:**
- Create: `src/hooks/useConfig.ts`

- [ ] **Step 1: Implement `useConfig` hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { DashboardConfig } from '../types/config'

const LS_CONFIG_KEY = 'dashboard-config'

function loadLocalConfig(): DashboardConfig | null {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocalConfig(config: DashboardConfig): void {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config))
}

function clearLocalConfig(): void {
  localStorage.removeItem(LS_CONFIG_KEY)
}

export function useConfig() {
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOverridden, setIsOverridden] = useState(false)

  useEffect(() => {
    const localConfig = loadLocalConfig()
    if (localConfig) {
      setConfig(localConfig)
      setIsOverridden(true)
      setLoading(false)
      return
    }

    fetch(`${import.meta.env.BASE_URL}data/config.json`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DashboardConfig | null) => {
        setConfig(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const updateConfig = useCallback((newConfig: DashboardConfig) => {
    saveLocalConfig(newConfig)
    setConfig(newConfig)
    setIsOverridden(true)
  }, [])

  const resetConfig = useCallback(() => {
    clearLocalConfig()
    setIsOverridden(false)
    fetch(`${import.meta.env.BASE_URL}data/config.json`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DashboardConfig | null) => setConfig(data))
      .catch(() => {})
  }, [])

  return { config, loading, isOverridden, updateConfig, resetConfig }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useConfig.ts
git commit -m "feat: add useConfig hook with localStorage overlay"
```

---

### Task 3: Refactor `useData` to consume `useConfig`

**Files:**
- Modify: `src/hooks/useData.ts`

This is the critical refactor — replacing all hardcoded constants with config-driven logic.

- [ ] **Step 1: Rewrite `useData.ts`**

Replace the entire file content with:

```typescript
import { useState, useEffect } from 'react'
import type { PrdWeek, RepoData, Track, Week } from '../types'
import type { DashboardConfig, RepoDef, TrackDef, VirtualTrackDef } from '../types/config'
import { useConfig } from './useConfig'

export const WEEKS_META = [
  { week: 'W1', period: '05-12~05-16' },
  { week: 'W2', period: '05-19~05-23' },
  { week: 'W3', period: '05-26~05-29' },
  { week: 'W4', period: '06-01~06-05' },
  { week: 'W5', period: '06-08~06-12' },
]

const LS_DATA_PREFIX = 'dashboard-data-'

function loadLocalData(repo: string): RepoData | null {
  try {
    const raw = localStorage.getItem(LS_DATA_PREFIX + repo)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function emptyWeek(week: string, period: string): Week {
  return { week, period, steps: [], totalChecks: 0, doneChecks: 0 }
}

function normalizeWeek(week: Week | undefined, weekMeta: typeof WEEKS_META[number]): Week {
  if (!week) return emptyWeek(weekMeta.week, weekMeta.period)
  return {
    ...week,
    week: weekMeta.week,
    period: week.period || weekMeta.period,
    steps: week.steps || [],
    totalChecks: week.totalChecks || 0,
    doneChecks: week.doneChecks || 0,
  }
}

function normalizeTrack(track: Track | undefined, def: TrackDef): Track {
  return {
    name: def.name,
    owner: track?.owner || def.owner,
    weeks: WEEKS_META.map(wm => normalizeWeek(track?.weeks?.find(w => w.week === wm.week), wm)),
  }
}

function normalizePrdWeek(prdWeek: PrdWeek | undefined, weekMeta: typeof WEEKS_META[number]): PrdWeek {
  return { week: weekMeta.week, items: prdWeek?.items || [] }
}

function emptyRepoData(repo: string, tracks: TrackDef[]): RepoData {
  return {
    repo,
    updatedAt: '',
    tracks: tracks.map(t => normalizeTrack(undefined, t)),
    prd: WEEKS_META.map(wm => ({ week: wm.week, items: [] })),
    history: [],
    changelog: [],
  }
}

function normalizeRepoData(raw: RepoData | null, def: RepoDef): RepoData {
  if (!raw) return emptyRepoData(def.repo, def.tracks)
  return {
    ...raw,
    repo: raw.repo || def.repo,
    updatedAt: raw.updatedAt || '',
    tracks: def.tracks.map(td => normalizeTrack(raw.tracks?.find(t => t.name === td.name), td)),
    prd: WEEKS_META.map(wm => normalizePrdWeek(raw.prd?.find(p => p.week === wm.week), wm)),
    history: raw.history || [],
    changelog: raw.changelog || [],
  }
}

function fetchRepoJson(repo: string): Promise<RepoData | null> {
  const localData = loadLocalData(repo)
  if (localData) return Promise.resolve(localData)
  return fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
}

function mergeVirtualTrackData(
  vtDef: VirtualTrackDef,
  sourceResults: (RepoData | null)[],
  sourceDefs: RepoDef[],
): RepoData {
  const normalizedSources = sourceDefs.map((def, i) => normalizeRepoData(sourceResults[i], def))
  const tracks: Track[] = normalizedSources.map((nd, i) => ({
    name: sourceDefs[i].repo,
    owner: vtDef.owner,
    weeks: nd.tracks[0]?.weeks || WEEKS_META.map(wm => emptyWeek(wm.week, wm.period)),
  }))

  const historyMap = new Map<string, { totalChecks: number; doneChecks: number }>()
  for (const nd of normalizedSources) {
    for (const h of nd.history) {
      const existing = historyMap.get(h.date)
      if (existing) {
        existing.totalChecks += h.totalChecks
        existing.doneChecks += h.doneChecks
      } else {
        historyMap.set(h.date, { totalChecks: h.totalChecks, doneChecks: h.doneChecks })
      }
    }
  }
  const mergedHistory = [...historyMap].map(([date, v]) => ({ date, ...v }))

  const mergedChangelog = normalizedSources
    .flatMap(nd => nd.changelog)
    .sort((a, b) => b.date.localeCompare(a.date))

  const combinedPrd: PrdWeek[] = WEEKS_META.map(wm => ({
    week: wm.week,
    items: normalizedSources.flatMap(nd => nd.prd.find(p => p.week === wm.week)?.items || []),
  }))

  const latestUpdate = normalizedSources
    .map(nd => nd.updatedAt)
    .filter(Boolean)
    .sort()
    .pop() || ''

  return {
    repo: vtDef.name,
    updatedAt: latestUpdate,
    tracks,
    prd: combinedPrd,
    prdPerTrack: normalizedSources.map(nd => nd.prd),
    history: mergedHistory,
    changelog: mergedChangelog,
  }
}

export function useData() {
  const { config, loading: configLoading } = useConfig()
  const [data, setData] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (configLoading || !config) return

    const regularRepos = config.repos.filter(
      r => !config.virtualTracks.some(vt => vt.sources.some(s => s.repo === r.repo))
    )
    const vtSourceRepos = [...new Set(config.virtualTracks.flatMap(vt => vt.sources.map(s => s.repo)))]

    const regularFetches = regularRepos.map(def =>
      fetchRepoJson(def.repo).then(raw => normalizeRepoData(raw, def))
    )

    const vtFetches = config.virtualTracks.map(vtDef => {
      const sourceDefs = vtDef.sources.map(s => {
        const repoDef = config.repos.find(r => r.repo === s.repo)
        return repoDef || { repo: s.repo, tracks: [{ name: s.track, owner: vtDef.owner }] }
      })
      return Promise.all(sourceDefs.map(sd => fetchRepoJson(sd.repo)))
        .then(results => mergeVirtualTrackData(vtDef, results, sourceDefs))
    })

    Promise.all([...regularFetches, ...vtFetches])
      .then(results => {
        setData(results)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [config, configLoading])

  const totalChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0), 0)
  const doneChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0), 0)
  const overallPercent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  return { data, loading, error, overallPercent, totalChecks, doneChecks }
}

export function useRepoData(repo: string) {
  const { config, loading: configLoading } = useConfig()
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (configLoading || !config) return

    const vtDef = config.virtualTracks.find(vt => vt.name === repo)
    if (vtDef) {
      const sourceDefs = vtDef.sources.map(s => {
        const repoDef = config.repos.find(r => r.repo === s.repo)
        return repoDef || { repo: s.repo, tracks: [{ name: s.track, owner: vtDef.owner }] }
      })
      Promise.all(sourceDefs.map(sd => fetchRepoJson(sd.repo)))
        .then(results => {
          setData(mergeVirtualTrackData(vtDef, results, sourceDefs))
          setLoading(false)
        })
        .catch(() => {
          setData(null)
          setLoading(false)
        })
      return
    }

    const def = config.repos.find(d => d.repo === repo)
    if (!def) {
      setData(null)
      setLoading(false)
      return
    }

    fetchRepoJson(repo).then(raw => {
      setData(normalizeRepoData(raw, def))
      setLoading(false)
    }).catch(() => {
      setData(emptyRepoData(def.repo, def.tracks))
      setLoading(false)
    })
  }, [repo, config, configLoading])

  return { data, loading }
}
```

- [ ] **Step 2: Update `Dashboard.tsx` to use config for team-lead detection**

Replace the hardcoded `'김민구'` check in `src/pages/Dashboard.tsx`. Change the `trackEntries` logic (lines 12-17):

```typescript
// Replace lines 12-17 with:
  const trackEntries = data.flatMap(d => {
    if (d.tracks.length > 1 && d.tracks[0].owner === d.tracks[1]?.owner) {
      return [{ repoData: d, trackName: d.repo, owner: d.tracks[0].owner }]
    }
    return d.tracks.map(t => ({ repoData: d, trackName: t.name, owner: t.owner }))
  })
```

- [ ] **Step 3: Verify build and validate:data pass**

Run: `npm run lint && npm run validate:data && npm run build`
Expected: All pass. The app should behave identically since config.json has the same data as the old hardcoded values.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useData.ts src/pages/Dashboard.tsx
git commit -m "refactor: replace hardcoded repo/track config with useConfig"
```

---

### Task 4: Update parser scripts to read `config.json`

**Files:**
- Modify: `scripts/validate-data.mjs:6-14`
- Modify: `scripts/parse-workflow.mjs:86-96`

- [ ] **Step 1: Update `validate-data.mjs`**

Replace lines 6-14 (the hardcoded `EXPECTED_REPOS`) with:

```javascript
const configPath = path.resolve('data/config.json')
if (!fs.existsSync(configPath)) {
  console.error('data/config.json not found')
  process.exit(1)
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const EXPECTED_REPOS = config.repos.map(r => ({
  repo: r.repo,
  tracks: r.tracks.map(t => t.name),
}))
```

- [ ] **Step 2: Update `parse-workflow.mjs`**

Replace lines 85-96 (the hardcoded `trackAliasMap` and `ownerMap`) with:

```javascript
// config에서 ownerMap 구성
const configPath = path.resolve(path.dirname(outputPath), 'config.json')
const ownerMap = {}
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  for (const repo of config.repos) {
    for (const track of repo.tracks) {
      ownerMap[track.name] = track.owner
    }
  }
}

// trackAliasMap 삭제 — config의 명시적 매핑으로 대체
const trackAliasMap = {}
```

- [ ] **Step 3: Verify parsers still work**

Run: `npm run validate:data`
Expected: Same output as before (passes with 3 warnings about missing W5)

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-data.mjs scripts/parse-workflow.mjs
git commit -m "refactor: parsers read config.json instead of hardcoded maps"
```

---

### Task 5: Add `/settings` route and Settings page shell

**Files:**
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Create `src/pages/Settings.tsx`**

```tsx
import { useState } from 'react'
import Header from '../components/Header'
import { useData } from '../hooks/useData'

type SettingsTab = 'repos' | 'editor' | 'import-export'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'repos', label: '레포/트랙 관리' },
  { id: 'editor', label: '데이터 편집' },
  { id: 'import-export', label: 'Import/Export' },
]

export default function Settings() {
  const { overallPercent } = useData()
  const [activeTab, setActiveTab] = useState<SettingsTab>('repos')

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} subtitle="Settings" backLink="#/" />
      <div className="flex border-b-2 border-stone-200 bg-white">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-[2px] transition-colors ${
              activeTab === tab.id
                ? 'text-info border-info'
                : 'text-stone-400 border-transparent hover:text-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {activeTab === 'repos' && <div className="text-stone-400">레포/트랙 관리 (Task 6)</div>}
        {activeTab === 'editor' && <div className="text-stone-400">데이터 편집 (Task 7)</div>}
        {activeTab === 'import-export' && <div className="text-stone-400">Import/Export (Task 8)</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route in `src/App.tsx`**

Replace the entire file:

```tsx
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Detail from './pages/Detail'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/detail/:repo" element={<Detail />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Add Settings link to `src/components/Header.tsx`**

Replace the entire file:

```tsx
interface HeaderProps {
  overallPercent: number
  subtitle?: string
  backLink?: string
}

export default function Header({ overallPercent, subtitle, backLink }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-stone-900 to-stone-800 px-6 py-5 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {backLink && (
          <>
            <a href={backLink} className="text-stone-400 hover:text-amber text-sm">← 대시보드</a>
            <div className="w-px h-5 bg-stone-700" />
          </>
        )}
        <div>
          <h1 className="text-xl font-bold text-amber font-display m-0">Synapse</h1>
          <p className="text-xs text-stone-400">{subtitle || 'Workflow Dashboard'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <a href="#/settings" className="text-stone-400 hover:text-amber-light text-sm transition-colors">⚙ Settings</a>
        <div className="text-right">
          <div className="text-4xl font-bold text-amber-light font-display">{overallPercent}%</div>
          <p className="text-xs text-stone-400">전체 진행률</p>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Verify build and test navigation**

Run: `npm run build`
Expected: Build succeeds.

Run: `npm run dev` — navigate to `/#/settings` in browser, verify tabs render, verify "← 대시보드" and "⚙ Settings" links work.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx src/App.tsx src/components/Header.tsx
git commit -m "feat: add settings page shell with 3 tabs and header nav"
```

---

### Task 6: Implement Tab 1 — Repo/Track Manager

**Files:**
- Create: `src/components/settings/RepoManager.tsx`
- Create: `src/components/settings/RepoEditModal.tsx`
- Create: `src/components/settings/VirtualTrackModal.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Create `src/components/settings/RepoEditModal.tsx`**

```tsx
import { useState } from 'react'
import type { RepoDef, TrackDef } from '../../types/config'

interface Props {
  initial?: RepoDef
  onSave: (repo: RepoDef) => void
  onCancel: () => void
}

export default function RepoEditModal({ initial, onSave, onCancel }: Props) {
  const [repoName, setRepoName] = useState(initial?.repo || '')
  const [tracks, setTracks] = useState<TrackDef[]>(initial?.tracks || [{ name: '', owner: '' }])

  const addTrack = () => setTracks([...tracks, { name: '', owner: '' }])
  const removeTrack = (i: number) => setTracks(tracks.filter((_, idx) => idx !== i))
  const updateTrack = (i: number, field: keyof TrackDef, value: string) =>
    setTracks(tracks.map((t, idx) => idx === i ? { ...t, [field]: value } : t))

  const canSave = repoName.trim() !== '' && tracks.every(t => t.name.trim() !== '' && t.owner.trim() !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({ repo: repoName.trim(), tracks: tracks.map(t => ({ name: t.name.trim(), owner: t.owner.trim() })) })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-5">{initial ? '레포 편집' : '레포 추가'}</h3>

        <label className="block text-sm font-semibold text-stone-700 mb-1">레포 이름</label>
        <input
          value={repoName}
          onChange={e => setRepoName(e.target.value)}
          placeholder="synapse-example-svc"
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-1"
        />
        <p className="text-xs text-stone-400 mb-4">data/ 폴더의 JSON 파일명과 일치해야 합니다</p>

        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-stone-700">트랙 목록</label>
          <button onClick={addTrack} className="text-xs text-info border border-info px-2 py-0.5 rounded">+ 트랙 추가</button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {tracks.map((track, i) => (
            <div key={i} className="flex gap-2 items-center border border-stone-200 rounded-md p-2">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">트랙명</label>
                  <input value={track.name} onChange={e => updateTrack(i, 'name', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">담당자</label>
                  <input value={track.owner} onChange={e => updateTrack(i, 'owner', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
              </div>
              {tracks.length > 1 && (
                <button onClick={() => removeTrack(i)} className="text-danger text-lg">✕</button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-5 py-2 border border-stone-300 rounded-md text-sm">취소</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-5 py-2 bg-info text-white rounded-md text-sm disabled:opacity-40">저장</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/settings/VirtualTrackModal.tsx`**

```tsx
import { useState } from 'react'
import type { VirtualTrackDef, VirtualTrackSource, RepoDef } from '../../types/config'

interface Props {
  initial?: VirtualTrackDef
  availableRepos: RepoDef[]
  onSave: (vt: VirtualTrackDef) => void
  onCancel: () => void
}

export default function VirtualTrackModal({ initial, availableRepos, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name || '')
  const [owner, setOwner] = useState(initial?.owner || '')
  const [sources, setSources] = useState<VirtualTrackSource[]>(
    initial?.sources || [{ repo: '', track: '' }]
  )

  const addSource = () => setSources([...sources, { repo: '', track: '' }])
  const removeSource = (i: number) => setSources(sources.filter((_, idx) => idx !== i))
  const updateSource = (i: number, field: keyof VirtualTrackSource, value: string) =>
    setSources(sources.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  const canSave = name.trim() !== '' && owner.trim() !== '' &&
    sources.length > 0 && sources.every(s => s.repo.trim() !== '' && s.track.trim() !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      owner: owner.trim(),
      sources: sources.map(s => ({ repo: s.repo.trim(), track: s.track.trim() })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">{initial ? '가상 트랙 편집' : '가상 트랙 추가'}</h3>
        <p className="text-xs text-stone-500 mb-5">여러 레포의 데이터를 하나의 트랙으로 합산합니다</p>

        <label className="block text-sm font-semibold text-stone-700 mb-1">가상 트랙 이름</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-4" />

        <label className="block text-sm font-semibold text-stone-700 mb-1">담당자</label>
        <input value={owner} onChange={e => setOwner(e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-4" />

        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-stone-700">소스 레포</label>
          <button onClick={addSource} className="text-xs text-info border border-info px-2 py-0.5 rounded">+ 소스 추가</button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {sources.map((src, i) => (
            <div key={i} className="flex gap-2 items-center border border-blue-200 rounded-md p-2 bg-blue-50">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">레포</label>
                  <select value={src.repo} onChange={e => updateSource(i, 'repo', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm bg-white">
                    <option value="">선택...</option>
                    {availableRepos.map(r => (
                      <option key={r.repo} value={r.repo}>{r.repo}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">트랙</label>
                  <input value={src.track} onChange={e => updateSource(i, 'track', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
              </div>
              <button onClick={() => removeSource(i)} className="text-danger text-lg">✕</button>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
          ⚠ history와 PRD 데이터가 소스 레포에서 합산됩니다
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-5 py-2 border border-stone-300 rounded-md text-sm">취소</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-5 py-2 bg-info text-white rounded-md text-sm disabled:opacity-40">저장</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/settings/RepoManager.tsx`**

```tsx
import { useState } from 'react'
import type { DashboardConfig, RepoDef, VirtualTrackDef } from '../../types/config'
import RepoEditModal from './RepoEditModal'
import VirtualTrackModal from './VirtualTrackModal'

interface Props {
  config: DashboardConfig
  onUpdate: (config: DashboardConfig) => void
}

type ModalState =
  | { type: 'none' }
  | { type: 'repo'; index?: number }
  | { type: 'virtual'; index?: number }

export default function RepoManager({ config, onUpdate }: Props) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const saveRepo = (repo: RepoDef, index?: number) => {
    const repos = [...config.repos]
    if (index !== undefined) {
      repos[index] = repo
    } else {
      repos.push(repo)
    }
    onUpdate({ ...config, repos })
    setModal({ type: 'none' })
  }

  const deleteRepo = (index: number) => {
    if (!confirm(`"${config.repos[index].repo}" 레포를 삭제하시겠습니까?`)) return
    const repos = config.repos.filter((_, i) => i !== index)
    onUpdate({ ...config, repos })
  }

  const saveVirtual = (vt: VirtualTrackDef, index?: number) => {
    const virtualTracks = [...config.virtualTracks]
    if (index !== undefined) {
      virtualTracks[index] = vt
    } else {
      virtualTracks.push(vt)
    }
    onUpdate({ ...config, virtualTracks })
    setModal({ type: 'none' })
  }

  const deleteVirtual = (index: number) => {
    if (!confirm(`"${config.virtualTracks[index].name}" 가상 트랙을 삭제하시겠습니까?`)) return
    const virtualTracks = config.virtualTracks.filter((_, i) => i !== index)
    onUpdate({ ...config, virtualTracks })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold">등록된 레포 ({config.repos.length})</h3>
        <div className="flex gap-2">
          <button onClick={() => setModal({ type: 'virtual' })}
            className="text-sm px-4 py-2 border border-info text-info rounded-md hover:bg-blue-50">+ 가상 트랙</button>
          <button onClick={() => setModal({ type: 'repo' })}
            className="text-sm px-4 py-2 bg-info text-white rounded-md hover:bg-blue-600">+ 레포 추가</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {config.repos.map((repo, i) => (
          <div key={repo.repo} className="border border-stone-200 rounded-lg px-4 py-3 flex justify-between items-center">
            <div>
              <div className="font-semibold text-sm">{repo.repo}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                트랙: {repo.tracks.map(t => `${t.name} (${t.owner})`).join(', ')}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ type: 'repo', index: i })}
                className="text-xs px-3 py-1 border border-stone-200 rounded">편집</button>
              <button onClick={() => deleteRepo(i)}
                className="text-xs px-3 py-1 border border-red-200 text-danger rounded">삭제</button>
            </div>
          </div>
        ))}

        {config.virtualTracks.map((vt, i) => (
          <div key={vt.name} className="border border-blue-200 rounded-lg px-4 py-3 flex justify-between items-center bg-blue-50">
            <div>
              <div className="font-semibold text-sm">
                🔗 {vt.name} <span className="text-xs text-info font-normal">(가상 트랙 — 병합)</span>
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                소스: {vt.sources.map(s => s.repo).join(' + ')} → 담당: {vt.owner}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ type: 'virtual', index: i })}
                className="text-xs px-3 py-1 border border-stone-200 rounded">편집</button>
              <button onClick={() => deleteVirtual(i)}
                className="text-xs px-3 py-1 border border-red-200 text-danger rounded">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {modal.type === 'repo' && (
        <RepoEditModal
          initial={modal.index !== undefined ? config.repos[modal.index] : undefined}
          onSave={repo => saveRepo(repo, modal.index)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'virtual' && (
        <VirtualTrackModal
          initial={modal.index !== undefined ? config.virtualTracks[modal.index] : undefined}
          availableRepos={config.repos}
          onSave={vt => saveVirtual(vt, modal.index)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire RepoManager into Settings.tsx**

Replace `src/pages/Settings.tsx`:

```tsx
import { useState } from 'react'
import Header from '../components/Header'
import RepoManager from '../components/settings/RepoManager'
import { useData } from '../hooks/useData'
import { useConfig } from '../hooks/useConfig'

type SettingsTab = 'repos' | 'editor' | 'import-export'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'repos', label: '레포/트랙 관리' },
  { id: 'editor', label: '데이터 편집' },
  { id: 'import-export', label: 'Import/Export' },
]

export default function Settings() {
  const { overallPercent } = useData()
  const { config, loading, updateConfig } = useConfig()
  const [activeTab, setActiveTab] = useState<SettingsTab>('repos')

  if (loading || !config) return <div className="p-8 text-stone-400">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} subtitle="Settings" backLink="#/" />
      <div className="flex border-b-2 border-stone-200 bg-white">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-[2px] transition-colors ${
              activeTab === tab.id
                ? 'text-info border-info'
                : 'text-stone-400 border-transparent hover:text-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {activeTab === 'repos' && <RepoManager config={config} onUpdate={updateConfig} />}
        {activeTab === 'editor' && <div className="text-stone-400">데이터 편집 (Task 7)</div>}
        {activeTab === 'import-export' && <div className="text-stone-400">Import/Export (Task 8)</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run build`
Expected: Build succeeds.

Run: `npm run dev` — navigate to `/#/settings`, verify repo list renders, try adding/editing/deleting repos and virtual tracks.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/ src/pages/Settings.tsx
git commit -m "feat: implement repo/track manager tab with CRUD modals"
```

---

### Task 7: Implement Tab 2 — Data Editor

**Files:**
- Create: `src/components/settings/DataEditor.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Create `src/components/settings/DataEditor.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { DashboardConfig } from '../../types/config'
import type { RepoData, Step, Phase, CheckItem } from '../../types'
import { WEEKS_META } from '../../hooks/useData'

const WEEKS = WEEKS_META.map(w => w.week)
const LS_DATA_PREFIX = 'dashboard-data-'

interface Props {
  config: DashboardConfig
}

function loadRepoData(repo: string): Promise<RepoData | null> {
  const local = localStorage.getItem(LS_DATA_PREFIX + repo)
  if (local) return Promise.resolve(JSON.parse(local))
  return fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
}

function saveRepoData(repo: string, data: RepoData): void {
  localStorage.setItem(LS_DATA_PREFIX + repo, JSON.stringify(data))
}

function recomputeTotals(data: RepoData): RepoData {
  return {
    ...data,
    tracks: data.tracks.map(track => ({
      ...track,
      weeks: track.weeks.map(week => {
        const steps = week.steps.map(step => {
          const phases = step.phases.map(phase => ({
            ...phase,
            total: phase.items.length,
            done: phase.items.filter(it => it.done).length,
          }))
          const totalChecks = phases.reduce((s, p) => s + p.total, 0)
          const doneChecks = phases.reduce((s, p) => s + p.done, 0)
          const status: Step['status'] = totalChecks === 0 ? 'Not Started'
            : doneChecks === totalChecks ? 'Done'
            : doneChecks > 0 ? 'In Progress' : 'Not Started'
          return { ...step, phases, totalChecks, doneChecks, status }
        })
        return {
          ...week,
          steps,
          totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
          doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
        }
      }),
    })),
  }
}

export default function DataEditor({ config }: Props) {
  const allRepos = config.repos.map(r => r.repo)
  const [selectedRepo, setSelectedRepo] = useState(allRepos[0] || '')
  const [selectedWeek, setSelectedWeek] = useState('W1')
  const [repoData, setRepoData] = useState<RepoData | null>(null)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [isModified, setIsModified] = useState(false)

  useEffect(() => {
    if (!selectedRepo) return
    setIsModified(!!localStorage.getItem(LS_DATA_PREFIX + selectedRepo))
    loadRepoData(selectedRepo).then(setRepoData)
  }, [selectedRepo])

  const persist = useCallback((updated: RepoData) => {
    const recomputed = recomputeTotals(updated)
    setRepoData(recomputed)
    saveRepoData(selectedRepo, recomputed)
    setIsModified(true)
  }, [selectedRepo])

  if (!repoData) return <div className="text-stone-400">Loading...</div>

  const track = repoData.tracks[0]
  if (!track) return <div className="text-stone-400">트랙 없음</div>
  const week = track.weeks.find(w => w.week === selectedWeek)
  if (!week) return <div className="text-stone-400">주차 데이터 없음</div>

  const toggleCheck = (stepIdx: number, phaseIdx: number, itemIdx: number) => {
    const updated = structuredClone(repoData)
    const item = updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items[itemIdx]
    item.done = !item.done
    persist(updated)
  }

  const addItem = (stepIdx: number, phaseIdx: number, text: string) => {
    if (!text.trim()) return
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items.push({ text: text.trim(), done: false })
    persist(updated)
  }

  const removeItem = (stepIdx: number, phaseIdx: number, itemIdx: number) => {
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items.splice(itemIdx, 1)
    persist(updated)
  }

  const addStep = () => {
    const name = prompt('Step 이름:')
    if (!name?.trim()) return
    const updated = structuredClone(repoData)
    const w = updated.tracks[0].weeks.find(w => w.week === selectedWeek)!
    w.steps.push({
      name: name.trim(),
      status: 'Not Started',
      phases: [{ name: '기본', total: 0, done: 0, items: [] }],
      totalChecks: 0,
      doneChecks: 0,
    })
    persist(updated)
  }

  const deleteStep = (stepIdx: number) => {
    if (!confirm(`"${week.steps[stepIdx].name}" Step을 삭제하시겠습니까?`)) return
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps.splice(stepIdx, 1)
    persist(updated)
    setExpandedStep(null)
  }

  return (
    <div>
      <div className="flex gap-3 items-end mb-5">
        <div className="flex-1">
          <label className="text-xs font-semibold text-stone-700 block mb-1">레포 선택</label>
          <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm">
            {allRepos.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-700 block mb-1">주차</label>
          <div className="flex gap-1">
            {WEEKS.map(w => (
              <button key={w} onClick={() => setSelectedWeek(w)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  w === selectedWeek ? 'bg-info text-white' : 'bg-stone-100 text-stone-500 border border-stone-200'
                }`}>{w}</button>
            ))}
          </div>
        </div>
      </div>

      {isModified && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
          💡 이 레포에 수정된 내용이 localStorage에 저장되어 있습니다. Import/Export 탭에서 내보내기 하세요.
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold">{selectedWeek} Steps</h4>
        <button onClick={addStep} className="text-xs px-3 py-1.5 bg-info text-white rounded-md">+ Step 추가</button>
      </div>

      <div className="flex flex-col gap-2">
        {week.steps.map((step, si) => (
          <div key={si} className="border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 flex justify-between items-center cursor-pointer"
              onClick={() => setExpandedStep(expandedStep === si ? null : si)}>
              <div className="flex items-center gap-2">
                <span className="text-stone-400 text-xs">{expandedStep === si ? '▼' : '▶'}</span>
                <span className="font-semibold text-sm">{step.name}</span>
                <span className={`text-[11px] text-white px-2 py-0.5 rounded-full ${
                  step.doneChecks === step.totalChecks && step.totalChecks > 0 ? 'bg-success' : step.doneChecks > 0 ? 'bg-warning' : 'bg-stone-400'
                }`}>{step.doneChecks}/{step.totalChecks}</span>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => deleteStep(si)} className="text-xs px-2 py-1 border border-red-200 text-danger rounded">삭제</button>
              </div>
            </div>

            {expandedStep === si && (
              <div className="px-4 py-3 border-t border-stone-100">
                {step.phases.map((phase, pi) => (
                  <div key={pi} className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-stone-700 font-medium">📂 {phase.name} <span className="text-stone-400">({phase.done}/{phase.total})</span></span>
                      <button onClick={() => {
                        const text = prompt('항목 텍스트:')
                        if (text) addItem(si, pi, text)
                      }} className="text-[11px] text-info">+ 항목 추가</button>
                    </div>
                    <div className="flex flex-col gap-1 pl-2">
                      {phase.items.map((item, ii) => (
                        <div key={ii} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={item.done}
                            onChange={() => toggleCheck(si, pi, ii)}
                            className="accent-info" />
                          <span className={item.done ? 'text-stone-400 line-through' : 'text-stone-700'}>{item.text}</span>
                          <button onClick={() => removeItem(si, pi, ii)} className="text-stone-300 hover:text-danger text-xs ml-auto">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire DataEditor into Settings.tsx**

In `src/pages/Settings.tsx`, add the import and replace the placeholder:

Add import at top:
```typescript
import DataEditor from '../components/settings/DataEditor'
```

Replace the editor placeholder line:
```tsx
{activeTab === 'editor' && <DataEditor config={config} />}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: Build succeeds.

Run: `npm run dev` — navigate to `/#/settings`, click "데이터 편집" tab, select a repo, expand a step, toggle checkboxes, add/delete items.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/DataEditor.tsx src/pages/Settings.tsx
git commit -m "feat: implement data editor tab with step/phase/item CRUD"
```

---

### Task 8: Implement Tab 3 — Import/Export

**Files:**
- Create: `src/components/settings/ImportExport.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Create `src/components/settings/ImportExport.tsx`**

```tsx
import { useRef } from 'react'
import type { DashboardConfig } from '../../types/config'

interface Props {
  config: DashboardConfig
  isOverridden: boolean
  onImport: (config: DashboardConfig) => void
  onReset: () => void
}

const LS_DATA_PREFIX = 'dashboard-data-'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getModifiedRepos(repos: string[]): string[] {
  return repos.filter(r => localStorage.getItem(LS_DATA_PREFIX + r) !== null)
}

export default function ImportExport({ config, isOverridden, onImport, onReset }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const allRepos = config.repos.map(r => r.repo)
  const modifiedRepos = getModifiedRepos(allRepos)

  const exportConfig = () => downloadJson(config, 'config.json')

  const exportRepoData = (repo: string) => {
    const raw = localStorage.getItem(LS_DATA_PREFIX + repo)
    if (raw) {
      downloadJson(JSON.parse(raw), `${repo}.json`)
    } else {
      fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) downloadJson(data, `${repo}.json`) })
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as DashboardConfig
        if (!parsed.version || !Array.isArray(parsed.repos)) {
          alert('유효하지 않은 config.json 형식입니다.')
          return
        }
        onImport(parsed)
        alert('설정을 가져왔습니다.')
      } catch {
        alert('JSON 파싱 실패')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleReset = () => {
    if (!confirm('모든 localStorage 오버라이드를 삭제하고 원본으로 복원하시겠습니까?')) return
    for (const repo of allRepos) {
      localStorage.removeItem(LS_DATA_PREFIX + repo)
    }
    onReset()
    alert('초기화 완료. 페이지를 새로고침합니다.')
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Config export */}
      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📤 설정 내보내기 (config.json)</h4>
        <p className="text-xs text-stone-500 mb-3">
          레포/트랙/담당자 매핑을 config.json으로 다운로드합니다.
          이 파일을 <code className="bg-stone-100 px-1 rounded">data/config.json</code>에 커밋하면 파서와 CI에서도 사용됩니다.
          {isOverridden && <span className="text-amber-600 font-medium"> (localStorage 오버라이드 포함)</span>}
        </p>
        <button onClick={exportConfig} className="text-sm px-4 py-2 bg-info text-white rounded-md">config.json 다운로드</button>
      </div>

      {/* Data export */}
      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📤 데이터 내보내기</h4>
        <p className="text-xs text-stone-500 mb-3">수정된 레포 데이터를 개별 JSON으로 다운로드합니다.</p>
        <div className="flex gap-2 flex-wrap">
          {allRepos.map(repo => {
            const isMod = modifiedRepos.includes(repo)
            return (
              <div key={repo}
                className={`border rounded-md px-3 py-2 text-xs flex items-center gap-2 ${isMod ? 'border-amber-200 bg-amber-50' : 'border-stone-200'}`}>
                <span className={isMod ? 'text-warning' : 'text-success'}>●</span>
                {repo}.json
                {isMod && <span className="text-amber-700 text-[10px]">(수정됨)</span>}
                <button onClick={() => exportRepoData(repo)} className="text-info ml-1">⬇</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Import */}
      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📥 설정 가져오기</h4>
        <p className="text-xs text-stone-500 mb-3">config.json을 업로드하여 설정을 복원합니다.</p>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport}
          className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-stone-100 file:text-stone-700 file:text-sm" />
      </div>

      {/* Reset */}
      <div className="border border-red-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-danger mb-1">🔄 초기화</h4>
        <p className="text-xs text-stone-500 mb-3">localStorage의 모든 오버라이드를 삭제하고 원본 data/*.json으로 복원합니다.</p>
        <button onClick={handleReset} className="text-sm px-4 py-2 border border-red-200 text-danger rounded-md hover:bg-red-50">전체 초기화</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire ImportExport into Settings.tsx**

In `src/pages/Settings.tsx`, add the import:

```typescript
import ImportExport from '../components/settings/ImportExport'
```

Replace the import-export placeholder line:

```tsx
{activeTab === 'import-export' && (
  <ImportExport config={config} isOverridden={isOverridden} onImport={updateConfig} onReset={resetConfig} />
)}
```

Also update the destructured values from `useConfig`:

```typescript
const { config, loading, isOverridden, updateConfig, resetConfig } = useConfig()
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: Build succeeds.

Run: `npm run dev` — navigate to `/#/settings`, click "Import/Export" tab, test config download, test reset.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ImportExport.tsx src/pages/Settings.tsx
git commit -m "feat: implement import/export tab with download, upload, and reset"
```

---

### Task 9: Add auto color fallback for TimelineChart

**Files:**
- Modify: `src/components/TimelineChart.tsx:11-21, 64`

- [ ] **Step 1: Add auto-color fallback**

In `src/components/TimelineChart.tsx`, add a fallback color generator after `TRACK_COLORS` (line 21):

```typescript
const AUTO_COLORS = ['#6366F1', '#14B8A6', '#F43F5E', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16', '#E879F9']

function getTrackColor(trackName: string): string {
  if (TRACK_COLORS[trackName]) return TRACK_COLORS[trackName]
  // Deterministic fallback based on track name hash
  let hash = 0
  for (let i = 0; i < trackName.length; i++) {
    hash = ((hash << 5) - hash) + trackName.charCodeAt(i)
    hash |= 0
  }
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length]
}
```

Then change line 64 from:

```typescript
      borderColor: TRACK_COLORS[t.name] || '#78716C',
```

to:

```typescript
      borderColor: getTrackColor(t.name),
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineChart.tsx
git commit -m "feat: auto-assign chart colors for unregistered tracks"
```

---

### Task 10: Final integration verification

**Files:** None (testing only)

- [ ] **Step 1: Run full CI check**

Run: `npm run lint && npm run validate:data && npm run build`
Expected: All pass.

- [ ] **Step 2: Test end-to-end in dev server**

Run: `npm run dev`

Verify:
1. Dashboard (`/`) loads with all tracks — same as before
2. Header shows "⚙ Settings" link
3. Settings page (`/#/settings`) loads with 3 tabs
4. Tab 1: all 7 repos + 1 virtual track listed, add/edit/delete works
5. Tab 2: select repo → select week → expand step → toggle checkbox → see modified badge
6. Tab 3: download config.json → upload it back → reset localStorage
7. Detail pages still work for all repos including team-lead
8. After adding a repo in settings, it appears in dashboard after reload

- [ ] **Step 3: Commit any final adjustments**

If any lint or type errors found, fix and commit.

```bash
git add -A
git commit -m "chore: final adjustments for settings page integration"
```
