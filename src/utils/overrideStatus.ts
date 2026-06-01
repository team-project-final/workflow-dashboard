import type { RepoData } from '../types'

export interface OverrideStatus {
  repo: string
  active: boolean
  serverNewer: boolean
  serverUpdatedAt: string
  overrideUpdatedAt: string
}

/**
 * Decide local-override / conflict state for one repo.
 * serverNewer is true only when a local override exists AND the server has a
 * timestamp strictly later than the override's (ISO 8601 → lexicographic compare).
 * Server fetch failure (server=null) yields serverNewer=false (no offline false-positive).
 */
export function computeOverrideStatus(
  repo: string,
  override: RepoData | null,
  server: RepoData | null,
): OverrideStatus {
  const active = !!override
  const overrideUpdatedAt = override?.updatedAt ?? ''
  const serverUpdatedAt = server?.updatedAt ?? ''
  const serverNewer = active && !!serverUpdatedAt && serverUpdatedAt > overrideUpdatedAt
  return { repo, active, serverNewer, serverUpdatedAt, overrideUpdatedAt }
}
