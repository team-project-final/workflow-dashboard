import type { PrdWeek } from '../types'

interface Props {
  label: string
  prdWeek?: PrdWeek
}

const STATUS_STYLE = {
  done: { border: 'border-l-success', icon: '✅' },
  in_progress: { border: 'border-l-amber', icon: '🔄' },
  not_started: { border: 'border-l-stone-300', icon: '⬜' },
}

export default function ListColumn({ label, prdWeek }: Props) {
  const items = prdWeek?.items || []

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-stone-600 mb-2">{label}</h3>
      {items.length === 0 && <p className="text-xs text-stone-400">항목 없음</p>}
      {items.map(item => {
        const style = STATUS_STYLE[item.status] || STATUS_STYLE.not_started
        return (
          <div key={item.id} className={`p-2 mb-1 border-l-2 ${style.border} bg-white rounded text-xs`}>
            <span className="mr-1">{style.icon}</span>
            <span className="font-mono text-stone-500 mr-1">{item.id}</span>
            {item.title}
          </div>
        )
      })}
    </div>
  )
}
