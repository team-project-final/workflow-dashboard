import { useData } from '../hooks/useData'
import Header from '../components/Header'
import TrackCard from '../components/TrackCard'
import ProgressTable from '../components/ProgressTable'
import TimelineChart from '../components/TimelineChart'

export default function Dashboard() {
  const { data, loading, overallPercent } = useData()

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>

  const trackEntries = data.flatMap(d =>
    d.tracks.map(t => ({ repoData: d, trackName: t.name, owner: t.owner }))
  )

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} />

      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-stone-600 mb-2">트랙별 현황</h2>
        {trackEntries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm text-stone-500">아직 등록된 트랙 데이터가 없습니다</p>
            <p className="text-xs text-stone-400 mt-1">서비스 레포에서 WORKFLOW/TASK 파일이 변경되면 자동으로 반영됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trackEntries.map(e => (
              <TrackCard key={e.trackName} {...e} />
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressTable data={data} />
        <TimelineChart data={data} />
      </div>
    </div>
  )
}
