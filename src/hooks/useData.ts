import { useState, useEffect } from 'react'
import type { PrdWeek, RepoData, Track, Week } from '../types'
import type { RepoDef, TrackDef, VirtualTrackDef } from '../types/config'
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

    const vtSourceRepos = new Set(config.virtualTracks.flatMap(vt => vt.sources.map(s => s.repo)))
    const regularRepos = config.repos.filter(r => !vtSourceRepos.has(r.repo))

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
      // Defer to avoid sync setState in effect
      Promise.resolve().then(() => {
        setData(null)
        setLoading(false)
      })
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
