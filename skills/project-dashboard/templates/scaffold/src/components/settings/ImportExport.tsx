import { useRef } from 'react'
import type { DashboardConfig } from '../../types/config'
import { getRepoId } from '../../types/config'

interface Props {
  config: DashboardConfig
  isOverridden: boolean
  onImport: (config: DashboardConfig) => void
  onReset: () => void
}

const LS_DATA_PREFIX = 'dashboard-data-'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getModifiedRepos(repos: string[]): string[] {
  return repos.filter(r => localStorage.getItem(LS_DATA_PREFIX + r) !== null)
}

export default function ImportExport({ config, isOverridden, onImport, onReset }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const allRepos = config.repos.map(r => getRepoId(r))
  const modifiedRepos = getModifiedRepos(allRepos)

  const exportConfig = () => downloadJson(config, 'config.json')

  const exportRepoData = (repo: string) => {
    const raw = localStorage.getItem(LS_DATA_PREFIX + repo)
    if (raw) {
      downloadJson(JSON.parse(raw), `${repo}.json`)
    } else {
      fetch(`${import.meta.env.BASE_URL}data/${repo}.json`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) downloadJson(data, `${repo}.json`) })
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as DashboardConfig
        if (!parsed.version || !Array.isArray(parsed.repos)) {
          alert('유효하지 않은 config.json 형식입니다.')
          return
        }
        onImport(parsed)
        alert('설정을 가져왔습니다.')
      } catch {
        alert('JSON 파싱 실패')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleReset = () => {
    if (!confirm('모든 localStorage 오버라이드를 삭제하고 원본으로 복원하시겠습니까?')) return
    for (const repo of allRepos) {
      localStorage.removeItem(LS_DATA_PREFIX + repo)
    }
    onReset()
    alert('초기화 완료. 페이지를 새로고침합니다.')
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📤 설정 내보내기 (config.json)</h4>
        <p className="text-xs text-stone-500 mb-3">
          레포/트랙/담당자 매핑을 config.json으로 다운로드합니다.
          이 파일을 <code className="bg-stone-100 px-1 rounded">data/config.json</code>에 커밋하면 파서와 CI에서도 사용됩니다.
          {isOverridden && <span className="text-amber-600 font-medium"> (localStorage 오버라이드 포함)</span>}
        </p>
        <button onClick={exportConfig} className="text-sm px-4 py-2 bg-info text-white rounded-md">config.json 다운로드</button>
      </div>

      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📤 데이터 내보내기</h4>
        <p className="text-xs text-stone-500 mb-3">수정된 레포 데이터를 개별 JSON으로 다운로드합니다.</p>
        <div className="flex gap-2 flex-wrap">
          {allRepos.map(repo => {
            const isMod = modifiedRepos.includes(repo)
            return (
              <div key={repo}
                className={`border rounded-md px-3 py-2 text-xs flex items-center gap-2 ${isMod ? 'border-amber-200 bg-amber-50' : 'border-stone-200'}`}>
                <span className={isMod ? 'text-warning' : 'text-success'}>●</span>
                {repo}.json
                {isMod && <span className="text-amber-700 text-[10px]">(수정됨)</span>}
                <button onClick={() => exportRepoData(repo)} className="text-info ml-1">⬇</button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1">📥 설정 가져오기</h4>
        <p className="text-xs text-stone-500 mb-3">config.json을 업로드하여 설정을 복원합니다.</p>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport}
          className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-stone-100 file:text-stone-700 file:text-sm" />
      </div>

      <div className="border border-red-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-danger mb-1">🔄 초기화</h4>
        <p className="text-xs text-stone-500 mb-3">localStorage의 모든 오버라이드를 삭제하고 원본 data/*.json으로 복원합니다.</p>
        <button onClick={handleReset} className="text-sm px-4 py-2 border border-red-200 text-danger rounded-md hover:bg-red-50">전체 초기화</button>
      </div>
    </div>
  )
}
