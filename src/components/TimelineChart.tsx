import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import type { RepoData } from '../types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const TRACK_COLORS: Record<string, string> = {
  platform: '#D97706',
  engagement: '#0D9488',
  'knowledge-1': '#78716C',
  'knowledge-2': '#A8A29E',
  knowledge: '#78716C',
  'learning-card': '#0EA5E9',
  'learning-ai': '#8B5CF6',
  learning: '#0EA5E9',
  frontend: '#EC4899',
  'team-lead': '#16A34A',
  'synapse-gitops': '#16A34A',
  'synapse-shared': '#22D3EE',
}

const AUTO_COLORS = ['#6366F1', '#14B8A6', '#F43F5E', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16', '#E879F9']

function getTrackColor(trackName: string): string {
  if (TRACK_COLORS[trackName]) return TRACK_COLORS[trackName]
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

  // history는 repo(가상트랙) 단위로만 적재되므로, 라인도 데이터 소스당 1개로 그린다.
  // 멀티 트랙 repo(knowledge-1/2, learning-card/ai, gitops+shared)의 트랙별 라인은
  // 모두 같은 합산 history가 되어 카드/테이블 값과 어긋났다(예: shared 83% → 라인 79%).
  const datasets = data.map(d => {
    const label = d.tracks.length === 1
      ? d.tracks[0].name
      : d.repo.replace(/^synapse-/, '').replace(/-svc$/, '')
    return {
      label,
      data: carryForward(d.history, allDates),
      borderColor: getTrackColor(label),
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    }
  })

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
