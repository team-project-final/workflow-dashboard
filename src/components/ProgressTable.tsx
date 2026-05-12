import type { RepoData } from '../types'

interface Props {
  data: RepoData[]
}

const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5']

function percentColor(p: number) {
  if (p >= 60) return 'text-success font-semibold'
  if (p >= 30) return 'text-amber font-semibold'
  if (p > 0) return 'text-danger font-semibold'
  return 'text-stone-400'
}

export default function ProgressTable({ data }: Props) {
  const rows = data.flatMap(d =>
    d.tracks.map(t => ({
      name: `${t.owner} ${t.name}`,
      weeks: WEEKS.map(w => {
        const week = t.weeks.find(wk => wk.week === w)
        if (!week || week.totalChecks === 0) return null
        return Math.round(week.doneChecks / week.totalChecks * 100)
      }),
      total: (() => {
        const tc = t.weeks.reduce((s, w) => s + w.totalChecks, 0)
        const dc = t.weeks.reduce((s, w) => s + w.doneChecks, 0)
        return tc > 0 ? Math.round(dc / tc * 100) : 0
      })(),
    }))
  )

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-600 mb-2">주차별 상세</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-amber-light">
            <th className="p-1.5 text-left border-b-2 border-amber text-[10px]">트랙</th>
            {WEEKS.map(w => <th key={w} className="p-1.5 text-center border-b-2 border-amber text-[10px]">{w}</th>)}
            <th className="p-1.5 text-center border-b-2 border-amber text-[10px] font-bold">합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="p-1.5">{r.name}</td>
              {r.weeks.map((w, j) => (
                <td key={j} className={`text-center ${w !== null ? percentColor(w) : 'text-stone-300'}`}>
                  {w !== null ? `${w}%` : '—'}
                </td>
              ))}
              <td className="text-center font-bold">{r.total}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-stone-400">
        🟢 60%+ &nbsp; 🟠 30~59% &nbsp; 🔴 &lt;30% &nbsp; — 미시작
      </div>
    </div>
  )
}
