import { useEffect, useState } from 'react'
import { useGithubApi } from './useGithubApi'

const REPO_OWNER = 'team-project-final'
const REPO_NAME = 'workflow-dashboard'
const POLL_MS = 5000
const MAX_CONSECUTIVE_FAILS = 3

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'unknown'
export type RunConclusion = 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | null

export interface RunState {
  id: number
  status: RunStatus
  conclusion: RunConclusion
  htmlUrl: string
  updatedAt: string
}

export function useWorkflowRun(runId: number | null) {
  const { call } = useGithubApi()
  const [run, setRun] = useState<RunState | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  useEffect(() => {
    if (runId == null) return
    let cancelled = false
    let consecutiveFails = 0

    async function tick() {
      if (cancelled) return
      const res = await call<{
        id: number; status: string; conclusion: string | null;
        html_url: string; updated_at: string;
      }>(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`)

      if (cancelled) return

      if (!res.ok || !res.data) {
        consecutiveFails++
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
          setFatalError('폴링 실패 3회 — 중단')
          return
        }
        setTimeout(tick, POLL_MS)
        return
      }
      consecutiveFails = 0
      const next: RunState = {
        id: res.data.id,
        status: (res.data.status as RunStatus) || 'unknown',
        conclusion: (res.data.conclusion as RunConclusion) || null,
        htmlUrl: res.data.html_url,
        updatedAt: res.data.updated_at,
      }
      setRun(next)
      if (next.status === 'completed') return
      setTimeout(tick, POLL_MS)
    }

    void tick()
    return () => { cancelled = true }
  }, [runId, call])

  return { run, fatalError }
}
