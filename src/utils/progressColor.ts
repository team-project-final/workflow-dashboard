/**
 * 진행률(%) 기반 통일 색상 체계
 *
 *   90~100%  success (초록)  — 완료 임박/완료
 *   60~89%   info    (파랑)  — 양호
 *   30~59%   warning (주황)  — 진행 중
 *    1~29%   danger  (빨강)  — 위험/지연
 *       0%   stone   (회색)  — 미시작
 */

export function progressText(p: number): string {
  if (p >= 90) return 'text-success'
  if (p >= 60) return 'text-info'
  if (p >= 30) return 'text-warning'
  if (p > 0) return 'text-danger'
  return 'text-stone-400'
}

export function progressBg(p: number): string {
  if (p >= 90) return 'bg-success'
  if (p >= 60) return 'bg-info'
  if (p >= 30) return 'bg-warning'
  if (p > 0) return 'bg-danger'
  return 'bg-stone-200'
}

export function progressBorder(p: number): string {
  if (p >= 90) return 'border-success'
  if (p >= 60) return 'border-info'
  if (p >= 30) return 'border-warning'
  if (p > 0) return 'border-danger'
  return 'border-stone-200'
}
