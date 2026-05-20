import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import type { RepoData } from '../types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const AUTO_COLORS = ['#D97706', '#0D9488', '#6366F1', '#EC4899', '#0EA5E9', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16', '#E879F9', '#14B8A6', '#F43F5E']

function getTrackColor(trackName: string, index: number): string {
  if (index < AUTO_COLORS.length) return AUTO_COLORS[index]
  let hash = 0
  for (let i = 0; i < trackName.length; i++) {
    hash = ((hash << 5) - hash) + trackName.charCodeAt(i)
    hash |= 0
  }
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length]
}

interface Props {
  data: RepoData[]
}

function buildDateRange(dates: string[]): string[] {
  if (dates.length === 0) return []
  const sorted = [...dates].sort()
  const start = new Date(sorted[0])
  const end = new Date(sorted[sorted.length - 1])
  const range: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    range.push(d.toISOString().slice(0, 10))
  }
  return range
}

function carryForward(history: { date: string; totalChecks: number; doneChecks: number }[], dates: string[]): (number | null)[] {
  const map = new Map(history.map(h => [h.date, h]))
  let lastPercent: number | null = null
  let hasStarted = false

  return dates.map(date => {
    const entry = map.get(date)
    if (entry) {
      hasStarted = true
      lastPercent = entry.totalChecks > 0 ? Math.round(entry.doneChecks / entry.totalChecks * 100) : 0
      return lastPercent
    }
    if (!hasStarted) return 0
    return lastPercent ?? 0
  })
}

export default function TimelineChart({ data }: Props) {
  const rawDates = [...new Set(data.flatMap(d => d.history.map(h => h.date)))]
  const allDates = buildDateRange(rawDates)

  let colorIdx = 0
  const datasets = data.flatMap(d =>
    d.tracks.map(t => ({
      label: t.name,
      data: carryForward(d.history, allDates),
      borderColor: getTrackColor(t.name, colorIdx++),
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    }))
  )

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-600 mb-2">진행률 추이</h3>
      <div className="h-[250px]">
      <Line
        data={{ labels: allDates, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } },
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
          },
        }}
        height={250}
      />
      </div>
    </div>
  )
}
