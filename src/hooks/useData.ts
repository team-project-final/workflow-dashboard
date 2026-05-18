import { useState, useEffect } from 'react'
import type { PrdWeek, RepoData, Track, Week } from '../types'

const DEFAULT_TRACKS: { repo: string; tracks: { name: string; owner: string }[] }[] = [
  { repo: 'synapse-platform-svc', tracks: [{ name: 'platform', owner: '김해준' }] },
  { repo: 'synapse-engagement-svc', tracks: [{ name: 'engagement', owner: '한승완' }] },
  { repo: 'synapse-knowledge-svc', tracks: [{ name: 'knowledge-1', owner: '김현지' }, { name: 'knowledge-2', owner: '박은서' }] },
  { repo: 'synapse-learning-svc', tracks: [{ name: 'learning-card', owner: '조유지' }, { name: 'learning-ai', owner: '김나경' }] },
  { repo: 'synapse-frontend', tracks: [{ name: 'frontend', owner: '전원' }] },
]

const TEAM_LEAD_CONFIG = {
  virtualRepo: 'team-lead',
  sources: ['synapse-gitops', 'synapse-shared'] as const,
  owner: '김민구',
}

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

function mergeTeamLeadData(
  gitopsRaw: RepoData | null,
  sharedRaw: RepoData | null,
): RepoData {
  const gitopsDef = { repo: 'synapse-gitops', tracks: [{ name: 'team-lead', owner: TEAM_LEAD_CONFIG.owner }] }
  const sharedDef = { repo: 'synapse-shared', tracks: [{ name: 'team-lead', owner: TEAM_LEAD_CONFIG.owner }] }

  const gitopsData = normalizeRepoData(gitopsRaw, gitopsDef)
  const sharedData = normalizeRepoData(sharedRaw, sharedDef)

  const gitopsTrack = gitopsData.tracks[0]
  const sharedTrack = sharedData.tracks[0]

  const tracks: Track[] = [
    { name: 'synapse-gitops', owner: TEAM_LEAD_CONFIG.owner, weeks: gitopsTrack.weeks },
    { name: 'synapse-shared', owner: TEAM_LEAD_CONFIG.owner, weeks: sharedTrack.weeks },
  ]

  // Merge history by date: sum totalChecks/doneChecks from both repos per date
  const historyMap = new Map<string, { totalChecks: number; doneChecks: number }>()
  for (const h of [...gitopsData.history, ...sharedData.history]) {
    const existing = historyMap.get(h.date)
    if (existing) {
      existing.totalChecks += h.totalChecks
      existing.doneChecks += h.doneChecks
    } else {
      historyMap.set(h.date, { totalChecks: h.totalChecks, doneChecks: h.doneChecks })
    }
  }
  const mergedHistory = [...historyMap].map(([date, v]) => ({ date, ...v }))

  const mergedChangelog = [...gitopsData.changelog, ...sharedData.changelog]
    .sort((a, b) => b.date.localeCompare(a.date))

  const combinedPrd: PrdWeek[] = WEEKS_META.map(wm => {
    const gitopsItems = gitopsData.prd.find(p => p.week === wm.week)?.items || []
    const sharedItems = sharedData.prd.find(p => p.week === wm.week)?.items || []
    return { week: wm.week, items: [...gitopsItems, ...sharedItems] }
  })

  return {
    repo: 'team-lead',
    updatedAt: gitopsData.updatedAt > sharedData.updatedAt ? gitopsData.updatedAt : sharedData.updatedAt,
    tracks,
    prd: combinedPrd,
    prdPerTrack: [gitopsData.prd, sharedData.prd],
    history: mergedHistory,
    changelog: mergedChangelog,
  }
}

export function useData() {
  const [data, setData] = useState<RepoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const allFetches = [
      ...REPOS.map(repo =>
        fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ),
      ...TEAM_LEAD_CONFIG.sources.map(repo =>
        fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ),
    ]

    Promise.all(allFetches).then(results => {
      const repoResults = results.slice(0, REPOS.length)
      const [gitopsResult, sharedResult] = results.slice(REPOS.length)

      const merged = DEFAULT_TRACKS.map((def, i) =>
        normalizeRepoData(repoResults[i] as RepoData | null, def)
      )

      const teamLeadData = mergeTeamLeadData(
        gitopsResult as RepoData | null,
        sharedResult as RepoData | null,
      )

      setData([...merged, teamLeadData])
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
  const isTeamLead = repo === 'team-lead'
  const shouldFetch = !!(def || isTeamLead)
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(shouldFetch)

  useEffect(() => {
    if (!shouldFetch) return

    if (isTeamLead) {
      Promise.all(
        TEAM_LEAD_CONFIG.sources.map(r =>
          fetch(`${import.meta.env.BASE_URL}data/${r}.json`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        )
      ).then(([gitopsResult, sharedResult]) => {
        setData(mergeTeamLeadData(
          gitopsResult as RepoData | null,
          sharedResult as RepoData | null,
        ))
        setLoading(false)
      }).catch(() => {
        setData(mergeTeamLeadData(null, null))
        setLoading(false)
      })
      return
    }

    fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(normalizeRepoData(d, def!))
        setLoading(false)
      })
      .catch(() => {
        setData(emptyRepoData(def!.repo, def!.tracks))
        setLoading(false)
      })
  }, [repo, def, isTeamLead, shouldFetch])

  return shouldFetch ? { data, loading } : { data: null, loading: false }
}
