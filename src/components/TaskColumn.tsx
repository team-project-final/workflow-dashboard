import type { Step } from '../types'

const STATUS_CONFIG = {
  Done: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-success text-white', barBg: 'bg-green-100', barFill: 'bg-success' },
  'In Progress': { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber text-white', barBg: 'bg-amber-100', barFill: 'bg-amber' },
  'Not Started': { bg: 'bg-white', border: 'border-stone-200', badge: 'bg-stone-200 text-stone-500', barBg: 'bg-stone-100', barFill: '' },
}

interface Props {
  steps: Step[]
  onSelectStep: (step: Step) => void
  selectedStep: Step | null
}

export default function TaskColumn({ steps, onSelectStep, selectedStep }: Props) {
  return (
    <div className="border-r border-stone-200 p-3.5">
      <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
        TASK — Step 상세
      </h3>
      {steps.map((step, i) => {
        const cfg = STATUS_CONFIG[step.status]
        const percent = step.totalChecks > 0 ? Math.round(step.doneChecks / step.totalChecks * 100) : 0
        const isSelected = selectedStep?.name === step.name
        return (
          <div
            key={i}
            onClick={() => onSelectStep(step)}
            className={`mb-2 p-2.5 rounded-md border cursor-pointer transition-shadow
              ${cfg.bg} ${cfg.border} ${isSelected ? 'ring-2 ring-amber' : 'hover:shadow-sm'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-stone-700">Step {i + 1}: {step.name}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{step.status}</span>
            </div>
            <div className={`mt-1.5 h-1 rounded-full ${cfg.barBg}`}>
              <div className={`h-full rounded-full ${cfg.barFill}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="text-[9px] text-stone-400 mt-1">
              {step.doneChecks}/{step.totalChecks} 체크
            </div>
          </div>
        )
      })}
    </div>
  )
}
