import { useState, useEffect } from 'react'
import type { PrdWeek, RepoData, Track, Week } from '../types'

const DEFAULT_TRACKS: { repo: string; tracks: { name: string; owner: string }[] }[] = [
  { repo: 'synapse-platform-svc', tracks: [{ name: 'platform', owner: '김해준' }] },
  { repo: 'synapse-engagement-svc', tracks: [{ name: 'engagement', owner: '한승완' }] },
  { repo: 'synapse-knowledge-svc', tracks: [{ name: 'knowledge-1', owner: '김현지' }, { name: 'knowledge-2', owner: '박은서' }] },
  { repo: 'synapse-learning-svc', tracks: [{ name: 'learning-card', owner: '조유지' }, { name: 'learning-ai', owner: '김나경' }] },
  { repo: 'synapse-frontend', tracks: [{ name: 'frontend', owner: '전원' }] },
  { repo: 'synapse-gitops', tracks: [{ name: 'team-lead', owner: '김민구' }] },
]

const REPOS = DEFAULT_TRACKS.map(d => d.repo)

export const WEEKS_META = [
  { week: 'W1', period: '05-12~05-16' },
  { week: 'W2', period: '05-19~05-23' },
  { week: 'W3', period: '05-26~05-29' },
  { week: 'W4', period: '06-01~06-05' },
  { week: 'W5', period: '06-08~06-12' },
]

type TrackDef = { name: string; owner: string }

function emptyWeek(week: string, period: string): Week {
  return {
    week,
    period,
    steps: [],
    totalChecks: 0,
    doneChecks: 0,
  }
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
    weeks: WEEKS_META.map(weekMeta =>
      normalizeWeek(track?.weeks?.find(w => w.week === weekMeta.week), weekMeta)
    ),
  }
}

function normalizePrdWeek(prdWeek: PrdWeek | undefined, weekMeta: typeof WEEKS_META[number]): PrdWeek {
  return {
    week: weekMeta.week,
    items: prdWeek?.items || [],
  }
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

function normalizeRepoData(raw: RepoData | null, def: { repo: string; tracks: TrackDef[] }): RepoData {
  if (!raw) return emptyRepoData(def.repo, def.tracks)

  return {
    ...raw,
    repo: raw.repo || def.repo,
    updatedAt: raw.updatedAt || '',
    tracks: def.tracks.map(trackDef =>
      normalizeTrack(raw.tracks?.find(t => t.name === trackDef.name), trackDef)
    ),
    prd: WEEKS_META.map(weekMeta =>
      normalizePrdWeek(raw.prd?.find(p => p.week === weekMeta.week), weekMeta)
    ),
    history: raw.history || [],
    changelog: raw.changelog || [],
  }
}

export function useData() {
  const [data, setData] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(
      REPOS.map(repo =>
        fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const merged = DEFAULT_TRACKS.map((def, i) =>
        normalizeRepoData(results[i] as RepoData | null, def)
      )
      setData(merged)
      setLoading(false)
    }).catch(err => {
      setError(err.message)
      setLoading(false)
    })
  }, [])

  const totalChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0), 0)
  const doneChecks = data.reduce((s, d) =>
    s + d.tracks.reduce((ts, t) => ts + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0), 0)
  const overallPercent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  return { data, loading, error, overallPercent, totalChecks, doneChecks }
}

export function useRepoData(repo: string) {
  const def = DEFAULT_TRACKS.find(d => d.repo === repo)
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!def) return

    fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(normalizeRepoData(d, def))
        setLoading(false)
      })
      .catch(() => {
        setData(emptyRepoData(def.repo, def.tracks))
        setLoading(false)
      })
  }, [repo, def])

  return def ? { data, loading } : { data: null, loading: false }
}
