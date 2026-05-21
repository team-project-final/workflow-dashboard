interface Props {
  selectedCount: number
  hasToken: boolean
  dispatching: boolean
  onTrigger: () => void
}

export default function TriggerBar({ selectedCount, hasToken, dispatching, onTrigger }: Props) {
  const disabled = !hasToken || selectedCount === 0 || dispatching
  const reason = !hasToken
    ? 'PAT 등록 필요'
    : selectedCount === 0
      ? '레포 선택 필요'
      : dispatching
        ? '실행 중'
        : null
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onTrigger}
        className="px-4 py-2 bg-red-600 text-white text-sm rounded disabled:opacity-40"
      >
        {dispatching ? '트리거 중...' : `강제 sync 실행 (${selectedCount})`}
      </button>
      {reason && <span className="text-xs text-stone-500">{reason}</span>}
    </div>
  )
}
