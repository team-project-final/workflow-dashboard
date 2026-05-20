import { useConfig } from '../hooks/useConfig'

interface Props {
  selected: string
  onChange: (week: string) => void
}

export default function WeekTabs({ selected, onChange }: Props) {
  const { config } = useConfig()
  const weeks = config?.periods?.map(p => p.id) || ['W1', 'W2', 'W3', 'W4', 'W5']

  return (
    <div className="flex bg-stone-800 px-6">
      {weeks.map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-4 py-2.5 text-xs font-medium transition-colors ${
            w === selected
              ? 'text-amber border-b-2 border-amber'
              : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  )
}
