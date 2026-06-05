/**
 * Pure markdown parsing — no fs/path. Usable in Node and browser.
 */

export function parseCheckboxes(content) {
  const checks = []
  // [~] = 부분완료(팀 컨벤션). done 미집계하되 항목은 표출 + partial 플래그.
  const re = /^(\s*)- \[([ xX~])\]\s+(.+)$/gm
  let match
  while ((match = re.exec(content)) !== null) {
    checks.push({
      done: match[2] === 'x' || match[2] === 'X',
      partial: match[2] === '~',
      text: match[3].trim(),
    })
  }
  return checks
}

export function parseWorkflowMarkdown(content) {
  const steps = []
  const stepParts = content.split(/^## Step \d+: /m).slice(1)
  const stepNames = [...content.matchAll(/^## Step (\d+): (.+)$/gm)].map(m => m[2])

  stepParts.forEach((part, i) => {
    const phases = []
    const phaseParts = part.split(/^### \d+\.\d+ /m).slice(1)
    const phaseNames = [...part.matchAll(/^### (\d+\.\d+) (.+)$/gm)].map(m => m[2])

    phaseParts.forEach((pp, j) => {
      const checks = parseCheckboxes(pp)
      phases.push({
        name: phaseNames[j] || `Phase ${j + 1}`,
        total: checks.length,
        done: checks.filter(c => c.done).length,
        partial: checks.filter(c => c.partial).length,
        items: checks.map(c => ({ text: c.text, done: c.done, partial: !!c.partial })),
      })
    })

    const totalChecks = phases.reduce((s, p) => s + p.total, 0)
    const doneChecks = phases.reduce((s, p) => s + p.done, 0)
    const partialChecks = phases.reduce((s, p) => s + (p.partial || 0), 0)
    const status = totalChecks === 0 ? 'Not Started'
      : doneChecks === totalChecks ? 'Done'
      : (doneChecks > 0 || partialChecks > 0) ? 'In Progress' : 'Not Started'

    steps.push({ name: stepNames[i] || `Step ${i + 1}`, status, phases, totalChecks, doneChecks })
  })

  return steps
}
