import { useState } from 'react'
import type { ChangelogEntry } from '../types'
import { CHANGE_TYPE_META } from '../constants/changeTypes.js'

type FilterType = 'all' | 'structure' | 'modified' | 'checks'

interface Props {
  changelog: ChangelogEntry[]
}

export default function ChangelogTab({ changelog }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = changelog
    .flatMap(entry =>
      entry.changes
        .filter(c => filter === 'all' || CHANGE_TYPE_META[c.type]?.category === filter)
        .map(c => ({ ...c, date: entry.date, commit: entry.commit, author: entry.author, file: entry.file }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const grouped = new Map<string, typeof filtered>()
  for (const item of filtered) {
    const day = item.date.slice(0, 10)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day)!.push(item)
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'structure', label: 'Step 추가/삭제' },
    { key: 'modified', label: '내용 수정' },
    { key: 'checks', label: '체크 완료' },
  ]

  return (
    <div>
      <div className="px-6 py-3 flex gap-2 items-center border-b border-stone-200 bg-white">
        <span className="text-[11px] text-stone-500">필터:</span>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
              filter === f.key ? 'bg-amber text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-stone-400">총 {filtered.length}건</span>
      </div>

      <div className="px-6 py-4">
        {[...grouped].map(([day, items]) => (
          <div key={day} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-amber rounded-full" />
              <span className="text-xs font-bold text-stone-600">{day}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
            {items.map((item, i) => {
              const cfg = CHANGE_TYPE_META[item.type] || CHANGE_TYPE_META.check_done
              return (
                <div key={i} className={`ml-5 mb-2 p-2.5 bg-white rounded-lg border-l-[3px] ${cfg.border} shadow-sm`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-semibold text-stone-700">{item.file}</span>
                      </div>
                      <div className="text-xs text-stone-600 mt-1">{item.target}</div>
                      {item.detail && <div className="text-[10px] text-stone-500 mt-0.5">{item.detail}</div>}
                      {item.type === 'step_modified' && item.before && item.after && (
                        <div className="mt-1.5 font-mono text-[10px] rounded overflow-hidden border border-stone-200">
                          <div className="px-2 py-1 bg-red-50 text-red-900">
                            <span className="text-danger font-bold">−</span> {item.before}
                          </div>
                          <div className="px-2 py-1 bg-green-50 text-green-900">
                            <span className="text-success font-bold">+</span> {item.after}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3 whitespace-nowrap">
                      <div className="text-[9px] text-stone-400">{item.date.slice(11, 16)}</div>
                      <code className="text-[9px] bg-stone-100 px-1 py-0.5 rounded text-stone-500">
                        {item.commit}
                      </code>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">변경 이력이 없습니다</p>
        )}
      </div>

      <div className="px-6 pb-4">
        <div className="flex gap-4 flex-wrap text-[11px] text-stone-700">
          <span><span className="inline-block w-2.5 h-2.5 bg-info rounded-sm align-middle mr-1" />추가</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-danger rounded-sm align-middle mr-1" />삭제</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-amber rounded-sm align-middle mr-1" />수정</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-success rounded-sm align-middle mr-1" />완료</span>
        </div>
      </div>
    </div>
  )
}
