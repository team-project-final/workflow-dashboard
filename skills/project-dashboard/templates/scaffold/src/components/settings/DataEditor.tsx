import { useState, useEffect, useCallback } from 'react'
import type { DashboardConfig } from '../../types/config'
import { getRepoId } from '../../types/config'
import type { RepoData, Step } from '../../types'
import { WEEKS_META } from '../../hooks/useData'

const WEEKS = WEEKS_META.map((w: { week: string; period: string }) => w.week)
const LS_DATA_PREFIX = 'dashboard-data-'

interface Props {
  config: DashboardConfig
}

function loadRepoData(repo: string): Promise<RepoData | null> {
  const local = localStorage.getItem(LS_DATA_PREFIX + repo)
  if (local) return Promise.resolve(JSON.parse(local))
  return fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
}

function saveRepoData(repo: string, data: RepoData): void {
  localStorage.setItem(LS_DATA_PREFIX + repo, JSON.stringify(data))
}

function recomputeTotals(data: RepoData): RepoData {
  return {
    ...data,
    tracks: data.tracks.map(track => ({
      ...track,
      weeks: track.weeks.map(week => {
        const steps = week.steps.map(step => {
          const phases = step.phases.map(phase => ({
            ...phase,
            total: phase.items.length,
            done: phase.items.filter(it => it.done).length,
          }))
          const totalChecks = phases.reduce((s, p) => s + p.total, 0)
          const doneChecks = phases.reduce((s, p) => s + p.done, 0)
          const status: Step['status'] = totalChecks === 0 ? 'Not Started'
            : doneChecks === totalChecks ? 'Done'
            : doneChecks > 0 ? 'In Progress' : 'Not Started'
          return { ...step, phases, totalChecks, doneChecks, status }
        })
        return {
          ...week,
          steps,
          totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
          doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
        }
      }),
    })),
  }
}

export default function DataEditor({ config }: Props) {
  const allRepos = config.repos.map(r => getRepoId(r))
  const [selectedRepo, setSelectedRepo] = useState(allRepos[0] || '')
  const [selectedWeek, setSelectedWeek] = useState('W1')
  const [repoData, setRepoData] = useState<RepoData | null>(null)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [isModified, setIsModified] = useState(false)

  useEffect(() => {
    if (!selectedRepo) return
    const modified = !!localStorage.getItem(LS_DATA_PREFIX + selectedRepo)
    loadRepoData(selectedRepo).then(data => {
      setRepoData(data)
      setIsModified(modified)
    })
  }, [selectedRepo])

  const persist = useCallback((updated: RepoData) => {
    const recomputed = recomputeTotals(updated)
    setRepoData(recomputed)
    saveRepoData(selectedRepo, recomputed)
    setIsModified(true)
  }, [selectedRepo])

  if (!repoData) return <div className="text-stone-400">Loading...</div>

  const track = repoData.tracks[0]
  if (!track) return <div className="text-stone-400">트랙 없음</div>
  const week = track.weeks.find(w => w.week === selectedWeek)
  if (!week) return <div className="text-stone-400">주차 데이터 없음</div>

  const toggleCheck = (stepIdx: number, phaseIdx: number, itemIdx: number) => {
    const updated = structuredClone(repoData)
    const item = updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items[itemIdx]
    item.done = !item.done
    persist(updated)
  }

  const addItem = (stepIdx: number, phaseIdx: number, text: string) => {
    if (!text.trim()) return
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items.push({ text: text.trim(), done: false })
    persist(updated)
  }

  const removeItem = (stepIdx: number, phaseIdx: number, itemIdx: number) => {
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps[stepIdx].phases[phaseIdx].items.splice(itemIdx, 1)
    persist(updated)
  }

  const addStep = () => {
    const name = prompt('Step 이름:')
    if (!name?.trim()) return
    const updated = structuredClone(repoData)
    const w = updated.tracks[0].weeks.find(w => w.week === selectedWeek)!
    w.steps.push({
      name: name.trim(),
      status: 'Not Started',
      phases: [{ name: '기본', total: 0, done: 0, items: [] }],
      totalChecks: 0,
      doneChecks: 0,
    })
    persist(updated)
  }

  const deleteStep = (stepIdx: number) => {
    if (!confirm(`"${week.steps[stepIdx].name}" Step을 삭제하시겠습니까?`)) return
    const updated = structuredClone(repoData)
    updated.tracks[0].weeks.find(w => w.week === selectedWeek)!.steps.splice(stepIdx, 1)
    persist(updated)
    setExpandedStep(null)
  }

  return (
    <div>
      <div className="flex gap-3 items-end mb-5">
        <div className="flex-1">
          <label className="text-xs font-semibold text-stone-700 block mb-1">레포 선택</label>
          <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm">
            {allRepos.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-700 block mb-1">주차</label>
          <div className="flex gap-1">
            {WEEKS.map(w => (
              <button key={w} onClick={() => setSelectedWeek(w)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  w === selectedWeek ? 'bg-info text-white' : 'bg-stone-100 text-stone-500 border border-stone-200'
                }`}>{w}</button>
            ))}
          </div>
        </div>
      </div>

      {isModified && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
          💡 이 레포에 수정된 내용이 localStorage에 저장되어 있습니다. Import/Export 탭에서 내보내기 하세요.
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold">{selectedWeek} Steps</h4>
        <button onClick={addStep} className="text-xs px-3 py-1.5 bg-info text-white rounded-md">+ Step 추가</button>
      </div>

      <div className="flex flex-col gap-2">
        {week.steps.map((step, si) => (
          <div key={si} className="border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 flex justify-between items-center cursor-pointer"
              onClick={() => setExpandedStep(expandedStep === si ? null : si)}>
              <div className="flex items-center gap-2">
                <span className="text-stone-400 text-xs">{expandedStep === si ? '▼' : '▶'}</span>
                <span className="font-semibold text-sm">{step.name}</span>
                <span className={`text-[11px] text-white px-2 py-0.5 rounded-full ${
                  step.doneChecks === step.totalChecks && step.totalChecks > 0 ? 'bg-success' : step.doneChecks > 0 ? 'bg-warning' : 'bg-stone-400'
                }`}>{step.doneChecks}/{step.totalChecks}</span>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => deleteStep(si)} className="text-xs px-2 py-1 border border-red-200 text-danger rounded">삭제</button>
              </div>
            </div>

            {expandedStep === si && (
              <div className="px-4 py-3 border-t border-stone-100">
                {step.phases.map((phase, pi) => (
                  <div key={pi} className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-stone-700 font-medium">📂 {phase.name} <span className="text-stone-400">({phase.done}/{phase.total})</span></span>
                      <button onClick={() => {
                        const text = prompt('항목 텍스트:')
                        if (text) addItem(si, pi, text)
                      }} className="text-[11px] text-info">+ 항목 추가</button>
                    </div>
                    <div className="flex flex-col gap-1 pl-2">
                      {phase.items.map((item, ii) => (
                        <div key={ii} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={item.done}
                            onChange={() => toggleCheck(si, pi, ii)}
                            className="accent-info" />
                          <span className={item.done ? 'text-stone-400 line-through' : 'text-stone-700'}>{item.text}</span>
                          <button onClick={() => removeItem(si, pi, ii)} className="text-stone-300 hover:text-danger text-xs ml-auto">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
