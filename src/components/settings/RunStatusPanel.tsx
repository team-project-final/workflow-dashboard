import { ACTIONS_URL } from '../../hooks/useWorkflowDispatch'

interface Props {
  success: string | null
  error: string | null
}

export default function RunStatusPanel({ success, error }: Props) {
  if (error) {
    return (
      <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded">
        트리거 실패: {error}
        {' '}
        <a href={ACTIONS_URL} target="_blank" rel="noreferrer" className="underline">
          Actions에서 확인 ↗
        </a>
      </div>
    )
  }
  if (success) {
    return (
      <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded">
        ✅ {success}.{' '}
        <a href={ACTIONS_URL} target="_blank" rel="noreferrer" className="underline">
          Actions에서 진행 상황 보기 ↗
        </a>
        {' '}— 동기화가 끝나면 GitHub Pages 재배포 후 캐시·실시간 비교가 자동으로 갱신됩니다.
      </div>
    )
  }
  return null
}
