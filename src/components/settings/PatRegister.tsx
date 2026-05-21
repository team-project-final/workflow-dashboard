import { useState } from 'react'
import { useForceSyncPat } from '../../hooks/useForceSyncPat'

function mask(token: string): string {
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`
}

export default function PatRegister() {
  const { token, owner, validating, error, save, clear } = useForceSyncPat()
  const [draft, setDraft] = useState('')

  if (token) {
    return (
      <div className="rounded border border-stone-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-stone-400">등록된 PAT</div>
            <div className="font-mono text-sm text-stone-700">{mask(token)}</div>
            {owner && <div className="text-xs text-stone-400 mt-1">@{owner}</div>}
          </div>
          <button
            type="button"
            onClick={clear}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
          >
            토큰 제거
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded border border-stone-200 bg-white p-4 mb-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-stone-700">GitHub PAT 등록</div>
        <div className="text-xs text-stone-500 mt-1">
          Fine-grained PAT 권한: <code>Actions: Read and write</code>, <code>Contents: Read-only</code>, <code>Metadata: Read-only</code>.
          Repository access: <code>workflow-dashboard</code> + 동기화 대상 7개 레포.
        </div>
      </div>
      <input
        type="password"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="github_pat_..."
        className="w-full px-3 py-2 border border-stone-300 rounded font-mono text-sm"
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button
        type="button"
        disabled={validating || draft.trim().length < 10}
        onClick={async () => {
          const ok = await save(draft.trim())
          if (ok) setDraft('')
        }}
        className="px-4 py-2 text-sm bg-info text-white rounded disabled:opacity-50"
      >
        {validating ? '검증 중...' : '등록'}
      </button>
    </div>
  )
}
