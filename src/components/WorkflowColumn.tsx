import { useState } from 'react'
import type { Step } from '../types'

interface Props {
  step: Step | null
}

export default function WorkflowColumn({ step }: Props) {
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setOpenPhases(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (!step) {
    return (
      <div className="p-3.5">
        <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
          WORKFLOW — 10단계
        </h3>
        <p className="text-xs text-stone-400">좌측에서 Step을 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="p-3.5">
      <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
        WORKFLOW — {step.name}
      </h3>
      <div className="text-[10px] text-stone-600 mb-2 px-2 py-1.5 bg-amber-light rounded">
        {step.doneChecks}/{step.totalChecks} 완료 ({step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0}%)
      </div>
      <div className="space-y-0.5">
        {step.phases.map((phase, i) => {
          const done = phase.done === phase.total && phase.total > 0
          const inProgress = (phase.done > 0 || (phase.partial ?? 0) > 0) && phase.done < phase.total
          const hasItems = phase.items && phase.items.length > 0
          const isOpen = openPhases.has(i)

          return (
            <div key={i}>
              <div
                onClick={() => hasItems && toggle(i)}
                className={`flex items-center gap-2 text-[11px] py-0.5 ${
                  hasItems ? 'cursor-pointer hover:bg-stone-100 rounded px-1 -mx-1' : ''
                } ${
                  done ? 'text-success' : inProgress ? 'text-amber font-semibold' : 'text-stone-400'
                }`}
              >
                {hasItems && (
                  <span className="text-[9px] text-stone-400 w-3 text-center select-none">
                    {isOpen ? '▼' : '▶'}
                  </span>
                )}
                {!hasItems && <span className="w-3" />}
                <span className="text-sm">{done ? '✅' : inProgress ? '🔄' : '⬜'}</span>
                <span>{i + 1}. {phase.name}</span>
                <span className="ml-auto text-[9px] font-mono text-stone-400">
                  {phase.done}/{phase.total}
                </span>
              </div>
              {isOpen && hasItems && (
                <div className="ml-8 mt-0.5 mb-1 space-y-0.5">
                  {phase.items.map((item, j) => (
                    <div key={j} className={`flex items-start gap-1.5 text-[10px] ${
                      item.done ? 'text-success' : item.partial ? 'text-amber-600' : 'text-stone-500'
                    }`}>
                      <span className="mt-0.5 shrink-0">{item.done ? '✅' : item.partial ? '◐' : '⬜'}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
