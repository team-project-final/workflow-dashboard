#!/usr/bin/env node
/**
 * Notion parser — maps Notion database pages to TrackData format.
 *
 * This parser is designed to be called from the sync skill module,
 * which uses Notion MCP tools to fetch the raw data. The transform
 * function converts Notion API responses into the dashboard format.
 *
 * Interface: { name, validate, fetch, transform }
 */

const name = 'notion'

function validate(config) {
  if (!config.databaseId) return { valid: false, error: 'source.databaseId is required' }
  return { valid: true }
}

/**
 * Fetch is a no-op for Notion — the sync skill module handles
 * data fetching via MCP tools. This function returns instructions
 * for the skill module.
 */
function fetch(config, options = {}) {
  return {
    type: 'notion-mcp',
    databaseId: config.databaseId,
    mapping: config.mapping || {},
    instructions: 'Use Notion MCP tools to query this database. Pass the result to transform().',
  }
}

/**
 * Transform Notion API response into TrackData format.
 * @param {object} raw - { pages: Array<NotionPage> }
 * @param {object} options - { mapping, periodMap }
 */
function transform(raw, options = {}) {
  const { mapping = {}, periodMap = {} } = options
  const stepField = mapping.step || 'Name'
  const phaseField = mapping.phase || 'Category'
  const doneField = mapping.done || 'Status'
  const doneValue = mapping.doneValue || '완료'
  const weekField = mapping.week || 'Sprint'

  const pages = raw.pages || []

  // Group pages by week
  const weekMap = new Map()
  for (const page of pages) {
    const week = getProperty(page, weekField) || 'W1'
    if (!weekMap.has(week)) weekMap.set(week, [])
    weekMap.get(week).push(page)
  }

  const weeks = []
  for (const [weekId, weekPages] of [...weekMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Group by phase
    const phaseMap = new Map()
    for (const page of weekPages) {
      const phase = getProperty(page, phaseField) || 'Default'
      if (!phaseMap.has(phase)) phaseMap.set(phase, [])
      phaseMap.get(phase).push(page)
    }

    const steps = []
    for (const [phaseName, phasePages] of phaseMap) {
      const items = phasePages.map(page => ({
        text: getProperty(page, stepField) || 'Untitled',
        done: getProperty(page, doneField) === doneValue,
      }))

      const total = items.length
      const done = items.filter(i => i.done).length
      const status = done === total ? 'Done' : done > 0 ? 'In Progress' : 'Not Started'

      steps.push({
        name: phaseName,
        status,
        phases: [{ name: phaseName, total, done, items }],
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

  return { tracks: [{ name: 'default', owner: 'unknown', weeks }], prd: [] }
}

/**
 * Extract a property value from a Notion page object.
 */
function getProperty(page, fieldName) {
  const prop = page.properties?.[fieldName]
  if (!prop) return null

  switch (prop.type) {
    case 'title': return prop.title?.[0]?.plain_text || null
    case 'rich_text': return prop.rich_text?.[0]?.plain_text || null
    case 'select': return prop.select?.name || null
    case 'multi_select': return prop.multi_select?.map(s => s.name).join(', ') || null
    case 'status': return prop.status?.name || null
    case 'checkbox': return prop.checkbox ? '완료' : '미완료'
    case 'number': return prop.number?.toString() || null
    case 'date': return prop.date?.start || null
    default: return null
  }
}

export default { name, validate, fetch, transform }
export { getProperty }
