import type { OverrideStatus } from '../utils/overrideStatus'

interface Props {
  overrides: OverrideStatus[]
  onRefresh: (repos: string[]) => void
}

function fmt(iso: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—'
}

export default function OverrideBanner({ overrides, onRefresh }: Props) {
  const stale = overrides.filter(o => o.serverNewer)
  if (stale.length === 0) return null

  return (
    <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-amber-800">
          ⚠️ 로컬에서 편집한 {stale.length}개 레포에 서버 최신본이 있습니다.
        </span>
        <button
          onClick={() => onRefresh(stale.map(o => o.repo))}
          className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-md font-medium"
        >
          전체 갱신
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {stale.map(o => (
          <li key={o.repo} className="flex items-center justify-between text-xs text-amber-800">
            <span>
              <span className="font-medium">{o.repo}</span>
              <span className="text-amber-600"> — 로컬 {fmt(o.overrideUpdatedAt)} → 서버 {fmt(o.serverUpdatedAt)}</span>
            </span>
            <button
              onClick={() => onRefresh([o.repo])}
              className="px-2 py-1 border border-amber-300 text-amber-700 rounded"
            >
              갱신
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
