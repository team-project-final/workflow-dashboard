# `/project-dashboard` Skill Phase 3: Init Module + Scaffold Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `init` subcommand and scaffold templates so `/project-dashboard init` generates a complete, config-driven dashboard project from user input.

**Architecture:** The `init` skill module collects project info via interactive questions, then uses a scaffold generator script (`scripts/scaffold.mjs`) to produce a new project directory. The scaffold contains generalized React components that read `config.json` dynamically instead of hardcoding weeks/columns/tracks. Templates are stored in `skills/project-dashboard/templates/scaffold/` and the generator copies + customizes them based on user input.

**Tech Stack:** Claude Code skill (Markdown), Node.js 22 (ESM scaffold script), React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Chart.js 4, react-router-dom 7

---

## File Structure

```
skills/project-dashboard/
├── modules/
│   └── init.md                           # Init skill module instructions
└── templates/
    └── scaffold/
        ├── package.json.tmpl              # Package.json with {{PROJECT_NAME}}
        ├── vite.config.ts.tmpl            # Vite config with {{BASE_PATH}}
        ├── tsconfig.json                  # TypeScript config (static)
        ├── tsconfig.app.json              # App-level TS config (static)
        ├── eslint.config.js               # ESLint config (static)
        ├── index.html.tmpl                # Entry HTML with {{PROJECT_TITLE}}
        ├── src/
        │   ├── main.tsx                   # Entry point (static)
        │   ├── App.tsx                    # Router (static)
        │   ├── types/
        │   │   ├── index.ts               # Data types (static, same as current)
        │   │   └── config.ts              # Config types (generalized)
        │   ├── hooks/
        │   │   ├── useConfig.ts           # Config hook (static, same as current)
        │   │   └── useData.ts             # Data hook (generalized — no hardcoded WEEKS)
        │   ├── components/
        │   │   ├── Header.tsx             # Header (generalized — reads config.project)
        │   │   ├── TrackCard.tsx           # Track card (static, already dynamic)
        │   │   ├── ProgressTable.tsx       # Progress table (generalized — dynamic weeks)
        │   │   ├── TimelineChart.tsx       # Timeline chart (static, already uses hash colors)
        │   │   ├── WeekTabs.tsx            # Week tabs (generalized — reads config.periods)
        │   │   ├── ColumnRenderer.tsx      # NEW — dispatches by column type
        │   │   ├── ChecklistColumn.tsx     # Merged from TaskColumn + WorkflowColumn
        │   │   ├── ListColumn.tsx          # Generalized from PrdColumn
        │   │   ├── ChangelogTab.tsx        # Changelog tab (static, already dynamic)
        │   │   └── settings/
        │   │       ├── RepoManager.tsx     # (static, copy from current)
        │   │       ├── DataEditor.tsx      # (static, copy from current)
        │   │       └── ImportExport.tsx    # (static, copy from current)
        │   ├── pages/
        │   │   ├── Dashboard.tsx           # Dashboard (static, already dynamic)
        │   │   ├── Detail.tsx              # Detail (generalized — uses ColumnRenderer)
        │   │   └── Settings.tsx            # Settings (static, copy from current)
        │   └── utils/
        │       └── progressColor.ts        # Progress colors (static, same as current)
        ├── scripts/
        │   ├── validate-data.mjs           # Validation (copy from current, already generalized)
        │   └── parsers/                    # Parser system (copy from Phase 2)
        │       ├── index.mjs
        │       ├── github-markdown.mjs
        │       ├── notion.mjs
        │       └── linear.mjs
        └── data/
            └── .gitkeep                   # Empty data dir placeholder

scripts/
└── scaffold.mjs                           # Scaffold generator script
```

### Key Generalization Points

Current hardcoded values → config-driven:

| Component | Current | Template |
|---|---|---|
| `Header.tsx:18` | `"Synapse"` hardcoded | Reads `config.project.name` |
| `WeekTabs.tsx:1` | `['W1','W2','W3','W4','W5']` hardcoded | Reads `config.periods` via `useConfig()` |
| `ProgressTable.tsx:8` | `['W1','W2','W3','W4','W5']` hardcoded | Reads `config.periods` via `useConfig()` |
| `useData.ts:6-12` | `WEEKS_META` hardcoded 5 weeks | Reads `config.periods` from config |
| `Detail.tsx:48` | `"상세 (PRD/TASK/WORKFLOW)"` hardcoded | Dynamic from `config.columns` |
| `Detail.tsx:78-86` | 3 column components hardcoded | `ColumnRenderer` dispatches by `config.columns` |
| `TimelineChart.tsx:11-21` | `TRACK_COLORS` hardcoded | Already has auto-hash fallback, remove hardcoded map |
| `config.ts` | Legacy `RepoDef` format only | Support both legacy and new format |

---

### Task 1: Generalized Config Types

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/types/config.ts`

The current `config.ts` only supports the legacy format. The template must support both formats.

- [ ] **Step 1: Create the generalized config types**

```typescript
// Legacy format types (backward compatible)
export interface TrackDef {
  name: string
  owner: string
}

export interface LegacyRepoDef {
  repo: string
  tracks: TrackDef[]
}

export interface VirtualTrackSource {
  repo: string
  track: string
}

export interface LegacyVirtualTrackDef {
  name: string
  owner: string
  sources: VirtualTrackSource[]
}

// New format types
export interface PeriodDef {
  id: string
  label: string
  start: string
  end: string
}

export interface ColumnDef {
  id: string
  label: string
  type: 'list' | 'checklist' | 'kanban'
}

export interface SourceDef {
  type: 'github-markdown' | 'notion' | 'linear' | 'manual'
  repo?: string
  path?: string
  databaseId?: string
  projectId?: string
  mapping?: Record<string, string>
}

export interface RepoDef {
  id: string
  trackName: string
  owner: string
  source?: SourceDef
}

export interface VirtualTrackDef {
  id: string
  trackName: string
  owner: string
  sources: string[]
}

export interface ProjectDef {
  name: string
  description?: string
}

// Unified config — supports both formats
export interface DashboardConfig {
  version: number
  project?: ProjectDef
  periods?: PeriodDef[]
  columns?: ColumnDef[]
  repos: (RepoDef | LegacyRepoDef)[]
  virtualTracks: (VirtualTrackDef | LegacyVirtualTrackDef)[]
}

// Type guards
export function isNewFormat(config: DashboardConfig): boolean {
  return 'id' in (config.repos[0] || {})
}

export function getRepoId(repo: RepoDef | LegacyRepoDef): string {
  return 'id' in repo ? repo.id : (repo as LegacyRepoDef).repo
}

export function getRepoTrackName(repo: RepoDef | LegacyRepoDef): string {
  if ('trackName' in repo) return repo.trackName
  return (repo as LegacyRepoDef).tracks.map(t => t.name).join(', ')
}

export function getRepoOwner(repo: RepoDef | LegacyRepoDef): string {
  if ('owner' in repo && typeof repo.owner === 'string') return repo.owner
  return (repo as LegacyRepoDef).tracks[0]?.owner || 'unknown'
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/types/config.ts
git commit -m "feat(templates): add generalized config types with legacy support"
```

---

### Task 2: Generalized useData Hook

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/hooks/useData.ts`

The key change: remove `WEEKS_META` hardcoding. The hook reads periods from config instead.

- [ ] **Step 1: Create the generalized useData hook**

```typescript
import { useState, useEffect } from 'react'
import type { PrdWeek, RepoData, Track, Week } from '../types'
import type { DashboardConfig, LegacyRepoDef, LegacyVirtualTrackDef, VirtualTrackSource } from '../types/config'
import { useConfig } from './useConfig'
import { isNewFormat, getRepoId } from '../types/config'

// Fallback weeks for legacy configs without periods
const LEGACY_WEEKS = [
  { week: 'W1', period: '' },
  { week: 'W2', period: '' },
  { week: 'W3', period: '' },
  { week: 'W4', period: '' },
  { week: 'W5', period: '' },
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

function getWeeksMeta(config: DashboardConfig | null) {
  if (config?.periods && config.periods.length > 0) {
    return config.periods.map(p => ({
      week: p.id,
      period: `${p.start}~${p.end}`,
    }))
  }
  return LEGACY_WEEKS
}

function normalizeTrack(
  track: Track,
  weeksMeta: { week: string; period: string }[],
): Track {
  const existingWeeks = new Map(track.weeks.map(w => [w.week, w]))
  const weeks: Week[] = weeksMeta.map(({ week, period }) => {
    const existing = existingWeeks.get(week)
    if (existing) return { ...existing, period: existing.period || period }
    return { week, period, steps: [], totalChecks: 0, doneChecks: 0 }
  })
  return { ...track, weeks }
}

function normalizeRepoData(
  raw: RepoData,
  config: DashboardConfig,
  repoConfig: { tracks?: { name: string; owner: string }[] },
): RepoData {
  const weeksMeta = getWeeksMeta(config)
  const tracks = raw.tracks.map(t => normalizeTrack(t, weeksMeta))

  // Assign owners from config if available
  if (repoConfig.tracks) {
    for (const track of tracks) {
      const def = repoConfig.tracks.find(d => d.name === track.name)
      if (def) track.owner = def.owner
    }
  }

  return { ...raw, tracks }
}

async function fetchRepoJson(repo: string): Promise<RepoData | null> {
  const local = loadLocalData(repo)
  if (local) return local

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

interface VTSource {
  repo: string
  track?: string
}

function getVirtualTrackSources(
  vt: LegacyVirtualTrackDef | { id: string; trackName: string; owner: string; sources: string[] },
): VTSource[] {
  if ('sources' in vt && Array.isArray(vt.sources)) {
    if (typeof vt.sources[0] === 'string') {
      return (vt.sources as string[]).map(s => ({ repo: s }))
    }
    return (vt.sources as VirtualTrackSource[]).map(s => ({ repo: s.repo, track: s.track }))
  }
  return []
}

function mergeVirtualTrackData(
  vtDef: { name?: string; trackName?: string; owner: string },
  sourceResults: (RepoData | null)[],
  sources: VTSource[],
  config: DashboardConfig,
): RepoData {
  const vtName = ('trackName' in vtDef ? vtDef.trackName : vtDef.name) || 'virtual'
  const weeksMeta = getWeeksMeta(config)
  const validResults = sourceResults.filter((r): r is RepoData => r !== null)

  // Merge tracks from all sources
  const allTracks: Track[] = validResults.flatMap((r, i) => {
    const src = sources[i]
    if (src?.track) {
      const match = r.tracks.find(t => t.name === src.track)
      return match ? [normalizeTrack(match, weeksMeta)] : []
    }
    return r.tracks.map(t => normalizeTrack(t, weeksMeta))
  })

  // Merge history
  const historyMap = new Map<string, { totalChecks: number; doneChecks: number }>()
  for (const r of validResults) {
    for (const h of r.history || []) {
      const existing = historyMap.get(h.date) || { totalChecks: 0, doneChecks: 0 }
      historyMap.set(h.date, {
        totalChecks: existing.totalChecks + h.totalChecks,
        doneChecks: existing.doneChecks + h.doneChecks,
      })
    }
  }
  const history = [...historyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }))

  // Merge changelog
  const changelog = validResults
    .flatMap(r => r.changelog || [])
    .sort((a, b) => b.date.localeCompare(a.date))

  // Collect PRD per track
  const prdPerTrack = validResults.map(r => r.prd || [])

  const timestamps = validResults.map(r => r.updatedAt).filter(Boolean).sort()

  return {
    repo: vtName,
    updatedAt: timestamps[timestamps.length - 1] || new Date().toISOString(),
    tracks: allTracks,
    prd: prdPerTrack.flat(),
    prdPerTrack,
    history,
    changelog,
  }
}

export function useData() {
  const { config, loading: configLoading } = useConfig()
  const [data, setData] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (configLoading || !config) return
    let cancelled = false

    async function load() {
      const isNew = isNewFormat(config!)
      const repoIds = config!.repos.map(r => getRepoId(r))
      const vtSourceRepos = new Set<string>()

      // Identify virtual track source repos
      for (const vt of config!.virtualTracks) {
        const sources = getVirtualTrackSources(vt as LegacyVirtualTrackDef)
        sources.forEach(s => vtSourceRepos.add(s.repo))
      }

      // Fetch all repos
      const results = await Promise.all(
        repoIds.map(async id => {
          const raw = await fetchRepoJson(id)
          if (!raw) return null
          const repoCfg = isNew ? {} : { tracks: (config!.repos.find(r => getRepoId(r) === id) as LegacyRepoDef)?.tracks }
          return normalizeRepoData(raw, config!, repoCfg)
        })
      )

      // Build virtual tracks
      const vtResults: RepoData[] = []
      for (const vt of config!.virtualTracks) {
        const sources = getVirtualTrackSources(vt as LegacyVirtualTrackDef)
        const sourceData = await Promise.all(sources.map(s => fetchRepoJson(s.repo)))
        vtResults.push(mergeVirtualTrackData(vt, sourceData, sources, config!))
      }

      // Filter out repos that are only virtual track sources
      const mainResults = results.filter((r): r is RepoData =>
        r !== null && !vtSourceRepos.has(r.repo)
      )

      if (!cancelled) {
        setData([...mainResults, ...vtResults])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [config, configLoading])

  const totalChecks = data.reduce((s, d) => s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0), 0)
  const doneChecks = data.reduce((s, d) => s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0), 0)
  const overallPercent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  return { data, loading: loading || configLoading, error: null, overallPercent, totalChecks, doneChecks }
}

export function useRepoData(repo: string) {
  const { config, loading: configLoading } = useConfig()
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (configLoading || !config) return
    let cancelled = false

    async function load() {
      // Check if this is a virtual track
      const vt = config!.virtualTracks.find(v =>
        ('id' in v ? v.id : (v as LegacyVirtualTrackDef).name) === repo
      )

      if (vt) {
        const sources = getVirtualTrackSources(vt as LegacyVirtualTrackDef)
        const sourceData = await Promise.all(sources.map(s => fetchRepoJson(s.repo)))
        if (!cancelled) {
          setData(mergeVirtualTrackData(vt, sourceData, sources, config!))
          setLoading(false)
        }
      } else {
        const raw = await fetchRepoJson(repo)
        if (!cancelled) {
          if (raw) {
            const repoCfg = isNewFormat(config!)
              ? {}
              : { tracks: (config!.repos.find(r => getRepoId(r) === repo) as LegacyRepoDef)?.tracks }
            setData(normalizeRepoData(raw, config!, repoCfg))
          }
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [repo, config, configLoading])

  return { data, loading: loading || configLoading }
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/hooks/useData.ts
git commit -m "feat(templates): add generalized useData hook (config-driven periods)"
```

---

### Task 3: Generalized Header Component

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/components/Header.tsx`

Removes hardcoded "Synapse" title, reads `config.project.name` instead.

- [ ] **Step 1: Create the generalized Header**

```tsx
import { useConfig } from '../hooks/useConfig'

interface HeaderProps {
  overallPercent: number
  subtitle?: string
  backLink?: string
}

export default function Header({ overallPercent, subtitle, backLink }: HeaderProps) {
  const { config } = useConfig()
  const projectName = config?.project?.name || 'Dashboard'

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
          <h1 className="text-xl font-bold text-amber font-display m-0">{projectName}</h1>
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

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/components/Header.tsx
git commit -m "feat(templates): generalize Header to read project name from config"
```

---

### Task 4: Generalized WeekTabs and ProgressTable

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/components/WeekTabs.tsx`
- Create: `skills/project-dashboard/templates/scaffold/src/components/ProgressTable.tsx`

Both currently hardcode `['W1','W2','W3','W4','W5']`. Template versions read from config.

- [ ] **Step 1: Create generalized WeekTabs**

```tsx
import { useConfig } from '../hooks/useConfig'

interface Props {
  selected: string
  onChange: (week: string) => void
}

export default function WeekTabs({ selected, onChange }: Props) {
  const { config } = useConfig()
  const weeks = config?.periods?.map(p => p.id) || ['W1', 'W2', 'W3', 'W4', 'W5']

  return (
    <div className="flex bg-stone-800 px-6">
      {weeks.map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-4 py-2.5 text-xs font-medium transition-colors ${
            w === selected
              ? 'text-amber border-b-2 border-amber'
              : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create generalized ProgressTable**

```tsx
import type { RepoData } from '../types'
import { progressText } from '../utils/progressColor'
import { useConfig } from '../hooks/useConfig'

interface Props {
  data: RepoData[]
}

function percentColor(p: number) {
  return `${progressText(p)} font-semibold`
}

export default function ProgressTable({ data }: Props) {
  const { config } = useConfig()
  const weeks = config?.periods?.map(p => p.id) || ['W1', 'W2', 'W3', 'W4', 'W5']

  const rows = data.flatMap(d =>
    d.tracks.map(t => ({
      name: `${t.owner} ${t.name}`,
      weeks: weeks.map(w => {
        const week = t.weeks.find(wk => wk.week === w)
        if (!week || week.totalChecks === 0) return null
        return Math.round(week.doneChecks / week.totalChecks * 100)
      }),
      total: (() => {
        const tc = t.weeks.reduce((s, w) => s + w.totalChecks, 0)
        const dc = t.weeks.reduce((s, w) => s + w.doneChecks, 0)
        return tc > 0 ? Math.round(dc / tc * 100) : 0
      })(),
    }))
  )

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-600 mb-2">주차별 상세</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-amber-light">
            <th className="p-1.5 text-left border-b-2 border-amber text-[10px]">트랙</th>
            {weeks.map(w => <th key={w} className="p-1.5 text-center border-b-2 border-amber text-[10px]">{w}</th>)}
            <th className="p-1.5 text-center border-b-2 border-amber text-[10px] font-bold">합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="p-1.5">{r.name}</td>
              {r.weeks.map((w, j) => (
                <td key={j} className={`text-center ${w !== null ? percentColor(w) : 'text-stone-300'}`}>
                  {w !== null ? `${w}%` : '—'}
                </td>
              ))}
              <td className="text-center font-bold">{r.total}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-stone-400">
        🟢 90%+ &nbsp; 🔵 60~89% &nbsp; 🟠 30~59% &nbsp; 🔴 1~29% &nbsp; — 미시작
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/components/WeekTabs.tsx skills/project-dashboard/templates/scaffold/src/components/ProgressTable.tsx
git commit -m "feat(templates): generalize WeekTabs and ProgressTable to read periods from config"
```

---

### Task 5: ColumnRenderer + Column Components

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/components/ColumnRenderer.tsx`
- Create: `skills/project-dashboard/templates/scaffold/src/components/ChecklistColumn.tsx`
- Create: `skills/project-dashboard/templates/scaffold/src/components/ListColumn.tsx`

The ColumnRenderer is the key new component: it dispatches rendering to the correct column component based on `config.columns[].type`.

- [ ] **Step 1: Create ColumnRenderer**

```tsx
import type { Step } from '../types'
import type { ColumnDef } from '../types/config'
import type { PrdWeek } from '../types'
import ChecklistColumn from './ChecklistColumn'
import ListColumn from './ListColumn'

interface Props {
  column: ColumnDef
  steps: Step[]
  prdWeek?: PrdWeek
  selectedStep: Step | null
  onSelectStep: (step: Step | null) => void
}

export default function ColumnRenderer({ column, steps, prdWeek, selectedStep, onSelectStep }: Props) {
  switch (column.type) {
    case 'list':
      return <ListColumn label={column.label} prdWeek={prdWeek} />

    case 'checklist':
      return (
        <ChecklistColumn
          label={column.label}
          steps={steps}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
      )

    case 'kanban':
      // Kanban renders as grouped checklist for now; can be extended later
      return (
        <ChecklistColumn
          label={column.label}
          steps={steps}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
      )

    default:
      return <div className="p-4 text-stone-400 text-xs">Unknown column type: {column.type}</div>
  }
}
```

- [ ] **Step 2: Create ChecklistColumn (merged Task + Workflow behavior)**

```tsx
import { useState } from 'react'
import type { Step, Phase } from '../types'

interface Props {
  label: string
  steps: Step[]
  selectedStep: Step | null
  onSelectStep: (step: Step | null) => void
}

const STATUS_STYLE: Record<string, { bg: string; badge: string; text: string }> = {
  Done: { bg: 'bg-green-50', badge: 'bg-success', text: 'text-success' },
  'In Progress': { bg: 'bg-amber-50', badge: 'bg-amber', text: 'text-amber' },
  'Not Started': { bg: 'bg-white', badge: 'bg-stone-200', text: 'text-stone-400' },
}

export default function ChecklistColumn({ label, steps, selectedStep, onSelectStep }: Props) {
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set())

  const togglePhase = (name: string) => {
    const next = new Set(openPhases)
    next.has(name) ? next.delete(name) : next.add(name)
    setOpenPhases(next)
  }

  // If a step is selected, show its phases (drill-down view)
  if (selectedStep) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-stone-600">{label} — {selectedStep.name}</h3>
          <button onClick={() => onSelectStep(null)} className="text-xs text-stone-400 hover:text-stone-600">← 목록</button>
        </div>
        {selectedStep.phases.map((phase: Phase) => {
          const pct = phase.total > 0 ? Math.round(phase.done / phase.total * 100) : 0
          const statusIcon = phase.done === phase.total ? '✅' : phase.done > 0 ? '🔄' : '⬜'
          const isOpen = openPhases.has(phase.name)

          return (
            <div key={phase.name} className="mb-2">
              <button
                onClick={() => togglePhase(phase.name)}
                className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-stone-50"
              >
                <span className="text-xs">{statusIcon} {phase.name}</span>
                <span className="text-[10px] text-stone-400">{phase.done}/{phase.total}</span>
              </button>
              {isOpen && (
                <div className="pl-4 space-y-0.5">
                  {phase.items.map((item, i) => (
                    <div key={i} className={`text-xs py-0.5 ${item.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                      {item.done ? '☑' : '☐'} {item.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Step list view
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-stone-600 mb-2">{label}</h3>
      {steps.length === 0 && <p className="text-xs text-stone-400">데이터 없음</p>}
      {steps.map(step => {
        const style = STATUS_STYLE[step.status] || STATUS_STYLE['Not Started']
        const pct = step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0

        return (
          <button
            key={step.name}
            onClick={() => onSelectStep(step)}
            className={`w-full text-left p-2 rounded mb-1 border-l-2 ${style.bg} hover:shadow-sm transition-shadow`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{step.name}</span>
              <span className={`text-[10px] font-mono ${style.text}`}>{pct}%</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create ListColumn (generalized from PrdColumn)**

```tsx
import type { PrdWeek } from '../types'

interface Props {
  label: string
  prdWeek?: PrdWeek
}

const STATUS_STYLE = {
  done: { border: 'border-l-success', icon: '✅' },
  in_progress: { border: 'border-l-amber', icon: '🔄' },
  not_started: { border: 'border-l-stone-300', icon: '⬜' },
}

export default function ListColumn({ label, prdWeek }: Props) {
  const items = prdWeek?.items || []

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-stone-600 mb-2">{label}</h3>
      {items.length === 0 && <p className="text-xs text-stone-400">항목 없음</p>}
      {items.map(item => {
        const style = STATUS_STYLE[item.status] || STATUS_STYLE.not_started
        return (
          <div key={item.id} className={`p-2 mb-1 border-l-2 ${style.border} bg-white rounded text-xs`}>
            <span className="mr-1">{style.icon}</span>
            <span className="font-mono text-stone-500 mr-1">{item.id}</span>
            {item.title}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/components/ColumnRenderer.tsx skills/project-dashboard/templates/scaffold/src/components/ChecklistColumn.tsx skills/project-dashboard/templates/scaffold/src/components/ListColumn.tsx
git commit -m "feat(templates): add ColumnRenderer with ChecklistColumn and ListColumn"
```

---

### Task 6: Generalized Detail Page

**Files:**
- Create: `skills/project-dashboard/templates/scaffold/src/pages/Detail.tsx`

Replaces hardcoded 3-column layout with dynamic `ColumnRenderer` based on `config.columns`.

- [ ] **Step 1: Create the generalized Detail page**

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRepoData } from '../hooks/useData'
import { useConfig } from '../hooks/useConfig'
import Header from '../components/Header'
import WeekTabs from '../components/WeekTabs'
import ColumnRenderer from '../components/ColumnRenderer'
import ChangelogTab from '../components/ChangelogTab'
import type { Step } from '../types'
import type { ColumnDef } from '../types/config'

// Default columns for legacy configs
const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'prd', label: 'PRD', type: 'list' },
  { id: 'task', label: 'Task', type: 'checklist' },
  { id: 'workflow', label: 'Workflow', type: 'checklist' },
]

export default function Detail() {
  const { repo } = useParams<{ repo: string }>()
  const { data, loading } = useRepoData(repo || '')
  const { config } = useConfig()
  const columns = config?.columns || DEFAULT_COLUMNS

  const [selectedWeek, setSelectedWeek] = useState(config?.periods?.[0]?.id || 'W1')
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<'detail' | 'changelog'>('detail')

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>
  if (!data) return <div className="p-8 text-stone-400">레포를 찾을 수 없습니다</div>

  const hasMultipleTracks = data.tracks.length > 1
  const track = data.tracks[selectedTrackIdx] || data.tracks[0]

  const totalChecks = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
  const doneChecks = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)
  const percent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  const owners = [...new Set(data.tracks.map(t => t.owner))].join(' · ')
  const currentWeek = track?.weeks.find(w => w.week === selectedWeek)
  const activePrd = data.prdPerTrack ? data.prdPerTrack[selectedTrackIdx] : data.prd
  const prdWeek = activePrd?.find(p => p.week === selectedWeek)

  // Build column labels for tab title
  const columnLabels = columns.map(c => c.label).join('/')

  return (
    <div className="min-h-screen bg-stone-50">
      <Header
        overallPercent={percent}
        subtitle={`${data.repo} · ${owners}`}
        backLink="#/"
      />

      <div className="flex bg-stone-800 px-6">
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-4 py-2.5 text-xs ${activeTab === 'detail' ? 'text-amber border-b-2 border-amber font-semibold' : 'text-stone-400'}`}
        >
          상세 ({columnLabels})
        </button>
        <button
          onClick={() => setActiveTab('changelog')}
          className={`px-4 py-2.5 text-xs ${activeTab === 'changelog' ? 'text-amber border-b-2 border-amber font-semibold' : 'text-stone-400'}`}
        >
          변경 이력
        </button>
      </div>

      {activeTab === 'detail' && (
        <>
          {hasMultipleTracks && (
            <div className="flex bg-stone-700 px-6">
              {data.tracks.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => { setSelectedTrackIdx(i); setSelectedStep(null) }}
                  className={`px-4 py-2 text-xs transition-colors ${
                    i === selectedTrackIdx
                      ? 'text-amber-light bg-stone-600 font-semibold'
                      : 'text-stone-400 hover:text-stone-300'
                  }`}
                >
                  {t.name} ({t.owner})
                </button>
              ))}
            </div>
          )}
          <WeekTabs selected={selectedWeek} onChange={w => { setSelectedWeek(w); setSelectedStep(null) }} />
          <div className={`grid grid-cols-1 lg:grid-cols-${columns.length} min-h-[400px]`}>
            {columns.map(col => (
              <ColumnRenderer
                key={col.id}
                column={col}
                steps={currentWeek?.steps || []}
                prdWeek={prdWeek}
                selectedStep={selectedStep}
                onSelectStep={setSelectedStep}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'changelog' && (
        <ChangelogTab changelog={data.changelog} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/src/pages/Detail.tsx
git commit -m "feat(templates): generalize Detail page with dynamic ColumnRenderer"
```

---

### Task 7: Static Template Files

**Files:**
- Create: multiple static files that are copied as-is from current codebase

These files don't need generalization — they already work dynamically or are config-independent.

- [ ] **Step 1: Copy static source files**

Copy the following files from the current `src/` to `skills/project-dashboard/templates/scaffold/src/` without modification:

| Source | Destination |
|---|---|
| `src/main.tsx` | `templates/scaffold/src/main.tsx` |
| `src/App.tsx` | `templates/scaffold/src/App.tsx` |
| `src/types/index.ts` | `templates/scaffold/src/types/index.ts` |
| `src/hooks/useConfig.ts` | `templates/scaffold/src/hooks/useConfig.ts` |
| `src/utils/progressColor.ts` | `templates/scaffold/src/utils/progressColor.ts` |
| `src/components/TrackCard.tsx` | `templates/scaffold/src/components/TrackCard.tsx` |
| `src/components/TimelineChart.tsx` | `templates/scaffold/src/components/TimelineChart.tsx` |
| `src/components/ChangelogTab.tsx` | `templates/scaffold/src/components/ChangelogTab.tsx` |
| `src/pages/Dashboard.tsx` | `templates/scaffold/src/pages/Dashboard.tsx` |
| `src/pages/Settings.tsx` | `templates/scaffold/src/pages/Settings.tsx` |

For Settings sub-components, copy the entire `src/components/settings/` directory.

For `TimelineChart.tsx`, remove the hardcoded `TRACK_COLORS` map (lines 11-21) and keep only the `AUTO_COLORS` array and hash-based color function. This makes it work for any project.

- [ ] **Step 2: Create template config files**

Create `skills/project-dashboard/templates/scaffold/package.json.tmpl`:

```json
{
  "name": "{{PROJECT_NAME}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "validate:data": "node scripts/validate-data.mjs",
    "sync": "node scripts/sync.mjs",
    "sync:dry": "node scripts/sync.mjs --dry-run",
    "preview": "vite preview"
  },
  "dependencies": {
    "chart.js": "^4.5.1",
    "react": "^19.2.6",
    "react-chartjs-2": "^5.3.1",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.15.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@tailwindcss/vite": "^4.3.0",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "tailwindcss": "^4.3.0",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12"
  }
}
```

Create `skills/project-dashboard/templates/scaffold/vite.config.ts.tmpl`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '{{BASE_PATH}}',
})
```

Create `skills/project-dashboard/templates/scaffold/index.html.tmpl`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_TITLE}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Geist+Mono&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Copy `tsconfig.json`, `tsconfig.app.json`, and `eslint.config.js` from the current project root as static files (no templating needed).

- [ ] **Step 3: Create data directory placeholder**

Create `skills/project-dashboard/templates/scaffold/data/.gitkeep` (empty file).

- [ ] **Step 4: Commit**

```bash
git add skills/project-dashboard/templates/scaffold/
git commit -m "feat(templates): add static scaffold files and .tmpl config templates"
```

---

### Task 8: Scaffold Generator Script

**Files:**
- Create: `scripts/scaffold.mjs`

This script takes a config object (from init module) and generates a complete project directory.

- [ ] **Step 1: Create the scaffold generator**

```javascript
#!/usr/bin/env node
/**
 * Scaffold generator — creates a new dashboard project from templates.
 * Usage: node scripts/scaffold.mjs <output-dir> <config-json>
 *
 * config-json is a path to a JSON file with the project configuration.
 * Templates are read from skills/project-dashboard/templates/scaffold/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync } from 'fs'
import { join, resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const [outputDir, configJsonPath] = process.argv.slice(2)
if (!outputDir || !configJsonPath) {
  console.error('Usage: node scripts/scaffold.mjs <output-dir> <config-json>')
  process.exit(1)
}

const config = JSON.parse(readFileSync(resolve(configJsonPath), 'utf-8'))
const templateDir = resolve(__dirname, '..', 'skills', 'project-dashboard', 'templates', 'scaffold')
const outDir = resolve(outputDir)

if (!existsSync(templateDir)) {
  console.error(`Template directory not found: ${templateDir}`)
  process.exit(1)
}

// Template variable replacements
const vars = {
  '{{PROJECT_NAME}}': config.project?.name?.toLowerCase().replace(/\s+/g, '-') || 'my-dashboard',
  '{{PROJECT_TITLE}}': config.project?.name || 'Dashboard',
  '{{BASE_PATH}}': config.basePath || '/',
}

function applyTemplate(content) {
  let result = content
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value)
  }
  return result
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const stat = statSync(srcPath)

    if (stat.isDirectory()) {
      copyDir(srcPath, join(dest, entry))
    } else if (entry.endsWith('.tmpl')) {
      // Template file — apply variable substitution, remove .tmpl extension
      const outName = entry.replace('.tmpl', '')
      const content = readFileSync(srcPath, 'utf-8')
      writeFileSync(join(dest, outName), applyTemplate(content))
      console.log(`  📝 ${relative(outDir, join(dest, outName))} (templated)`)
    } else {
      // Static file — copy as-is
      cpSync(srcPath, join(dest, entry))
      console.log(`  📄 ${relative(outDir, join(dest, entry))}`)
    }
  }
}

console.log(`\n🚀 Scaffolding project: ${vars['{{PROJECT_TITLE}}']}`)
console.log(`   Output: ${outDir}\n`)

// Copy all template files
copyDir(templateDir, outDir)

// Write the config.json
const configOutPath = join(outDir, 'data', 'config.json')
mkdirSync(dirname(configOutPath), { recursive: true })
writeFileSync(configOutPath, JSON.stringify(config, null, 2))
console.log(`  📝 data/config.json (generated)`)

// Create empty data files for each repo
for (const repo of config.repos || []) {
  const repoId = repo.id || repo.repo
  const trackName = repo.trackName || repo.tracks?.[0]?.name || repoId
  const owner = repo.owner || repo.tracks?.[0]?.owner || 'unknown'

  const emptyData = {
    repo: repoId,
    updatedAt: new Date().toISOString(),
    tracks: [{ name: trackName, owner, weeks: [] }],
    prd: [],
    history: [],
    changelog: [],
  }

  const dataPath = join(outDir, 'data', `${repoId}.json`)
  writeFileSync(dataPath, JSON.stringify(emptyData, null, 2))
  console.log(`  📝 data/${repoId}.json (empty)`)
}

// Remove .gitkeep if data files were created
const gitkeep = join(outDir, 'data', '.gitkeep')
if (existsSync(gitkeep) && readdirSync(join(outDir, 'data')).length > 1) {
  const { unlinkSync } = await import('fs')
  unlinkSync(gitkeep)
}

console.log(`\n✅ Project scaffolded at ${outDir}`)
console.log(`\nNext steps:`)
console.log(`  cd ${outputDir}`)
console.log(`  npm install`)
console.log(`  npm run dev`)
```

- [ ] **Step 2: Verify the script runs with a test config**

Create a temporary test config:

```bash
echo '{"project":{"name":"Test Dashboard"},"periods":[{"id":"W1","label":"W1","start":"2026-01-01","end":"2026-01-07"}],"columns":[{"id":"task","label":"Task","type":"checklist"}],"repos":[{"id":"test-repo","trackName":"Test","owner":"tester"}],"virtualTracks":[]}' > /tmp/test-config.json
node scripts/scaffold.mjs /tmp/test-dashboard /tmp/test-config.json
ls /tmp/test-dashboard/src/components/
rm -rf /tmp/test-dashboard /tmp/test-config.json
```

Expected: Shows file listing, then cleans up.

- [ ] **Step 3: Commit**

```bash
git add scripts/scaffold.mjs
git commit -m "feat: add scaffold generator script for project initialization"
```

---

### Task 9: Init Skill Module

**Files:**
- Create: `skills/project-dashboard/modules/init.md`

- [ ] **Step 1: Create the init module**

```markdown
# Init Module

Create a new dashboard project via interactive scaffolding.

## Arguments

Parse remaining arguments after `init`:

| Pattern | Action |
|---|---|
| (empty) | Interactive mode — ask all questions |
| `--test` | Self-test: scaffold to temp dir, verify build, clean up |

## Interactive Flow

Ask the user each question one at a time:

### 1. Project Name

"프로젝트 이름을 입력해주세요 (예: Synapse Dashboard):"

Store as `project.name`. Derive directory name: lowercase, spaces → hyphens.

### 2. Output Directory

"프로젝트를 생성할 디렉토리 경로: (기본: ./{project-name-slug})"

Default to `./{project-name}` in current directory. If directory exists, warn and ask to overwrite.

### 3. Period Structure

"주차 구조를 정의합니다. 몇 주차까지 필요한가요? (기본: 5)"

Then: "시작일을 입력해주세요 (YYYY-MM-DD, 기본: 이번 주 월요일):"

Auto-generate weekly periods:
- Calculate each week: start = previous end + 1 day (skip weekends)
- Generate: `[{ id: "W1", label: "W1", start: "...", end: "..." }, ...]`

Show generated periods and ask for confirmation.

### 4. Column Structure

"컬럼 구조를 선택하세요:
  a) PRD / Task / Workflow (기본 3컬럼)
  b) 커스텀 (직접 정의)"

If (a): use default columns
If (b): "컬럼을 정의해주세요 (형식: id:label:type, 쉼표 구분). type은 list, checklist, kanban 중 선택"
Example: `task:Task:checklist, review:Review:checklist`

### 5. Track Definitions (repeat)

"트랙을 추가합니다."

For each track:
1. "리포 ID (데이터 파일명): "
2. "트랙 표시명: "
3. "담당자: "
4. "데이터 소스: a) GitHub 마크다운  b) Notion  c) Linear  d) 수동 입력"
5. Based on source type:
   - GitHub: "GitHub 리포 (org/repo): " + "워크플로우 경로 (기본: docs/project-management): "
   - Notion: "Notion 데이터베이스 ID: "
   - Linear: "Linear 프로젝트 ID: "
   - Manual: no additional questions

After each track: "트랙을 더 추가할까요? (y/n)"

### 6. Virtual Tracks

"가상 트랙을 추가할까요? (여러 리포를 하나의 트랙으로 합침) (y/n)"

If yes:
1. "가상 트랙 ID: "
2. "표시명: "
3. "담당자: "
4. Show list of defined repos, ask which to combine: "합칠 리포를 선택하세요 (번호, 쉼표 구분): "

### 7. Base Path

"배포 경로를 입력해주세요 (기본: /):"
Example: `/my-dashboard/` for GitHub Pages subdirectory.

## Scaffold Execution

After collecting all input, build the config object:

```json
{
  "version": 1,
  "project": { "name": "...", "description": "" },
  "periods": [...],
  "columns": [...],
  "repos": [...],
  "virtualTracks": [...],
  "basePath": "/"
}
```

Then run the scaffold generator:

1. Write config to a temporary file
2. Run: `node scripts/scaffold.mjs {output-dir} {temp-config-path}`
3. Delete temporary config file
4. Copy parser scripts from `scripts/parsers/` to `{output-dir}/scripts/parsers/`
5. Copy `scripts/sync.mjs` to `{output-dir}/scripts/sync.mjs`
6. Copy `scripts/validate-data.mjs` to `{output-dir}/scripts/validate-data.mjs`

Report:

```
✅ 프로젝트가 생성되었습니다!

📁 {output-dir}/
  ├── src/          — React 앱 ({columns.length}개 컬럼, {periods.length}개 주차)
  ├── data/         — config.json + {repos.length}개 트랙 데이터
  ├── scripts/      — 검증 + 파서 + 동기화
  └── package.json

다음 단계:
  cd {output-dir}
  npm install
  npm run dev        — 개발 서버 시작
  npm run sync       — 데이터 동기화
```

## Self-Test (--test)

When `--test` is passed:

1. Create a temp directory
2. Build a minimal test config:
   ```json
   {
     "version": 1,
     "project": { "name": "Test Dashboard" },
     "periods": [{ "id": "W1", "label": "W1", "start": "2026-01-01", "end": "2026-01-07" }],
     "columns": [{ "id": "task", "label": "Task", "type": "checklist" }],
     "repos": [{ "id": "test-repo", "trackName": "Test", "owner": "tester", "source": { "type": "manual" } }],
     "virtualTracks": []
   }
   ```
3. Run scaffold generator
4. Run: `cd {temp-dir} && npm install && npm run build`
5. Run: `npm run validate:data`
6. If all pass: "✅ Self-test passed"
7. Clean up temp directory
8. If any step fails: show error and keep temp directory for debugging
```

- [ ] **Step 2: Commit**

```bash
git add skills/project-dashboard/modules/init.md
git commit -m "feat(skill): add init module with interactive scaffolding flow"
```

---

### Task 10: Update Main Router

**Files:**
- Modify: `skills/project-dashboard/project-dashboard.md`

Verify the init subcommand is already routed. It should be from Phase 1, but verify.

- [ ] **Step 1: Read router and confirm init is listed**

Run: `grep -n "init" skills/project-dashboard/project-dashboard.md`

Expected: Shows `init` in the subcommand table. If missing, add it.

- [ ] **Step 2: Commit (only if changes needed)**

```bash
git add skills/project-dashboard/project-dashboard.md
git commit -m "fix(skill): ensure init module is routed in main skill"
```

---

### Task 11: Integration Test

**Files:**
- No new files

- [ ] **Step 1: Verify template directory structure**

Run: `find skills/project-dashboard/templates/scaffold -type f | sort`

Expected: All template files present (src/, scripts/, data/, config files).

- [ ] **Step 2: Verify all skill modules present**

Run: `ls skills/project-dashboard/modules/`

Expected: `config.md  edit.md  init.md  status.md  sync.md`

- [ ] **Step 3: Run scaffold self-test**

Run:
```bash
TMPDIR=$(mktemp -d)
echo '{"version":1,"project":{"name":"Test"},"periods":[{"id":"W1","label":"W1","start":"2026-01-01","end":"2026-01-07"}],"columns":[{"id":"task","label":"Task","type":"checklist"}],"repos":[{"id":"test","trackName":"Test","owner":"x"}],"virtualTracks":[]}' > "$TMPDIR/cfg.json"
node scripts/scaffold.mjs "$TMPDIR/out" "$TMPDIR/cfg.json"
ls "$TMPDIR/out/src/components/"
ls "$TMPDIR/out/data/"
rm -rf "$TMPDIR"
```

Expected: Component files listed, data/config.json + data/test.json present.

- [ ] **Step 4: Verify current project build still passes**

Run: `npm run build && npm run validate:data`

Expected: Both pass.

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: integration test adjustments for scaffold pipeline"
```

---

## Plan Summary

| Task | What it creates | Depends on |
|---|---|---|
| Task 1 | `templates/.../types/config.ts` (generalized types) | — |
| Task 2 | `templates/.../hooks/useData.ts` (config-driven periods) | Task 1 |
| Task 3 | `templates/.../components/Header.tsx` (dynamic title) | Task 1 |
| Task 4 | `templates/.../WeekTabs.tsx` + `ProgressTable.tsx` (dynamic weeks) | Task 1 |
| Task 5 | `ColumnRenderer.tsx` + `ChecklistColumn.tsx` + `ListColumn.tsx` | Task 1 |
| Task 6 | `templates/.../pages/Detail.tsx` (dynamic columns) | Tasks 1, 5 |
| Task 7 | Static template files (copy + clean) | — |
| Task 8 | `scripts/scaffold.mjs` (generator) | Tasks 1-7 |
| Task 9 | `skills/.../modules/init.md` (skill instructions) | Task 8 |
| Task 10 | Router verification | Task 9 |
| Task 11 | Integration test | Tasks 1-10 |

## Spec Coverage Check

| Spec Section | Covered By |
|---|---|
| §3 Init — interactive questions | Task 9 (init.md) |
| §3 Init — scaffold output | Tasks 7-8 (templates + scaffold.mjs) |
| §3 Init — config.json as source of truth | Tasks 1-2 (types + useData) |
| §8 Schema — periods array | Tasks 2, 4 (useData, WeekTabs, ProgressTable) |
| §8 Schema — columns array | Tasks 5-6 (ColumnRenderer, Detail) |
| §8 Schema — repos with source | Task 1 (config types) |
| §9 Frontend — dynamic Header | Task 3 |
| §9 Frontend — ColumnRenderer dispatch | Task 5 |
| §9 Frontend — config-driven Detail | Task 6 |
| §9 Frontend — dynamic ProgressTable | Task 4 |
