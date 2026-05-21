import { useEffect, useState } from 'react'
import PatRegister from './PatRegister'
import RepoForceList from './RepoForceList'
import TriggerBar from './TriggerBar'
import RunStatusPanel from './RunStatusPanel'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'
import { useWorkflowDispatch } from '../../hooks/useWorkflowDispatch'
import { useData } from '../../hooks/useData'
import type { DashboardConfig } from '../../types/config'

const LS_RUN_ID = 'forceSync.runId'

interface Props {
  config: DashboardConfig
}

export default function ForceSyncTab({ config }: Props) {
  const { token } = useForceSyncPat()
  const { rawByRepo } = useData()
  const { dispatch, dispatching, error: dispatchError } = useWorkflowDispatch()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [runId, setRunId] = useState<number | null>(() => {
    const stored = localStorage.getItem(LS_RUN_ID)
    return stored ? Number(stored) : null
  })

  useEffect(() => {
    if (runId == null) localStorage.removeItem(LS_RUN_ID)
    else localStorage.setItem(LS_RUN_ID, String(runId))
  }, [runId])

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
    const newRunId = await dispatch({ repos, force: true })
    if (newRunId != null) setRunId(newRunId)
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
      <RunStatusPanel runId={runId} dispatchError={dispatchError} />
    </div>
  )
}
