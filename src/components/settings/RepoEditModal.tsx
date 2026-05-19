import { useState } from 'react'
import type { RepoDef, TrackDef } from '../../types/config'

interface Props {
  initial?: RepoDef
  onSave: (repo: RepoDef) => void
  onCancel: () => void
}

export default function RepoEditModal({ initial, onSave, onCancel }: Props) {
  const [repoName, setRepoName] = useState(initial?.repo || '')
  const [tracks, setTracks] = useState<TrackDef[]>(initial?.tracks || [{ name: '', owner: '' }])

  const addTrack = () => setTracks([...tracks, { name: '', owner: '' }])
  const removeTrack = (i: number) => setTracks(tracks.filter((_, idx) => idx !== i))
  const updateTrack = (i: number, field: keyof TrackDef, value: string) =>
    setTracks(tracks.map((t, idx) => idx === i ? { ...t, [field]: value } : t))

  const canSave = repoName.trim() !== '' && tracks.every(t => t.name.trim() !== '' && t.owner.trim() !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({ repo: repoName.trim(), tracks: tracks.map(t => ({ name: t.name.trim(), owner: t.owner.trim() })) })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-5">{initial ? '레포 편집' : '레포 추가'}</h3>

        <label className="block text-sm font-semibold text-stone-700 mb-1">레포 이름</label>
        <input
          value={repoName}
          onChange={e => setRepoName(e.target.value)}
          placeholder="synapse-example-svc"
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm mb-1"
        />
        <p className="text-xs text-stone-400 mb-4">data/ 폴더의 JSON 파일명과 일치해야 합니다</p>

        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-stone-700">트랙 목록</label>
          <button onClick={addTrack} className="text-xs text-info border border-info px-2 py-0.5 rounded">+ 트랙 추가</button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {tracks.map((track, i) => (
            <div key={i} className="flex gap-2 items-center border border-stone-200 rounded-md p-2">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">트랙명</label>
                  <input value={track.name} onChange={e => updateTrack(i, 'name', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-stone-500">담당자</label>
                  <input value={track.owner} onChange={e => updateTrack(i, 'owner', e.target.value)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                </div>
              </div>
              {tracks.length > 1 && (
                <button onClick={() => removeTrack(i)} className="text-danger text-lg">✕</button>
              )}
            </div>
          ))}
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
