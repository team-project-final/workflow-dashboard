import { useState } from 'react'
import PatRegister from './PatRegister'
import RepoForceList from './RepoForceList'
import TriggerBar from './TriggerBar'
import RunStatusPanel from './RunStatusPanel'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'
import { useWorkflowDispatch } from '../../hooks/useWorkflowDispatch'
import { useData } from '../../hooks/useData'
import type { DashboardConfig } from '../../types/config'

interface Props {
  config: DashboardConfig
}

export default function ForceSyncTab({ config }: Props) {
  const { token } = useForceSyncPat()
  const { rawByRepo } = useData()
  const { dispatch, dispatching, error, success } = useWorkflowDispatch()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const onToggle = (repoId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(repoId)) next.delete(repoId)
      else next.add(repoId)
      return next
    })
  }

  const onTrigger = async () => {
    const repos = [...selected].join(',')
    await dispatch({ repos, force: true })
  }

  const onClearCache = () => {
    if (!confirm('로컬 캐시(dashboard-data-*)를 비우고 정적 JSON을 다시 불러옵니다. 계속할까요?')) return
    Object.keys(localStorage)
      .filter(k => k.startsWith('dashboard-data-'))
      .forEach(k => localStorage.removeItem(k))
    location.reload()
  }

  return (
    <div>
      <PatRegister />
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-stone-500">
          캐시는 정적 JSON(data/*.json)보다 우선합니다. 표시가 서버 상태와 다르면 캐시를 비워 보세요.
        </div>
        <button
          type="button"
          onClick={onClearCache}
          className="px-3 py-1 text-xs text-stone-600 border border-stone-300 rounded hover:bg-stone-100"
        >
          로컬 캐시 비우기 + 새로고침
        </button>
      </div>
      <RepoForceList
        config={config}
        cacheByRepo={rawByRepo}
        selected={selected}
        onToggle={onToggle}
      />
      <TriggerBar
        selectedCount={selected.size}
        hasToken={!!token}
        dispatching={dispatching}
        onTrigger={onTrigger}
      />
      <RunStatusPanel success={success} error={error} />
    </div>
  )
}
