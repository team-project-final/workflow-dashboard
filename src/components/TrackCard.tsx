import { useNavigate } from 'react-router-dom'
import type { RepoData } from '../types'

interface TrackCardProps {
  repoData: RepoData
  trackName: string
  owner: string
}

export default function TrackCard({ repoData, trackName, owner }: TrackCardProps) {
  const navigate = useNavigate()
  const track = repoData.tracks.find(t => t.name === trackName)
  const isCombined = !track && repoData.tracks.length > 0

  if (!track && !isCombined) return null

  const totalChecks = isCombined
    ? repoData.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
    : track!.weeks.reduce((s, w) => s + w.totalChecks, 0)
  const doneChecks = isCombined
    ? repoData.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)
    : track!.weeks.reduce((s, w) => s + w.doneChecks, 0)
  const percent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  // For combined sparkline, merge weekly totals across all tracks
  const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5']
  const weeklyData = isCombined
    ? WEEKS.map(w => {
        const tc = repoData.tracks.reduce((s, t) => s + (t.weeks.find(wk => wk.week === w)?.totalChecks || 0), 0)
        const dc = repoData.tracks.reduce((s, t) => s + (t.weeks.find(wk => wk.week === w)?.doneChecks || 0), 0)
        return { week: w, totalChecks: tc, doneChecks: dc }
      })
    : track!.weeks

  const hasData = totalChecks > 0
  const borderColor = !hasData ? 'border-stone-200' : percent >= 60 ? 'border-amber' : percent >= 30 ? 'border-stone-300' : 'border-danger'

  return (
    <div
      onClick={() => navigate(`/detail/${repoData.repo}`)}
      className={`bg-white border-2 ${borderColor} rounded-xl p-4 text-center cursor-pointer
        hover:shadow-lg transition-shadow`}
    >
      <div className={`text-3xl font-bold font-display ${
        !hasData ? 'text-stone-400' : percent >= 60 ? 'text-amber' : percent >= 30 ? 'text-stone-600' : 'text-danger'
      }`}>
        {percent}%
      </div>
      <div className="text-xs font-semibold text-stone-600 mt-1">{trackName}</div>
      <div className="text-[10px] text-stone-400">{owner}</div>
      <div className="mt-2 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${percent >= 60 ? 'bg-amber' : percent >= 30 ? 'bg-stone-500' : 'bg-danger'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex gap-0.5 mt-2 justify-center">
        {weeklyData.map(w => {
          const wp = w.totalChecks > 0 ? Math.round(w.doneChecks / w.totalChecks * 100) : 0
          return (
            <div key={w.week} className="flex flex-col items-center">
              <div
                className={`w-3.5 rounded-sm ${wp > 60 ? 'bg-success' : wp > 0 ? 'bg-amber' : 'bg-stone-200'}`}
                style={{ height: `${Math.max(4, wp * 0.2)}px` }}
              />
              <span className="text-[7px] text-stone-400 mt-0.5">{w.week}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
