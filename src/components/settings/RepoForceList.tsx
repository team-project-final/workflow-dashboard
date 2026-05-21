import { useEffect, useState } from 'react'
import RepoCompareRow, { type LiveMeta } from './RepoCompareRow'
import { useGithubApi } from '../../hooks/useGithubApi'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'
import { parseWorkflowMarkdown } from '../../utils/parseWorkflowMd'
import type { DashboardConfig } from '../../types/config'
import type { RepoData } from '../../types'

const REPO_OWNER = 'team-project-final'
const WORKFLOW_DIR = 'docs/project-management/workflow'

interface Props {
  config: DashboardConfig
  cacheByRepo: Record<string, RepoData | null>
  selected: Set<string>
  onToggle: (repoId: string) => void
}

interface ContentItem { name: string; download_url: string | null; type: string }

export default function RepoForceList({ config, cacheByRepo, selected, onToggle }: Props) {
  const { call } = useGithubApi()
  const { token } = useForceSyncPat()
  const [liveByRepo, setLiveByRepo] = useState<Record<string, LiveMeta>>({})

  const repoIds = config.repos.map(r => r.repo)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function fetchOne(repoId: string): Promise<LiveMeta> {
      const list = await call<ContentItem[]>(
        `/repos/${REPO_OWNER}/${repoId}/contents/${WORKFLOW_DIR}`
      )
      if (!list.ok || !list.data) {
        return { totalChecks: 0, doneChecks: 0, fetching: false, error: list.errorMessage || `HTTP ${list.status}` }
      }
      const mdFiles = list.data.filter(f =>
        f.type === 'file' && f.name.startsWith('WORKFLOW_') && f.name.endsWith('.md') && f.download_url
      )
      let total = 0, done = 0
      for (const f of mdFiles) {
        const raw = await call<string>(f.download_url!, { expect: 'text' })
        if (!raw.ok || !raw.data) continue
        const steps = parseWorkflowMarkdown(raw.data)
        for (const s of steps) {
          total += s.totalChecks
          done += s.doneChecks
        }
      }
      return { totalChecks: total, doneChecks: done, fetching: false, error: null }
    }

    repoIds.forEach(repoId => {
      fetchOne(repoId).then(meta => {
        if (cancelled) return
        setLiveByRepo(prev => ({ ...prev, [repoId]: meta }))
      })
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <table className="w-full border border-stone-200 bg-white rounded">
      <thead className="bg-stone-50 text-xs text-stone-500 uppercase">
        <tr>
          <th className="px-3 py-2 text-left w-10"></th>
          <th className="px-3 py-2 text-left">레포</th>
          <th className="px-3 py-2 text-left">캐시 (done/total)</th>
          <th className="px-3 py-2 text-left">실시간 (done/total)</th>
          <th className="px-3 py-2 text-center">diff</th>
        </tr>
      </thead>
      <tbody>
        {repoIds.map(repoId => (
          <RepoCompareRow
            key={repoId}
            repoId={repoId}
            cache={cacheByRepo[repoId] || null}
            live={token ? (liveByRepo[repoId] || { totalChecks: 0, doneChecks: 0, fetching: true, error: null }) : null}
            selected={selected.has(repoId)}
            onToggle={() => onToggle(repoId)}
          />
        ))}
      </tbody>
    </table>
  )
}
