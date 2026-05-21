import { useCallback, useState } from 'react'
import { useGithubApi } from './useGithubApi'

const REPO_OWNER = 'team-project-final'
const REPO_NAME = 'workflow-dashboard'
const WORKFLOW_FILE = 'sync-data.yml'

export const ACTIONS_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}`

export interface DispatchInputs {
  repos: string  // comma-separated, '' = all
  force: boolean
}

export function useWorkflowDispatch() {
  const { call } = useGithubApi()
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const dispatch = useCallback(async (inputs: DispatchInputs): Promise<boolean> => {
    setDispatching(true)
    setError(null)
    setSuccess(null)
    try {
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
        return false
      }
      const summary = inputs.repos
        ? `강제 sync 요청됨 — ${inputs.repos.split(',').length}개 레포`
        : '강제 sync 요청됨 — 전체 레포'
      setSuccess(summary)
      return true
    } finally {
      setDispatching(false)
    }
  }, [call])

  return { dispatch, dispatching, error, success }
}
