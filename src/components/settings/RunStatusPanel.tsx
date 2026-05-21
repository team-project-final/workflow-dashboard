import { useWorkflowRun, type RunStatus, type RunConclusion } from '../../hooks/useWorkflowRun'

interface Props {
  runId: number | null
  dispatchError: string | null
}

function statusLabel(status: RunStatus, conclusion: RunConclusion): string {
  if (status === 'completed') {
    if (conclusion === 'success') return '✅ 완료 (success)'
    if (conclusion === 'failure') return '❌ 실패 (failure)'
    return `⏹️ 완료 (${conclusion || 'unknown'})`
  }
  if (status === 'queued') return '⏳ 대기 (queued)'
  if (status === 'in_progress') return '🔄 실행 중 (in_progress)'
  if (status === 'waiting') return '⏸ 승인 대기 (waiting)'
  return status
}

export default function RunStatusPanel({ runId, dispatchError }: Props) {
  const { run, fatalError } = useWorkflowRun(runId)

  if (dispatchError) {
    return <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded">트리거 실패: {dispatchError}</div>
  }
  if (runId == null) return null

  return (
    <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded text-sm">
      <div className="flex items-center justify-between">
        <div>
          Run #{runId}: {run ? statusLabel(run.status, run.conclusion) : '시작 중…'}
        </div>
        {run && (
          <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="text-info underline text-xs">
            Actions에서 보기 ↗
          </a>
        )}
      </div>
      {fatalError && <div className="text-red-600 text-xs mt-2">{fatalError}</div>}
    </div>
  )
}
