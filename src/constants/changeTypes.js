// Single source of truth for changelog change types.
// Imported by both Node scripts (scripts/validate-data.mjs) and the React UI
// (src/components/ChangelogTab.tsx). Node uses only `id`; label/bg/text/border/category
// are UI-only fields (Node ignores them).
export const CHANGE_TYPES = [
  { id: 'step_added',    label: 'Step 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'step_deleted',  label: 'Step 삭제', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
  { id: 'step_modified', label: '내용 수정', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-l-amber',      category: 'modified'  },
  { id: 'check_done',    label: '체크 완료', bg: 'bg-green-50', text: 'text-green-800', border: 'border-l-success',    category: 'checks'    },
  { id: 'check_undone',  label: '체크 해제', bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-l-stone-400',  category: 'checks'    },
  { id: 'phase_added',   label: '단계 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'phase_deleted', label: '단계 삭제', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
  { id: 'boxes_added',   label: '박스 추가', bg: 'bg-sky-50',   text: 'text-sky-800',   border: 'border-l-info',       category: 'structure' },
  { id: 'boxes_removed', label: '박스 제거', bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-l-danger',     category: 'structure' },
]

export const CHANGE_TYPE_IDS = CHANGE_TYPES.map(t => t.id)
export const CHANGE_TYPE_META = Object.fromEntries(CHANGE_TYPES.map(t => [t.id, t]))
