import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRepoData } from '../hooks/useData'
import { useConfig } from '../hooks/useConfig'
import Header from '../components/Header'
import WeekTabs from '../components/WeekTabs'
import ColumnRenderer from '../components/ColumnRenderer'
import ChangelogTab from '../components/ChangelogTab'
import type { Step } from '../types'
import type { ColumnDef } from '../types/config'

// Default columns for legacy configs
const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'prd', label: 'PRD', type: 'list' },
  { id: 'task', label: 'Task', type: 'checklist' },
  { id: 'workflow', label: 'Workflow', type: 'checklist' },
]

export default function Detail() {
  const { repo } = useParams<{ repo: string }>()
  const { data, loading } = useRepoData(repo || '')
  const { config } = useConfig()
  const columns = config?.columns || DEFAULT_COLUMNS

  const [selectedWeek, setSelectedWeek] = useState(config?.periods?.[0]?.id || 'W1')
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<'detail' | 'changelog'>('detail')

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>
  if (!data) return <div className="p-8 text-stone-400">레포를 찾을 수 없습니다</div>

  const hasMultipleTracks = data.tracks.length > 1
  const track = data.tracks[selectedTrackIdx] || data.tracks[0]

  const totalChecks = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.totalChecks, 0), 0)
  const doneChecks = data.tracks.reduce((s, t) => s + t.weeks.reduce((ws, w) => ws + w.doneChecks, 0), 0)
  const percent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  const owners = [...new Set(data.tracks.map(t => t.owner))].join(' · ')
  const currentWeek = track?.weeks.find(w => w.week === selectedWeek)
  const activePrd = data.prdPerTrack ? data.prdPerTrack[selectedTrackIdx] : data.prd
  const prdWeek = activePrd?.find(p => p.week === selectedWeek)

  const columnLabels = columns.map(c => c.label).join('/')

  return (
    <div className="min-h-screen bg-stone-50">
      <Header
        overallPercent={percent}
        subtitle={`${data.repo} · ${owners}`}
        backLink="#/"
      />

      <div className="flex bg-stone-800 px-6">
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-4 py-2.5 text-xs ${activeTab === 'detail' ? 'text-amber border-b-2 border-amber font-semibold' : 'text-stone-400'}`}
        >
          상세 ({columnLabels})
        </button>
        <button
          onClick={() => setActiveTab('changelog')}
          className={`px-4 py-2.5 text-xs ${activeTab === 'changelog' ? 'text-amber border-b-2 border-amber font-semibold' : 'text-stone-400'}`}
        >
          변경 이력
        </button>
      </div>

      {activeTab === 'detail' && (
        <>
          {hasMultipleTracks && (
            <div className="flex bg-stone-700 px-6">
              {data.tracks.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => { setSelectedTrackIdx(i); setSelectedStep(null) }}
                  className={`px-4 py-2 text-xs transition-colors ${
                    i === selectedTrackIdx
                      ? 'text-amber-light bg-stone-600 font-semibold'
                      : 'text-stone-400 hover:text-stone-300'
                  }`}
                >
                  {t.name} ({t.owner})
                </button>
              ))}
            </div>
          )}
          <WeekTabs selected={selectedWeek} onChange={w => { setSelectedWeek(w); setSelectedStep(null) }} />
          <div className={`grid grid-cols-1 lg:grid-cols-${columns.length} min-h-[400px]`}>
            {columns.map(col => (
              <ColumnRenderer
                key={col.id}
                column={col}
                steps={currentWeek?.steps || []}
                prdWeek={prdWeek}
                selectedStep={selectedStep}
                onSelectStep={setSelectedStep}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'changelog' && (
        <ChangelogTab changelog={data.changelog} />
      )}
    </div>
  )
}
