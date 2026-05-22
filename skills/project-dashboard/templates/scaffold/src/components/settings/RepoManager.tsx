import { useState } from 'react'
import type { DashboardConfig, RepoDef, LegacyRepoDef, VirtualTrackDef, LegacyVirtualTrackDef, VirtualTrackSource } from '../../types/config'
import { getRepoId, getRepoTrackName, getRepoOwner } from '../../types/config'
import RepoEditModal from './RepoEditModal'
import VirtualTrackModal from './VirtualTrackModal'

interface Props {
  config: DashboardConfig
  onUpdate: (config: DashboardConfig) => void
}

type ModalState =
  | { type: 'none' }
  | { type: 'repo'; index?: number }
  | { type: 'virtual'; index?: number }

export default function RepoManager({ config, onUpdate }: Props) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const saveRepo = (repo: RepoDef | LegacyRepoDef, index?: number) => {
    const repos = [...config.repos]
    if (index !== undefined) {
      repos[index] = repo
    } else {
      repos.push(repo)
    }
    onUpdate({ ...config, repos })
    setModal({ type: 'none' })
  }

  const deleteRepo = (index: number) => {
    if (!confirm(`"${getRepoId(config.repos[index])}" 레포를 삭제하시겠습니까?`)) return
    const repos = config.repos.filter((_, i) => i !== index)
    onUpdate({ ...config, repos })
  }

  const saveVirtual = (vt: VirtualTrackDef | LegacyVirtualTrackDef, index?: number) => {
    const virtualTracks = [...config.virtualTracks]
    if (index !== undefined) {
      virtualTracks[index] = vt
    } else {
      virtualTracks.push(vt)
    }
    onUpdate({ ...config, virtualTracks })
    setModal({ type: 'none' })
  }

  const deleteVirtual = (index: number) => {
    const vtDel = config.virtualTracks[index]
    const vtName = 'trackName' in vtDel ? vtDel.trackName : (vtDel as LegacyVirtualTrackDef).name
    if (!confirm(`"${vtName}" 가상 트랙을 삭제하시겠습니까?`)) return
    const virtualTracks = config.virtualTracks.filter((_, i) => i !== index)
    onUpdate({ ...config, virtualTracks })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold">등록된 레포 ({config.repos.length})</h3>
        <div className="flex gap-2">
          <button onClick={() => setModal({ type: 'virtual' })}
            className="text-sm px-4 py-2 border border-info text-info rounded-md hover:bg-blue-50">+ 가상 트랙</button>
          <button onClick={() => setModal({ type: 'repo' })}
            className="text-sm px-4 py-2 bg-info text-white rounded-md hover:bg-blue-600">+ 레포 추가</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {config.repos.map((repo, i) => (
          <div key={getRepoId(repo)} className="border border-stone-200 rounded-lg px-4 py-3 flex justify-between items-center">
            <div>
              <div className="font-semibold text-sm">{getRepoId(repo)}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                트랙: {getRepoTrackName(repo)} ({getRepoOwner(repo)})
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ type: 'repo', index: i })}
                className="text-xs px-3 py-1 border border-stone-200 rounded">편집</button>
              <button onClick={() => deleteRepo(i)}
                className="text-xs px-3 py-1 border border-red-200 text-danger rounded">삭제</button>
            </div>
          </div>
        ))}

        {config.virtualTracks.map((vt, i) => {
          const vtName = 'trackName' in vt ? vt.trackName : (vt as LegacyVirtualTrackDef).name
          const vtSources = 'trackName' in vt
            ? (vt.sources as string[]).join(' + ')
            : (vt as LegacyVirtualTrackDef).sources.map((s: VirtualTrackSource) => s.repo).join(' + ')
          return (
          <div key={vtName} className="border border-blue-200 rounded-lg px-4 py-3 flex justify-between items-center bg-blue-50">
            <div>
              <div className="font-semibold text-sm">
                🔗 {vtName} <span className="text-xs text-info font-normal">(가상 트랙 — 병합)</span>
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                소스: {vtSources} → 담당: {vt.owner}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ type: 'virtual', index: i })}
                className="text-xs px-3 py-1 border border-stone-200 rounded">편집</button>
              <button onClick={() => deleteVirtual(i)}
                className="text-xs px-3 py-1 border border-red-200 text-danger rounded">삭제</button>
            </div>
          </div>
          )
        })}
      </div>

      {modal.type === 'repo' && (
        <RepoEditModal
          initial={modal.index !== undefined ? config.repos[modal.index] : undefined}
          onSave={repo => saveRepo(repo, modal.index)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
      {modal.type === 'virtual' && (
        <VirtualTrackModal
          initial={modal.index !== undefined ? config.virtualTracks[modal.index] : undefined}
          availableRepos={config.repos}
          onSave={vt => saveVirtual(vt, modal.index)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
