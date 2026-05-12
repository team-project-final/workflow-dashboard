import { useState, useEffect } from 'react'
import type { RepoData } from '../types'

const DEFAULT_TRACKS: { repo: string; tracks: { name: string; owner: string }[] }[] = [
  { repo: 'synapse-platform-svc', tracks: [{ name: 'platform', owner: '김해준' }] },
  { repo: 'synapse-engagement-svc', tracks: [{ name: 'engagement', owner: '한승완' }] },
  { repo: 'synapse-knowledge-svc', tracks: [{ name: 'knowledge-1', owner: '김현지' }, { name: 'knowledge-2', owner: '박은서' }] },
  { repo: 'synapse-learning-svc', tracks: [{ name: 'learning-card', owner: '김나경' }, { name: 'learning-ai', owner: '조유지' }] },
  { repo: 'synapse-frontend', tracks: [{ name: 'frontend', owner: '전원' }] },
  { repo: 'synapse-shared', tracks: [{ name: 'team-lead', owner: '김민구' }] },
]

const REPOS = DEFAULT_TRACKS.map(d => d.repo)

function emptyRepoData(repo: string, tracks: { name: string; owner: string }[]): RepoData {
  return {
    repo,
    updatedAt: '',
    tracks: tracks.map(t => ({ name: t.name, owner: t.owner, weeks: [] })),
    prd: [],
    history: [],
    changelog: [],
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
        results[i] as RepoData ?? emptyRepoData(def.repo, def.tracks)
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
  const [data, setData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const def = DEFAULT_TRACKS.find(d => d.repo === repo)
    fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d ?? (def ? emptyRepoData(def.repo, def.tracks) : null))
        setLoading(false)
      })
      .catch(() => {
        setData(def ? emptyRepoData(def.repo, def.tracks) : null)
        setLoading(false)
      })
  }, [repo])

  return { data, loading }
}
