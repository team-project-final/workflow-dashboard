import { useData } from '../hooks/useData'
import Header from '../components/Header'
import TrackCard from '../components/TrackCard'
import ProgressTable from '../components/ProgressTable'
import TimelineChart from '../components/TimelineChart'
import OverrideBanner from '../components/OverrideBanner'

export default function Dashboard() {
  const { data, loading, overallPercent, overrides, clearOverrides } = useData()

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>

  const staleSet = new Set(overrides.filter(o => o.serverNewer).map(o => o.repo))

  const trackEntries = data.flatMap(d => {
    if (d.tracks.length > 1 && d.tracks[0].owner === d.tracks[1]?.owner) {
      return [{ repoData: d, trackName: d.repo, owner: d.tracks[0].owner, repos: d.tracks.map(t => t.name) }]
    }
    return d.tracks.map(t => ({ repoData: d, trackName: t.name, owner: t.owner, repos: [d.repo] }))
  })

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} />

      <OverrideBanner overrides={overrides} onRefresh={clearOverrides} />

      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-stone-600 mb-2">트랙별 현황</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {trackEntries.map(e => (
            <TrackCard
              key={e.trackName}
              repoData={e.repoData}
              trackName={e.trackName}
              owner={e.owner}
              staleOverride={e.repos.some(r => staleSet.has(r))}
            />
          ))}
        </div>
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressTable data={data} />
        <TimelineChart data={data} />
      </div>
    </div>
  )
}
