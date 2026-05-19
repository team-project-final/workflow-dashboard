import { useState } from 'react'
import type { VirtualTrackDef, VirtualTrackSource, RepoDef } from '../../types/config'

interface Props {
  initial?: VirtualTrackDef
  availableRepos: RepoDef[]
  onSave: (vt: VirtualTrackDef) => void
  onCancel: () => void
}

export default function VirtualTrackModal({ initial, availableRepos, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name || '')
  const [owner, setOwner] = useState(initial?.owner || '')
  const [sources, setSources] = useState<VirtualTrackSource[]>(
    initial?.sources || [{ repo: '', track: '' }]
  )

  const addSource = () => setSources([...sources, { repo: '', track: '' }])
  const removeSource = (i: number) => setSources(sources.filter((_, idx) => idx !== i))
  const updateSource = (i: number, field: keyof VirtualTrackSource, value: string) =>
    setSources(sources.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  const canSave = name.trim() !== '' && owner.trim() !== '' &&
    sources.length > 0 && sources.every(s => s.repo.trim() !== '' && s.track.trim() !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      owner: owner.trim(),
      sources: sources.map(s => ({ repo: s.repo.trim(), track: s.track.trim() })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">{initial ? '가상 트랙 편집' : '가상 트랙 추가'}</h3>
        <p className="text-xs text-stone-500 mb-5">여러 레포의 데이터를 하나의 트랙으로 합산합니다</p>

        <label className="block text-sm font-semibold text-stone-700 mb-1">가상 트랙 이름</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-4" />

        <label className="block text-sm font-semibold text-stone-700 mb-1">담당자</label>
        <input value={owner} onChange={e => setOwner(e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-4" />

        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-stone-700">소스 레포</label>
          <button onClick={addSource} className="text-xs text-info border border-info px-2 py-0.5 rounded">+ 소스 추가</button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {sources.map((src, i) => (
            <div key={i} className="flex gap-2 items-center border border-blue-200 rounded-md p-2 bg-blue-50">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">레포</label>
                  <select value={src.repo} onChange={e => updateSource(i, 'repo', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm bg-white">
                    <option value="">선택...</option>
                    {availableRepos.map(r => (
                      <option key={r.repo} value={r.repo}>{r.repo}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">트랙</label>
                  <input value={src.track} onChange={e => updateSource(i, 'track', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
              </div>
              <button onClick={() => removeSource(i)} className="text-danger text-lg">✕</button>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
          ⚠ history와 PRD 데이터가 소스 레포에서 합산됩니다
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-5 py-2 border border-stone-300 rounded-md text-sm">취소</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-5 py-2 bg-info text-white rounded-md text-sm disabled:opacity-40">저장</button>
        </div>
      </div>
    </div>
  )
}
