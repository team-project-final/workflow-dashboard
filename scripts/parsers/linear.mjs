#!/usr/bin/env node
/**
 * Linear parser — maps Linear issues/projects to TrackData format.
 *
 * Uses Linear GraphQL API. The sync skill module handles authentication
 * and API calls, passing raw issue data to transform().
 *
 * Interface: { name, validate, fetch, transform }
 */

const name = 'linear'

function validate(config) {
  if (!config.projectId) return { valid: false, error: 'source.projectId is required' }
  return { valid: true }
}

/**
 * Fetch returns instructions for the skill module.
 * The actual GraphQL query is executed by Claude Code.
 */
function fetch(config, options = {}) {
  const query = `
    query GetProjectIssues($projectId: String!) {
      project(id: $projectId) {
        name
        issues {
          nodes {
            id
            title
            state { name type }
            labels { nodes { name } }
            cycle { number startsAt endsAt }
          }
        }
      }
    }
  `

  return {
    type: 'linear-graphql',
    projectId: config.projectId,
    query,
    instructions: 'Execute this GraphQL query against Linear API. Pass the result to transform().',
  }
}

/**
 * Transform Linear API response into TrackData format.
 * @param {object} raw - { project: { name, issues: { nodes: [...] } } }
 * @param {object} options - { periodMap }
 */
function transform(raw, options = {}) {
  const { periodMap = {} } = options
  const issues = raw.project?.issues?.nodes || raw.issues || []

  // Group by cycle (week)
  const weekMap = new Map()
  for (const issue of issues) {
    const weekId = issue.cycle ? `W${issue.cycle.number}` : 'W1'
    if (!weekMap.has(weekId)) weekMap.set(weekId, [])
    weekMap.get(weekId).push(issue)
  }

  const weeks = []
  for (const [weekId, weekIssues] of [...weekMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Group by first label (as step)
    const stepMap = new Map()
    for (const issue of weekIssues) {
      const label = issue.labels?.nodes?.[0]?.name || 'Uncategorized'
      if (!stepMap.has(label)) stepMap.set(label, [])
      stepMap.get(label).push(issue)
    }

    const steps = []
    for (const [labelName, labelIssues] of stepMap) {
      const items = labelIssues.map(issue => ({
        text: issue.title,
        done: issue.state?.type === 'completed',
      }))

      const total = items.length
      const done = items.filter(i => i.done).length
      const status = done === total ? 'Done' : done > 0 ? 'In Progress' : 'Not Started'

      steps.push({
        name: labelName,
        status,
        phases: [{ name: labelName, total, done, items }],
        totalChecks: total,
        doneChecks: done,
      })
    }

    weeks.push({
      week: weekId,
      period: periodMap[weekId] || '',
      steps,
      totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
      doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
    })
  }

  return {
    tracks: [{ name: raw.project?.name || 'default', owner: 'unknown', weeks }],
    prd: [],
  }
}

export default { name, validate, fetch, transform }
