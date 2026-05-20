// Legacy format types (backward compatible)
export interface TrackDef {
  name: string
  owner: string
}

export interface LegacyRepoDef {
  repo: string
  tracks: TrackDef[]
}

export interface VirtualTrackSource {
  repo: string
  track: string
}

export interface LegacyVirtualTrackDef {
  name: string
  owner: string
  sources: VirtualTrackSource[]
}

// New format types
export interface PeriodDef {
  id: string
  label: string
  start: string
  end: string
}

export interface ColumnDef {
  id: string
  label: string
  type: 'list' | 'checklist' | 'kanban'
}

export interface SourceDef {
  type: 'github-markdown' | 'notion' | 'linear' | 'manual'
  repo?: string
  path?: string
  databaseId?: string
  projectId?: string
  mapping?: Record<string, string>
}

export interface RepoDef {
  id: string
  trackName: string
  owner: string
  source?: SourceDef
}

export interface VirtualTrackDef {
  id: string
  trackName: string
  owner: string
  sources: string[]
}

export interface ProjectDef {
  name: string
  description?: string
}

// Unified config — supports both formats
export interface DashboardConfig {
  version: number
  project?: ProjectDef
  periods?: PeriodDef[]
  columns?: ColumnDef[]
  repos: (RepoDef | LegacyRepoDef)[]
  virtualTracks: (VirtualTrackDef | LegacyVirtualTrackDef)[]
}

// Type guards
export function isNewFormat(config: DashboardConfig): boolean {
  return 'id' in (config.repos[0] || {})
}

export function getRepoId(repo: RepoDef | LegacyRepoDef): string {
  return 'id' in repo ? repo.id : (repo as LegacyRepoDef).repo
}

export function getRepoTrackName(repo: RepoDef | LegacyRepoDef): string {
  if ('trackName' in repo) return repo.trackName
  return (repo as LegacyRepoDef).tracks.map(t => t.name).join(', ')
}

export function getRepoOwner(repo: RepoDef | LegacyRepoDef): string {
  if ('owner' in repo && typeof repo.owner === 'string') return repo.owner
  return (repo as LegacyRepoDef).tracks[0]?.owner || 'unknown'
}
