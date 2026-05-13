# Workflow 세부 체크리스트 항목 표시

**날짜**: 2026-05-13
**상태**: 승인됨

## 문제

상세 페이지에서 Step 클릭 시 Workflow 컬럼에 Phase 이름과 done/total 숫자만 표시된다.
각 Phase 안의 실제 체크리스트 항목 텍스트(예: "Spring Boot 4 + Modulith 프로젝트 구조 분석")가
표시되지 않아서 구체적으로 무엇을 해야 하는지 알 수 없다.

원인: `parse-workflow.mjs`가 체크박스 개수만 세고 텍스트를 저장하지 않음.

## 해결 방식

Phase 행 클릭 시 아코디언으로 세부 체크리스트 항목을 펼치는 방식.

## 변경 사항

### 1. 데이터 모델 (`src/types/index.ts`)

`CheckItem` 인터페이스 추가, `Phase`에 `items` 필드 추가:

```ts
export interface CheckItem {
  text: string
  done: boolean
}

export interface Phase {
  name: string
  total: number
  done: number
  items: CheckItem[]
}
```

### 2. 파서 (`scripts/parse-workflow.mjs`)

`parseCheckboxes()` 반환값을 그대로 phase의 `items` 배열에 저장.
현재 이미 `{ done, text }` 객체를 파싱하므로 저장 로직만 추가.

변경 부분:
```js
phaseParts.forEach((pp, j) => {
  const checks = parseCheckboxes(pp)
  phases.push({
    name: phaseNames[j] || `Phase ${j + 1}`,
    total: checks.length,
    done: checks.filter(c => c.done).length,
    items: checks,  // 추가
  })
})
```

### 3. JSON 데이터 재생성

GitHub에서 workflow 마크다운을 다운로드하여 6개 레포 JSON 재파싱.
또는 로컬에 documents 레포가 있으면 직접 파싱.

### 4. UI (`src/components/WorkflowColumn.tsx`)

- Phase 행에 클릭 핸들러 + 화살표 아이콘(▶/▼) 추가
- `useState<Set<number>>` 로 열린 phase 인덱스 관리 (여러 개 동시 오픈 가능)
- 펼치면 들여쓰기된 체크리스트 항목 표시: `✅`/`⬜` + 텍스트
- items가 빈 배열이면 화살표 비표시 (클릭 불가)

### 5. 폴백 (`src/hooks/useData.ts`)

`emptyRepoData()`의 phase 생성 시 `items: []` 추가.

## 영향 범위

| 파일 | 변경 |
|------|------|
| `src/types/index.ts` | CheckItem 추가, Phase에 items 추가 |
| `scripts/parse-workflow.mjs` | items 저장 |
| `data/*.json` (6개) | 재생성 |
| `src/components/WorkflowColumn.tsx` | 아코디언 UI |
| `src/hooks/useData.ts` | emptyRepoData에 items 추가 |

## 제외 사항

- 체크리스트 항목 클릭으로 done 토글하는 기능은 포함하지 않음 (읽기 전용)
- 검색/필터 기능 없음
