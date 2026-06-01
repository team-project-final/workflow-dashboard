export interface CheckItem {
  text: string
  done: boolean
}

export interface Phase {
  name: string
  total: number
  done: number
  items: CheckItem[]
}

export interface Step {
  name: string
  status: 'Done' | 'In Progress' | 'Not Started'
  phases: Phase[]
  totalChecks: number
  doneChecks: number
}

export interface Week {
  week: string
  period: string
  steps: Step[]
  totalChecks: number
  doneChecks: number
}

export interface Track {
  name: string
  owner: string
  weeks: Week[]
}

export interface PrdItem {
  id: string
  title: string
  status: 'done' | 'in_progress' | 'not_started'
}

export interface PrdWeek {
  week: string
  items: PrdItem[]
}

export interface HistoryEntry {
  date: string
  totalChecks: number
  doneChecks: number
}

export interface ChangeDetail {
  type: string
  target: string
  detail?: string
  field?: string
  before?: string
  after?: string
}

export interface ChangelogEntry {
  date: string
  commit: string
  author: string
  file: string
  changes: ChangeDetail[]
}

export interface RepoData {
  repo: string
  updatedAt: string
  tracks: Track[]
  prd: PrdWeek[]
  prdPerTrack?: PrdWeek[][]
  history: HistoryEntry[]
  changelog: ChangelogEntry[]
}
