/**
 * done 회귀 방지 가드 (Step별 max 병합).
 *
 * sync는 "워크플로우 문서가 있는 최신 커밋 브랜치"를 소스로 쓰므로, main보다
 * done이 적은 WIP 브랜치가 가장 최근 커밋이면 대시보드 done 수가 역행할 수 있다.
 * 이 가드는 각 Step의 doneChecks가 이전 데이터보다 낮아지면 그 Step을 이전(높은)
 * 스냅샷 그대로 유지해 역행을 막는다. Step은 트랙명 → 주차 → Step 이름으로 매칭.
 *
 * - force=true 또는 이전 데이터 없음 → 새 tracks를 그대로 반환.
 * - 입력은 변형하지 않고 새 배열/객체를 반환한다.
 * - week/track의 done·total 합계는 병합된 Step 기준으로 재계산한다.
 *
 * @param {Array|null|undefined} oldTracks  이전 data/*.json의 tracks
 * @param {Array} newTracks                 새로 파싱한 tracks
 * @param {{force?: boolean}} [opts]
 * @returns {Array} 가드 적용된 tracks
 */
export function applyDoneGuard(oldTracks, newTracks, opts = {}) {
  const { force = false } = opts
  if (force || !Array.isArray(oldTracks)) return newTracks

  return newTracks.map(track => {
    const oldTrack = oldTracks.find(t => t.name === track.name)
    if (!oldTrack) return track

    const weeks = (track.weeks || []).map(week => {
      const oldWeek = (oldTrack.weeks || []).find(w => w.week === week.week)
      if (!oldWeek) return week

      const steps = (week.steps || []).map(step => {
        const oldStep = (oldWeek.steps || []).find(s => s.name === step.name)
        if (oldStep && (oldStep.doneChecks || 0) > (step.doneChecks || 0)) {
          return oldStep // 이전(높은) Step 스냅샷 유지
        }
        return step
      })

      return {
        ...week,
        steps,
        doneChecks: steps.reduce((s, st) => s + (st.doneChecks || 0), 0),
        totalChecks: steps.reduce((s, st) => s + (st.totalChecks || 0), 0),
      }
    })

    return { ...track, weeks }
  })
}
