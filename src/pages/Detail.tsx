import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRepoData } from '../hooks/useData'
import Header from '../components/Header'
import WeekTabs from '../components/WeekTabs'
import PrdColumn from '../components/PrdColumn'
import TaskColumn from '../components/TaskColumn'
import WorkflowColumn from '../components/WorkflowColumn'
import ChangelogTab from '../components/ChangelogTab'
import type { Step } from '../types'

export default function Detail() {
  const { repo } = useParams<{ repo: string }>()
  const { data, loading } = useRepoData(repo || '')
  const [selectedWeek, setSelectedWeek] = useState('W1')
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [activeTab, setActiveTab] = useState<'detail' | 'changelog'>('detail')

  if (loading || !data) return <div className="p-8 text-stone-400">Loading...</div>

  const track = data.tracks[0]
  const totalChecks = track?.weeks.reduce((s, w) => s + w.totalChecks, 0) || 0
  const doneChecks = track?.weeks.reduce((s, w) => s + w.doneChecks, 0) || 0
  const percent = totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0

  const currentWeek = track?.weeks.find(w => w.week === selectedWeek)
  const prdWeek = data.prd.find(p => p.week === selectedWeek)

  return (
    <div className="min-h-screen bg-stone-50">
      <Header
        overallPercent={percent}
        subtitle={`${data.repo} · ${track?.owner || ''}`}
        backLink="#/"
      />

      <div className="flex bg-stone-800 px-6">
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-4 py-2.5 text-xs ${activeTab === 'detail' ? 'text-amber border-b-2 border-amber font-semibold' : 'text-stone-400'}`}
        >
          상세 (PRD/TASK/WORKFLOW)
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
          <WeekTabs selected={selectedWeek} onChange={w => { setSelectedWeek(w); setSelectedStep(null) }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[400px]">
            <PrdColumn prdWeek={prdWeek} />
            <TaskColumn
              steps={currentWeek?.steps || []}
              onSelectStep={setSelectedStep}
              selectedStep={selectedStep}
            />
            <WorkflowColumn step={selectedStep} />
          </div>
        </>
      )}

      {activeTab === 'changelog' && (
        <ChangelogTab changelog={data.changelog} />
      )}
    </div>
  )
}
