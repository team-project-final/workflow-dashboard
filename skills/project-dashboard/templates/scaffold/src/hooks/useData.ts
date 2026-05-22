import { useState, useEffect } from 'react'
import type { RepoData, Track, Week } from '../types'
import type { DashboardConfig, LegacyRepoDef, LegacyVirtualTrackDef, VirtualTrackSource } from '../types/config'
import { useConfig } from './useConfig'
import { isNewFormat, getRepoId } from '../types/config'

// Fallback weeks for legacy configs without periods
export const WEEKS_META = [
  { week: 'W1', period: '' },
  { week: 'W2', period: '' },
  { week: 'W3', period: '' },
  { week: 'W4', period: '' },
  { week: 'W5', period: '' },
]

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

  const allTracks: Track[] = validResults.flatMap((r, i) => {
    const src = sources[i]
    if (src?.track) {
      const match = r.tracks.find(t => t.name === src.track)
      return match ? [normalizeTrack(match, weeksMeta)] : []
    }
    return r.tracks.map(t => normalizeTrack(t, weeksMeta))
  })

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

  const changelog = validResults
    .flatMap(r => r.changelog || [])
    .sort((a, b) => b.date.localeCompare(a.date))

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

      for (const vt of config!.virtualTracks) {
        const sources = getVirtualTrackSources(vt as LegacyVirtualTrackDef)
        sources.forEach(s => vtSourceRepos.add(s.repo))
      }

      const results = await Promise.all(
        repoIds.map(async id => {
          const raw = await fetchRepoJson(id)
          if (!raw) return null
          const repoCfg = isNew ? {} : { tracks: (config!.repos.find(r => getRepoId(r) === id) as LegacyRepoDef)?.tracks }
          return normalizeRepoData(raw, config!, repoCfg)
        })
      )

      const vtResults: RepoData[] = []
      for (const vt of config!.virtualTracks) {
        const sources = getVirtualTrackSources(vt as LegacyVirtualTrackDef)
        const sourceData = await Promise.all(sources.map(s => fetchRepoJson(s.repo)))
        vtResults.push(mergeVirtualTrackData(vt, sourceData, sources, config!))
      }

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
