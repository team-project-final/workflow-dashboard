import { useCallback, useState } from 'react'
import { useGithubApi } from './useGithubApi'

const REPO_OWNER = 'team-project-final'
const REPO_NAME = 'workflow-dashboard'
const WORKFLOW_FILE = 'sync-data.yml'

export interface DispatchInputs {
  repos: string  // comma-separated, '' = all
  force: boolean
}

export function useWorkflowDispatch() {
  const { call } = useGithubApi()
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useCallback(async (inputs: DispatchInputs): Promise<number | null> => {
    setDispatching(true)
    setError(null)
    try {
      // POST 직전 가장 큰 run id 기록 (clock skew 비의존 식별)
      const before = await call<{ workflow_runs: Array<{ id: number }> }>(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=1`
      )
      const prevMaxId = before.ok && before.data?.workflow_runs?.[0]?.id ? before.data.workflow_runs[0].id : 0

      const post = await call(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: 'main',
            inputs: { repos: inputs.repos, force: String(inputs.force) },
          }),
          expect: 'none',
        }
      )
      if (!post.ok) {
        setError(post.errorMessage || `dispatch failed: HTTP ${post.status}`)
        return null
      }

      // 1초 간격 폴링, 최대 20초까지 새 run id 식별
      const POLL_INTERVAL_MS = 1000
      const MAX_ATTEMPTS = 20
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        const list = await call<{ workflow_runs: Array<{ id: number }> }>(
          `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`
        )
        if (!list.ok || !list.data) continue
        const candidate = list.data.workflow_runs.find(r => r.id > prevMaxId)
        if (candidate) return candidate.id
      }
      setError('run id 식별 실패 (20초 polling 후에도 새 run 없음)')
      return null
    } finally {
      setDispatching(false)
    }
  }, [call])

  return { dispatch, dispatching, error }
}
