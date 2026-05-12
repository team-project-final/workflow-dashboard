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
  if (!track) return null

  const totalChecks = track.weeks.reduce((s, w) => s + w.totalChecks, 0)
  const doneChecks = track.weeks.reduce((s, w) => s + w.doneChecks, 0)
  const percent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  const borderColor = percent >= 60 ? 'border-amber' : percent >= 30 ? 'border-stone-300' : 'border-danger'

  return (
    <div
      onClick={() => navigate(`/detail/${repoData.repo}`)}
      className={`bg-white border-2 ${borderColor} rounded-xl p-4 text-center cursor-pointer
        hover:shadow-lg transition-shadow`}
    >
      <div className={`text-3xl font-bold font-display ${
        percent >= 60 ? 'text-amber' : percent >= 30 ? 'text-stone-600' : 'text-danger'
      }`}>
        {percent}%
      </div>
      <div className="text-xs font-semibold text-stone-600 mt-1">{repoData.repo.replace('synapse-', '')}</div>
      <div className="text-[10px] text-stone-400">{owner}</div>
      <div className="mt-2 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${percent >= 60 ? 'bg-amber' : percent >= 30 ? 'bg-stone-500' : 'bg-danger'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex gap-0.5 mt-2 justify-center">
        {track.weeks.map(w => {
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
