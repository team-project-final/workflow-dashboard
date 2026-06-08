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

    // sync(sync-data.yml)와 동일한 브랜치 선택: 워크플로우 문서가 있는, 가장 최근 커밋 브랜치.
    // 기본 브랜치(main)만 보면 dev 등 최신 작업 브랜치와 어긋난다(예: knowledge-svc).
    async function resolveBranch(repoId: string): Promise<string> {
      const meta = await call<{ default_branch: string }>(`/repos/${REPO_OWNER}/${repoId}`)
      const defaultBranch = meta.data?.default_branch || 'main'

      const branches = await call<{ name: string }[]>(
        `/repos/${REPO_OWNER}/${repoId}/branches?per_page=100`
      )
      if (!branches.ok || !branches.data || branches.data.length === 0) return defaultBranch

      const dated = await Promise.all(branches.data.map(async b => {
        const c = await call<{ commit: { committer: { date: string } } }>(
          `/repos/${REPO_OWNER}/${repoId}/commits/${b.name}`
        )
        return { name: b.name, date: c.data?.commit?.committer?.date || '' }
      }))
      dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

      for (const b of dated) {
        const has = await call<unknown[]>(
          `/repos/${REPO_OWNER}/${repoId}/contents/${WORKFLOW_DIR}?ref=${b.name}`
        )
        if (has.ok && Array.isArray(has.data) && has.data.length > 0) return b.name
      }
      return defaultBranch
    }

    async function fetchOne(repoId: string): Promise<LiveMeta> {
      const branch = await resolveBranch(repoId)
      const list = await call<ContentItem[]>(
        `/repos/${REPO_OWNER}/${repoId}/contents/${WORKFLOW_DIR}?ref=${branch}`
      )
      if (!list.ok || !list.data) {
        return { totalChecks: 0, doneChecks: 0, fetching: false, error: list.errorMessage || `HTTP ${list.status}`, branch }
      }
      const mdFiles = list.data.filter(f =>
        f.type === 'file' && f.name.startsWith('WORKFLOW_') && f.name.endsWith('.md')
      )
      let total = 0, done = 0
      for (const f of mdFiles) {
        // download_url(raw.githubusercontent.com)은 Authorization 헤더와 CORS preflight가
        // 충돌해 브라우저에서 실패한다. api.github.com contents 엔드포인트는 CORS를 지원하므로
        // raw 미디어 타입으로 본문을 직접 받는다.
        const raw = await call<string>(
          `/repos/${REPO_OWNER}/${repoId}/contents/${WORKFLOW_DIR}/${f.name}?ref=${branch}`,
          { expect: 'text', headers: { Accept: 'application/vnd.github.raw' } }
        )
        if (!raw.ok || !raw.data) continue
        const steps = parseWorkflowMarkdown(raw.data)
        for (const s of steps) {
          total += s.totalChecks
          done += s.doneChecks
        }
      }
      return { totalChecks: total, doneChecks: done, fetching: false, error: null, branch }
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
