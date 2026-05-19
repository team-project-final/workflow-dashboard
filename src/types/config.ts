export interface TrackDef {
  name: string
  owner: string
}

export interface RepoDef {
  repo: string
  tracks: TrackDef[]
}

export interface VirtualTrackSource {
  repo: string
  track: string
}

export interface VirtualTrackDef {
  name: string
  owner: string
  sources: VirtualTrackSource[]
}

export interface DashboardConfig {
  version: number
  repos: RepoDef[]
  virtualTracks: VirtualTrackDef[]
}
