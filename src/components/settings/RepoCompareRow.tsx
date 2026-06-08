import type { RepoData } from '../../types'

export interface LiveMeta {
  totalChecks: number
  doneChecks: number
  fetching: boolean
  error: string | null
  branch?: string
}

interface Props {
  repoId: string
  cache: RepoData | null
  live: LiveMeta | null  // null = 실시간 미사용 (PAT 없음)
  selected: boolean
  onToggle: () => void
}

function sumChecks(repo: RepoData | null): { total: number; done: number } {
  if (!repo) return { total: 0, done: 0 }
  let total = 0, done = 0
  for (const t of repo.tracks || []) {
    for (const w of t.weeks || []) {
      total += w.totalChecks || 0
      done += w.doneChecks || 0
    }
  }
  return { total, done }
}

function diffMarker(cache: number, live: number): string {
  if (live > cache) return '▲'
  if (live < cache) return '▼'
  return '='
}

export default function RepoCompareRow({ repoId, cache, live, selected, onToggle }: Props) {
  const c = sumChecks(cache)
  return (
    <tr className="border-t border-stone-200">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-2 font-mono text-sm">{repoId}</td>
      <td className="px-3 py-2 text-sm text-stone-700">
        {cache ? `${c.done}/${c.total}` : <span className="text-stone-400">없음</span>}
      </td>
      <td className="px-3 py-2 text-sm">
        {live === null ? (
          <span className="text-stone-400">PAT 필요</span>
        ) : live.fetching ? (
          <span className="text-stone-400">불러오는 중…</span>
        ) : live.error ? (
          <span className="text-red-500" title={live.error}>오류</span>
        ) : (
          <span className="text-stone-700">
            {live.doneChecks}/{live.totalChecks}
            {live.branch && <span className="ml-1.5 text-xs text-stone-400">@{live.branch}</span>}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-center">
        {live && !live.fetching && !live.error ? (
          <>
            <span>{diffMarker(c.done, live.doneChecks)} done</span>
            {' '}
            <span>{diffMarker(c.total, live.totalChecks)} total</span>
          </>
        ) : '—'}
      </td>
    </tr>
  )
}
