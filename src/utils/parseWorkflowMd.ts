import { parseWorkflowMarkdown as _parseWorkflowMarkdown, parseCheckboxes as _parseCheckboxes } from '../../scripts/parsers/parse-workflow-md.mjs'

export interface ParsedCheckbox {
  done: boolean
  text: string
}

export interface ParsedPhase {
  name: string
  total: number
  done: number
  items: ParsedCheckbox[]
}

export interface ParsedStep {
  name: string
  status: 'Not Started' | 'In Progress' | 'Done'
  totalChecks: number
  doneChecks: number
  phases: ParsedPhase[]
}

export const parseCheckboxes: (content: string) => ParsedCheckbox[] = _parseCheckboxes
export const parseWorkflowMarkdown: (content: string) => ParsedStep[] = _parseWorkflowMarkdown
