import type { Step } from '../types'

interface Props {
  step: Step | null
}

export default function WorkflowColumn({ step }: Props) {
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
      <div className="space-y-1">
        {step.phases.map((phase, i) => {
          const done = phase.done === phase.total && phase.total > 0
          const inProgress = phase.done > 0 && phase.done < phase.total
          return (
            <div key={i} className={`flex items-center gap-2 text-[11px] ${
              done ? 'text-success' : inProgress ? 'text-amber font-semibold' : 'text-stone-400'
            }`}>
              <span className="text-sm">{done ? '✅' : inProgress ? '🔄' : '⬜'}</span>
              <span>{i + 1}. {phase.name}</span>
              <span className="ml-auto text-[9px] font-mono text-stone-400">
                {phase.done}/{phase.total}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
