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

  return (
    <div>
      <PatRegister />
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
