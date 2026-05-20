import { useState } from 'react'
import type { Step, Phase } from '../types'

interface Props {
  label: string
  steps: Step[]
  selectedStep: Step | null
  onSelectStep: (step: Step | null) => void
}

const STATUS_STYLE: Record<string, { bg: string; badge: string; text: string }> = {
  Done: { bg: 'bg-green-50', badge: 'bg-success', text: 'text-success' },
  'In Progress': { bg: 'bg-amber-50', badge: 'bg-amber', text: 'text-amber' },
  'Not Started': { bg: 'bg-white', badge: 'bg-stone-200', text: 'text-stone-400' },
}

export default function ChecklistColumn({ label, steps, selectedStep, onSelectStep }: Props) {
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set())

  const togglePhase = (name: string) => {
    const next = new Set(openPhases)
    next.has(name) ? next.delete(name) : next.add(name)
    setOpenPhases(next)
  }

  // Drill-down view when a step is selected
  if (selectedStep) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-stone-600">{label} — {selectedStep.name}</h3>
          <button onClick={() => onSelectStep(null)} className="text-xs text-stone-400 hover:text-stone-600">← 목록</button>
        </div>
        {selectedStep.phases.map((phase: Phase) => {
          const statusIcon = phase.done === phase.total ? '✅' : phase.done > 0 ? '🔄' : '⬜'
          const isOpen = openPhases.has(phase.name)

          return (
            <div key={phase.name} className="mb-2">
              <button
                onClick={() => togglePhase(phase.name)}
                className="w-full text-left flex items-center justify-between p-2 rounded hover:bg-stone-50"
              >
                <span className="text-xs">{statusIcon} {phase.name}</span>
                <span className="text-[10px] text-stone-400">{phase.done}/{phase.total}</span>
              </button>
              {isOpen && (
                <div className="pl-4 space-y-0.5">
                  {phase.items.map((item, i) => (
                    <div key={i} className={`text-xs py-0.5 ${item.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                      {item.done ? '☑' : '☐'} {item.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Step list view
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-stone-600 mb-2">{label}</h3>
      {steps.length === 0 && <p className="text-xs text-stone-400">데이터 없음</p>}
      {steps.map(step => {
        const style = STATUS_STYLE[step.status] || STATUS_STYLE['Not Started']
        const pct = step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0

        return (
          <button
            key={step.name}
            onClick={() => onSelectStep(step)}
            className={`w-full text-left p-2 rounded mb-1 border-l-2 ${style.bg} hover:shadow-sm transition-shadow`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{step.name}</span>
              <span className={`text-[10px] font-mono ${style.text}`}>{pct}%</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
