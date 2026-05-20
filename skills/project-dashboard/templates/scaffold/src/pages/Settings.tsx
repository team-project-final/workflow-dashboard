import { useState } from 'react'
import Header from '../components/Header'
import RepoManager from '../components/settings/RepoManager'
import DataEditor from '../components/settings/DataEditor'
import ImportExport from '../components/settings/ImportExport'
import { useData } from '../hooks/useData'
import { useConfig } from '../hooks/useConfig'

type SettingsTab = 'repos' | 'editor' | 'import-export'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'repos', label: '레포/트랙 관리' },
  { id: 'editor', label: '데이터 편집' },
  { id: 'import-export', label: 'Import/Export' },
]

export default function Settings() {
  const { overallPercent } = useData()
  const { config, loading, isOverridden, updateConfig, resetConfig } = useConfig()
  const [activeTab, setActiveTab] = useState<SettingsTab>('repos')

  if (loading || !config) return <div className="p-8 text-stone-400">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50">
      <Header overallPercent={overallPercent} subtitle="Settings" backLink="#/" />
      <div className="flex border-b-2 border-stone-200 bg-white">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-[2px] transition-colors ${
              activeTab === tab.id
                ? 'text-info border-info'
                : 'text-stone-400 border-transparent hover:text-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {activeTab === 'repos' && <RepoManager config={config} onUpdate={updateConfig} />}
        {activeTab === 'editor' && <DataEditor config={config} />}
        {activeTab === 'import-export' && (
          <ImportExport config={config} isOverridden={isOverridden} onImport={updateConfig} onReset={resetConfig} />
        )}
      </div>
    </div>
  )
}
