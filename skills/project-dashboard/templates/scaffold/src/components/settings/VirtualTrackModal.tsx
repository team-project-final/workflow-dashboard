import { useState } from 'react'
import type { VirtualTrackDef, LegacyVirtualTrackDef, VirtualTrackSource, RepoDef, LegacyRepoDef } from '../../types/config'
import { getRepoId } from '../../types/config'

interface Props {
  initial?: VirtualTrackDef | LegacyVirtualTrackDef
  availableRepos: (RepoDef | LegacyRepoDef)[]
  onSave: (vt: VirtualTrackDef | LegacyVirtualTrackDef) => void
  onCancel: () => void
}

function extractRepoName(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  const segments = trimmed.split('/')
  return segments[segments.length - 1] || trimmed
}

export default function VirtualTrackModal({ initial, availableRepos, onSave, onCancel }: Props) {
  const initialName = initial ? ('trackName' in initial ? initial.trackName : (initial as LegacyVirtualTrackDef).name) : ''
  const [name, setName] = useState(initialName)
  const [owner, setOwner] = useState(initial?.owner || '')
  const initialSources: (VirtualTrackSource & { customRepo?: string })[] = initial
    ? ('trackName' in initial
      ? (initial.sources as string[]).map(s => ({ repo: s, track: '' }))
      : (initial as LegacyVirtualTrackDef).sources.map(s => ({ repo: s.repo, track: s.track })))
    : [{ repo: '', track: '' }]
  const [sources, setSources] = useState<(VirtualTrackSource & { customRepo?: string })[]>(initialSources)

  const addSource = () => setSources([...sources, { repo: '', track: '' }])
  const removeSource = (i: number) => setSources(sources.filter((_, idx) => idx !== i))

  const updateSourceRepo = (i: number, value: string) => {
    setSources(sources.map((s, idx) => {
      if (idx !== i) return s
      if (value === '__custom__') {
        return { ...s, repo: '', customRepo: '' }
      }
      return { ...s, repo: value, customRepo: undefined }
    }))
  }

  const updateCustomRepo = (i: number, value: string) => {
    const repoName = extractRepoName(value)
    setSources(sources.map((s, idx) => idx === i ? { ...s, repo: repoName, customRepo: value } : s))
  }

  const updateSourceTrack = (i: number, value: string) => {
    setSources(sources.map((s, idx) => idx === i ? { ...s, track: value } : s))
  }

  const canSave = name.trim() !== '' && owner.trim() !== '' &&
    sources.length > 0 && sources.every(s => s.repo.trim() !== '' && s.track.trim() !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      owner: owner.trim(),
      sources: sources.map(s => ({ repo: s.repo.trim(), track: s.track.trim() })),
    } as LegacyVirtualTrackDef)
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
          {sources.map((src, i) => {
            const isCustom = src.customRepo !== undefined
            return (
              <div key={i} className="flex gap-2 items-center border border-blue-200 rounded-md p-2 bg-blue-50">
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-stone-500">레포</label>
                      {isCustom ? (
                        <div>
                          <input
                            value={src.customRepo}
                            onChange={e => updateCustomRepo(i, e.target.value)}
                            placeholder="org/repo 또는 레포명"
                            className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
                          />
                          {src.customRepo && src.customRepo.includes('/') && (
                            <p className="text-[10px] text-info mt-0.5">→ {src.repo}</p>
                          )}
                          <button onClick={() => updateSourceRepo(i, '')}
                            className="text-[10px] text-stone-400 mt-0.5">← 목록에서 선택</button>
                        </div>
                      ) : (
                        <select value={src.repo} onChange={e => updateSourceRepo(i, e.target.value)}
                          className="w-full px-2 py-1 border border-stone-300 rounded text-sm bg-white">
                          <option value="">선택...</option>
                          {availableRepos.map(r => {
                            const rid = getRepoId(r)
                            return <option key={rid} value={rid}>{rid}</option>
                          })}
                          <option value="__custom__">직접 입력...</option>
                        </select>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-stone-500">트랙</label>
                      <input value={src.track} onChange={e => updateSourceTrack(i, e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-sm" />
                    </div>
                  </div>
                </div>
                <button onClick={() => removeSource(i)} className="text-danger text-lg self-start mt-4">✕</button>
              </div>
            )
          })}
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
