import { useConfig } from '../hooks/useConfig'

interface HeaderProps {
  overallPercent: number
  subtitle?: string
  backLink?: string
}

export default function Header({ overallPercent, subtitle, backLink }: HeaderProps) {
  const { config } = useConfig()
  const projectName = config?.project?.name || 'Dashboard'

  return (
    <header className="bg-gradient-to-r from-stone-900 to-stone-800 px-6 py-5 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {backLink && (
          <>
            <a href={backLink} className="text-stone-400 hover:text-amber text-sm">← 대시보드</a>
            <div className="w-px h-5 bg-stone-700" />
          </>
        )}
        <div>
          <h1 className="text-xl font-bold text-amber font-display m-0">{projectName}</h1>
          <p className="text-xs text-stone-300">{subtitle || 'Workflow Dashboard'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <a href="#/settings" className="text-stone-400 hover:text-amber-light text-sm transition-colors">⚙ Settings</a>
        <div className="text-right">
          <div className="text-4xl font-bold text-amber-light font-display">{overallPercent}%</div>
          <p className="text-xs text-stone-400">전체 진행률</p>
        </div>
      </div>
    </header>
  )
}
