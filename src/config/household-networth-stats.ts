// 가구 순자산 구간별 분포 통계 상수 (#201, 5.102)
// 정적 상수만 둔다. 검증·구간 판정·문장 수치는 lib/report/networth-benchmark.ts 소관.
// 공표값은 원문 표에서 직접 옮기고 변형하지 않는다(재계산·보정·구간 합치기 금지).
// 새 통계가 발표되면 이 파일의 상수만 바꾼다 — 화면의 조사 연도·출처 줄은 전부 meta에서 파생된다.

export const EOK = 100_000_000; // 1억 원 — 금액은 `3 * EOK` 꼴로 적어 0 개수 오기를 막는다
export const MAN = 10_000;      // 1만 원

export interface HouseholdNetworthMeta {
  surveyName: string;            // 조사명
  agencies: readonly string[];   // 작성기관(원문 표기 순서)
  surveyYear: number;            // 조사 연도 — 라벨 '{연도}년 조사'
  referenceDate: string | null;  // 자산 기준일 "YYYY-MM-DD" — 원문에서 확인하지 못하면 null(짐작 금지, 화면에서 생략)
  tableSource: { name: string; id: string; url?: string }; // 표 이름·번호(화면 출처 줄에 id 표시)·주소(확인된 경우만)
  transcribedAt: string;         // 원문에서 옮긴 날짜 "YYYY-MM-DD"
  sourceUnit: string;            // 원문 금액 단위(예: 만원) — 상수는 원 단위로 환산해 적는다
  shareDecimals: number;         // 원문 비중의 소수 자리 — 표시는 toFixed(shareDecimals)로 끝 0을 지킨다
  boundary: "lower-inclusive" | "upper-inclusive"; // 원문 구간 표기: '이상~미만' / '초과~이하'
}

export interface HouseholdNetworthBracket {
  min: number | null;  // 원 단위 하한. null = 아래로 열린 끝(첫 구간)
  max: number | null;  // 원 단위 상한. null = 위로 열린 끝(마지막 구간)
  sharePct: number;    // 가구 비중(%) 공표값 그대로
  label?: string;      // 원문 표기를 그대로 써야 할 때만(음수 구간 등). 없으면 경계 금액에서 파생
}

export interface HouseholdNetworthStats {
  meta: HouseholdNetworthMeta | null;
  brackets: readonly HouseholdNetworthBracket[];
}

// 통계표 12 '순자산, 가구소득 분위별 평균, 점유율 및 경계값' 중 순자산 분위 경계값 2025년 열(P10~P90, 만원).
// 평균·점유율·2024년 열은 쓰지 않는다. 구간 = 분위 10개, 각 가구 10%. 원문에 이상·미만 표기가 없어
// 팀 규약으로 하한 포함(경계값은 위 구간)으로 둔다. 금액은 만원 × MAN(원 단위).
const P = [1210, 5108, 10296, 16472, 23860, 33050, 46180, 69380, 110020].map((m) => m * MAN); // P10~P90
export const HOUSEHOLD_NETWORTH_STATS: HouseholdNetworthStats = {
  meta: {
    surveyName: "가계금융복지조사",
    agencies: ["국가데이터처", "한국은행", "금융감독원"],
    surveyYear: 2025,
    referenceDate: null, // xlsx에 기준일 표기 없음 — KOSIS 통계설명자료로 확인되면 채운다
    tableSource: { name: "순자산 분위 경계값(2025년 열)", id: "통계표 12" },
    transcribedAt: "2026-11-14",
    sourceUnit: "만원",
    shareDecimals: 0,
    boundary: "lower-inclusive",
  },
  brackets: [null, ...P].map((min, i, a) => ({ min, max: i === a.length - 1 ? null : P[i], sharePct: 10 })),
};
