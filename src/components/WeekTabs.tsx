const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5']

interface Props {
  selected: string
  onChange: (week: string) => void
}

export default function WeekTabs({ selected, onChange }: Props) {
  return (
    <div className="flex bg-stone-800 px-6">
      {WEEKS.map(w => (
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
