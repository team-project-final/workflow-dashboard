import type { PrdWeek } from '../types'

const STATUS_STYLE = {
  done: { border: 'border-l-success', badge: 'text-success', icon: '✅' },
  in_progress: { border: 'border-l-amber', badge: 'text-amber', icon: '🔄' },
  not_started: { border: 'border-l-stone-300', badge: 'text-stone-400', icon: '⬜' },
}

interface Props {
  prdWeek: PrdWeek | undefined
}

export default function PrdColumn({ prdWeek }: Props) {
  return (
    <div className="border-r border-stone-200 p-3.5">
      <h3 className="text-[11px] font-bold text-amber uppercase tracking-wider mb-2.5">
        PRD — 요구사항
      </h3>
      {!prdWeek || prdWeek.items.length === 0 ? (
        <p className="text-xs text-stone-400">해당 주차 PRD 항목 없음</p>
      ) : (
        prdWeek.items.map(item => {
          const s = STATUS_STYLE[item.status]
          return (
            <div key={item.id} className={`mb-2 p-2 bg-white rounded-md border-l-[3px] ${s.border}`}>
              <div className={`text-[10px] font-semibold ${s.badge}`}>{item.id} {s.icon}</div>
              <div className="text-[11px] text-stone-700 mt-0.5">{item.title}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
