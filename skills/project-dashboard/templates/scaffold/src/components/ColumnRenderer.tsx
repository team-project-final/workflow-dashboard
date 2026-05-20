import type { Step } from '../types'
import type { ColumnDef } from '../types/config'
import type { PrdWeek } from '../types'
import ChecklistColumn from './ChecklistColumn'
import ListColumn from './ListColumn'

interface Props {
  column: ColumnDef
  steps: Step[]
  prdWeek?: PrdWeek
  selectedStep: Step | null
  onSelectStep: (step: Step | null) => void
}

export default function ColumnRenderer({ column, steps, prdWeek, selectedStep, onSelectStep }: Props) {
  switch (column.type) {
    case 'list':
      return <ListColumn label={column.label} prdWeek={prdWeek} />

    case 'checklist':
      return (
        <ChecklistColumn
          label={column.label}
          steps={steps}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
      )

    case 'kanban':
      return (
        <ChecklistColumn
          label={column.label}
          steps={steps}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
      )

    default:
      return <div className="p-4 text-stone-400 text-xs">Unknown column type: {column.type}</div>
  }
}
