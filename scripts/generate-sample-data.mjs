import { writeFileSync, mkdirSync } from 'fs'

const repos = [
  {
    repo: 'synapse-platform-svc',
    tracks: [{ name: 'platform', owner: '김해준' }],
    prdPrefix: 'FR-PL',
  },
  {
    repo: 'synapse-engagement-svc',
    tracks: [{ name: 'engagement', owner: '한승완' }],
    prdPrefix: 'FR-EG',
  },
  {
    repo: 'synapse-knowledge-svc',
    tracks: [
      { name: 'knowledge-1', owner: '김현지' },
      { name: 'knowledge-2', owner: '박은서' },
    ],
    prdPrefix: 'FR-KN',
  },
  {
    repo: 'synapse-learning-svc',
    tracks: [
      { name: 'learning-card', owner: '조유지' },
      { name: 'learning-ai', owner: '김나경' },
    ],
    prdPrefix: 'FR-LC',
  },
  {
    repo: 'synapse-frontend',
    tracks: [{ name: 'frontend', owner: '전원' }],
    prdPrefix: 'FR-FE',
  },
  {
    repo: 'synapse-gitops',
    tracks: [{ name: 'team-lead', owner: '김민구' }],
    prdPrefix: 'FR-TL',
  },
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generatePhases(doneRatio) {
  const phaseNames = [
    'TASK 시작', '요구사항 분석', 'Security 1차', 'ERD 설계',
    'Security 2차', 'DTO/Entity', 'Repository', 'Service+Test',
    'Controller+Test', 'View+Test',
  ]
  return phaseNames.map((name, i) => {
    const total = randomInt(2, 5)
    const done = i / 10 < doneRatio ? total : i / 10 < doneRatio + 0.1 ? randomInt(0, total) : 0
    return { name, total, done }
  })
}

function generateWeeks(trackName) {
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5']
  const periods = ['05-12~05-16', '05-19~05-23', '05-26~05-29', '06-01~06-05', '06-08~06-12']
  return weeks.map((week, wi) => {
    const stepCount = randomInt(2, 4)
    const weekDoneRatio = wi === 0 ? 0.7 : wi === 1 ? 0.3 : 0
    const steps = Array.from({ length: stepCount }, (_, si) => {
      const doneRatio = weekDoneRatio * (1 - si * 0.2)
      const phases = generatePhases(Math.max(0, doneRatio))
      const totalChecks = phases.reduce((s, p) => s + p.total, 0)
      const doneChecks = phases.reduce((s, p) => s + p.done, 0)
      const status = doneChecks === totalChecks ? 'Done' : doneChecks > 0 ? 'In Progress' : 'Not Started'
      return {
        name: `${trackName} Step ${si + 1} (${week})`,
        status,
        phases,
        totalChecks,
        doneChecks,
      }
    })
    return {
      week,
      period: periods[wi],
      steps,
      totalChecks: steps.reduce((s, st) => s + st.totalChecks, 0),
      doneChecks: steps.reduce((s, st) => s + st.doneChecks, 0),
    }
  })
}

function generateHistory() {
  const entries = []
  const startDate = new Date('2026-05-12')
  for (let d = 0; d < 3; d++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + d)
    entries.push({
      date: date.toISOString().slice(0, 10),
      totalChecks: 160,
      doneChecks: randomInt(d * 20, d * 30 + 10),
    })
  }
  return entries
}

function generateChangelog(trackName, author) {
  return [
    {
      date: '2026-05-13T17:20:00+09:00',
      commit: 'abc1234',
      author,
      file: `TASK_${trackName}.md`,
      changes: [
        { type: 'step_modified', target: 'Step 2', field: 'Scope', before: 'Google OAuth만', after: 'Google + GitHub OAuth' },
      ],
    },
    {
      date: '2026-05-13T11:00:00+09:00',
      commit: 'def5678',
      author,
      file: `WORKFLOW_${trackName}_W1.md`,
      changes: [
        { type: 'check_done', target: 'Step 1 > Security 1차', detail: '3개 항목 완료' },
      ],
    },
  ]
}

function generatePrd(prefix) {
  return [{
    week: 'W1',
    items: [
      { id: `${prefix}-001`, title: '기능 A', status: 'done' },
      { id: `${prefix}-002`, title: '기능 B', status: 'in_progress' },
      { id: `${prefix}-003`, title: '기능 C', status: 'not_started' },
    ],
  }]
}

mkdirSync('data', { recursive: true })

for (const { repo, tracks, prdPrefix } of repos) {
  const data = {
    repo,
    updatedAt: new Date().toISOString(),
    tracks: tracks.map(t => ({
      name: t.name,
      owner: t.owner,
      weeks: generateWeeks(t.name),
    })),
    prd: generatePrd(prdPrefix),
    history: generateHistory(),
    changelog: generateChangelog(tracks[0].name, tracks[0].owner),
  }
  writeFileSync(`data/${repo}.json`, JSON.stringify(data, null, 2))
  console.log(`Generated: data/${repo}.json`)
}
