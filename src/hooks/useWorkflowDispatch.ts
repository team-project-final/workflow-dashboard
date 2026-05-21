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
      const dispatchAt = new Date()
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

      // grace + identify new run
      await new Promise(r => setTimeout(r, 5000))
      const list = await call<{ workflow_runs: Array<{ id: number; event: string; created_at: string }> }>(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`
      )
      if (!list.ok || !list.data) {
        setError('run id 식별 실패 (조회 오류)')
        return null
      }
      const candidate = list.data.workflow_runs.find(r => new Date(r.created_at) >= dispatchAt)
      if (!candidate) {
        setError('run id 식별 실패 (grace 후에도 새 run 없음)')
        return null
      }
      return candidate.id
    } finally {
      setDispatching(false)
    }
  }, [call])

  return { dispatch, dispatching, error }
}
