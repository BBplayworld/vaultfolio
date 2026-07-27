// 세금 신고·납부 월별 일정 (S-4.23)
// 정적 상수만 둔다. 개인화 판정·집계는 lib/tax-utils.ts 소관.
// 세법 개정 시 기한이 바뀔 수 있어 연 1회 수동 점검 대상(자동 갱신 수단 없음 — 의도적).

// 자산 보유 상태와 세금 항목을 잇는 태그.
// "common"만 자산과 무관한 전 국민 공통 항목 — 홈 배너 노출 대상에서 제외된다.
export type TaxTag =
  | "common"      // 전 국민 (연말정산·건강보험료 정산)
  | "business"    // 사업자 (상가·사무실 보유로 추정)
  | "realestate"  // 부동산 보유
  | "stock"       // 국내주식 보유
  | "foreign"     // 해외주식(외화 종목) 보유
  | "pension"     // IRP·ISA·연금저축
  | "cash"        // 예적금·CMA (이자소득)
  | "loan";       // 담보대출 (이자상환액 소득공제)

export interface TaxEvent {
  id: string;
  month: number;               // 1~12
  dueLabel: string;            // "~1/25", "12/1~12/15"
  title: string;
  who: string;                 // 대상자
  summary: string;             // 한 줄 (홈 배너용)
  detail: string;              // 상세 (캘린더 뷰 펼침)
  tags: readonly TaxTag[];
  severity: "high" | "normal"; // high=신고·납부 의무 / normal=참고·기준일
  upcoming?: true;             // 시행 예정 (아직 과세되지 않음)
}

export const TAX_TAG_LABEL: Record<TaxTag, string> = {
  common:     "공통",
  business:   "사업자·상가",
  realestate: "부동산",
  stock:      "국내주식",
  foreign:    "해외주식",
  pension:    "연금계좌",
  cash:       "예적금",
  loan:       "담보대출",
};

export const TAX_EVENTS: readonly TaxEvent[] = [
  // ── 1월 ──
  {
    id: "vat-2h-final",
    month: 1,
    dueLabel: "~1/25",
    title: "부가가치세 2기 확정신고·납부",
    who: "개인 일반과세자 · 간이과세자",
    summary: "작년 하반기(7~12월) 매출·매입에 대한 부가세를 신고·납부합니다.",
    detail:
      "일반과세자는 직전 반기(7/1~12/31)분을 신고합니다. 간이과세자는 이달에 직전 1년치(1/1~12/31)를 한 번에 신고합니다. 세금계산서·현금영수증·카드 매출 자료를 홈택스에서 조회해 매입세액 공제를 빠뜨리지 않는 것이 핵심입니다.",
    tags: ["business"],
    severity: "high",
  },

  // ── 2월 ──
  {
    id: "year-end-settlement",
    month: 2,
    dueLabel: "2월 급여",
    title: "연말정산 (2월 급여 반영)",
    who: "근로소득자",
    summary: "작년 소득·공제를 정산해 2월 급여에서 환급 또는 추가 징수됩니다.",
    detail:
      "1월에 제출한 공제 자료를 바탕으로 정산 결과가 2월 급여에 반영됩니다. 연금저축·IRP 납입액, 담보대출 이자상환액, 주택청약저축은 대표적인 공제 항목이니 누락 여부를 확인하세요. 놓친 공제는 5월 종합소득세 확정신고로 추가 반영할 수 있습니다.",
    tags: ["common", "pension", "loan"],
    severity: "high",
  },
  {
    id: "biz-status-report",
    month: 2,
    dueLabel: "~2/10",
    title: "사업장현황신고",
    who: "면세사업자",
    summary: "부가세 면세사업자가 직전 연도 수입금액을 신고합니다.",
    detail:
      "부가가치세 납세의무가 없는 면세사업자(병·의원, 학원, 주택임대 등)는 부가세 신고 대신 사업장현황신고를 합니다. 여기서 신고한 수입금액이 5월 종합소득세 신고의 기초 자료가 됩니다.",
    tags: ["business"],
    severity: "normal",
  },
  {
    id: "stock-major-2h-prelim",
    month: 2,
    dueLabel: "~2/28",
    title: "국내 상장주식 양도세 예정신고 (전년 하반기분)",
    who: "국내 상장주식 대주주",
    summary: "작년 7~12월 양도분을 예정신고합니다.",
    detail:
      "국내 상장주식은 대주주 요건(종목별 지분율 또는 보유액 기준)에 해당할 때만 양도소득세가 과세됩니다. 반기별로 나눠 예정신고하며, 하반기 양도분은 다음 해 2월 말까지입니다. 소액주주는 해당 없습니다.",
    tags: ["stock"],
    severity: "normal",
  },

  // ── 3월 ──
  {
    id: "corporate-tax",
    month: 3,
    dueLabel: "~3/31",
    title: "법인세 신고·납부",
    who: "12월 결산 법인",
    summary: "직전 사업연도 법인세를 신고·납부합니다.",
    detail:
      "12월 결산 법인은 사업연도 종료일이 속한 달의 말일부터 3개월 이내에 신고합니다. 개인사업자는 해당 없으며 5월 종합소득세로 신고합니다.",
    tags: ["business"],
    severity: "normal",
  },

  // ── 4월 ──
  {
    id: "health-insurance-settlement",
    month: 4,
    dueLabel: "4월분 급여",
    title: "건강보험료 정산분 부과",
    who: "직장가입자",
    summary: "작년 실제 보수 기준으로 정산해 4월분 보험료에 추가 부과·환급됩니다.",
    detail:
      "건강보험료는 전년도 보수를 기준으로 매월 부과하다가, 확정된 작년 보수총액과 대조해 4월에 한 번에 정산합니다. 작년에 급여가 올랐다면 추가 납부가 발생하니 4월 급여 실수령액이 줄어드는 것을 미리 감안하세요. 분할납부 신청도 가능합니다.",
    tags: ["common"],
    severity: "high",
  },
  {
    id: "vat-1h-prelim-notice",
    month: 4,
    dueLabel: "~4/25",
    title: "부가가치세 1기 예정고지 납부",
    who: "개인 일반과세자",
    summary: "직전 확정신고 세액의 1/2을 고지받아 납부합니다.",
    detail:
      "개인 일반과세자는 예정신고 대신 세무서가 계산한 예정고지서(직전 과세기간 납부세액의 50%)를 받아 납부합니다. 사업이 부진해 실적이 크게 줄었다면 예정신고로 전환해 실제 실적 기준으로 낼 수 있습니다.",
    tags: ["business"],
    severity: "normal",
  },

  // ── 5월 ──
  {
    id: "income-tax-final",
    month: 5,
    dueLabel: "~5/31",
    title: "종합소득세·지방소득세 확정신고·납부",
    who: "사업·임대·금융·기타소득이 있는 개인",
    summary: "작년 한 해 모든 종합소득을 합산해 신고·납부합니다.",
    detail:
      "사업소득(상가·사무실 임대 포함), 부동산 임대소득, 이자·배당 등 금융소득이 연 2,000만원을 초과하면 종합과세 대상이 되어 이달에 합산 신고합니다. 근로소득자도 연말정산에서 빠뜨린 공제가 있으면 여기서 추가할 수 있습니다. 지방소득세(소득세의 10%)도 함께 신고합니다.",
    tags: ["common", "business", "realestate", "stock", "cash"],
    severity: "high",
  },
  {
    id: "capital-gains-final",
    month: 5,
    dueLabel: "~5/31",
    title: "양도소득세 확정신고 (해외주식·비상장 등)",
    who: "작년 해외주식·비상장주식 양도차익이 있는 개인",
    summary: "작년 실현 차익에서 기본공제 250만원을 뺀 금액에 22%가 과세됩니다.",
    detail:
      "해외주식은 대주주 여부와 무관하게 양도차익 전부가 과세 대상입니다. 연간 실현손익을 통산한 뒤 기본공제 250만원을 차감하고 22%(지방소득세 포함)를 냅니다. 손실 종목을 연내에 함께 실현하면 통산되어 세액이 줄어듭니다. 취득가·양도가는 각 결제일 기준 환율로 원화 환산합니다.",
    tags: ["foreign", "stock"],
    severity: "high",
  },

  // ── 6월 ──
  {
    id: "property-tax-base-date",
    month: 6,
    dueLabel: "6/1",
    title: "재산세·종합부동산세 과세기준일",
    who: "부동산 보유자",
    summary: "6월 1일 소유자가 그 해 재산세·종부세를 전부 부담합니다.",
    detail:
      "하루 차이로 1년치 보유세 부담자가 갈립니다. 파는 쪽은 5월 31일까지 잔금을 받으면 그 해 보유세를 내지 않고, 사는 쪽은 6월 2일 이후에 잔금을 치르면 그 해 보유세를 피합니다. 매매 일정이 이 시기와 겹친다면 잔금일을 먼저 확인하세요.",
    tags: ["realestate"],
    severity: "high",
  },

  // ── 7월 ──
  {
    id: "vat-1h-final",
    month: 7,
    dueLabel: "~7/25",
    title: "부가가치세 1기 확정신고·납부",
    who: "개인 일반과세자",
    summary: "올해 상반기(1~6월) 매출·매입에 대한 부가세를 신고·납부합니다.",
    detail:
      "1/1~6/30 실적을 신고하며, 4월에 낸 예정고지세액은 여기서 차감됩니다. 상가 임대사업자는 임대료 세금계산서 발급분이 그대로 매출로 잡히므로 미발급·지연발급 가산세에 유의하세요.",
    tags: ["business"],
    severity: "high",
  },
  {
    id: "property-tax-1st",
    month: 7,
    dueLabel: "~7/31",
    title: "재산세 1기분 납부",
    who: "부동산 보유자",
    summary: "주택분의 1/2과 건축물(상가·사무실) 재산세를 납부합니다.",
    detail:
      "주택 재산세는 7월과 9월에 절반씩 나눠 부과되며, 건축물(상가·오피스텔 등 주택 외 건물)분은 7월에 전액 부과됩니다. 주택분 세액이 20만원 이하면 7월에 한 번에 부과됩니다.",
    tags: ["realestate"],
    severity: "high",
  },

  // ── 8월 ──
  {
    id: "resident-tax-business",
    month: 8,
    dueLabel: "~8/31",
    title: "주민세 사업소분 납부",
    who: "사업장을 둔 사업자",
    summary: "사업장 면적·소재지 기준으로 부과되는 지방세입니다.",
    detail:
      "매년 7월 1일 기준으로 사업장을 둔 사업자에게 부과됩니다. 기본세액에 더해 사업장 연면적이 330㎡를 초과하면 면적분이 추가됩니다.",
    tags: ["business"],
    severity: "normal",
  },
  {
    id: "stock-major-1h-prelim",
    month: 8,
    dueLabel: "~8/31",
    title: "국내 상장주식 양도세 예정신고 (상반기분)",
    who: "국내 상장주식 대주주",
    summary: "올해 1~6월 양도분을 예정신고합니다.",
    detail:
      "상반기(1/1~6/30) 양도분은 그 해 8월 말까지 예정신고합니다. 대주주 요건에 해당하지 않는 소액주주는 신고 의무가 없습니다.",
    tags: ["stock"],
    severity: "normal",
  },

  // ── 9월 ──
  {
    id: "property-tax-2nd",
    month: 9,
    dueLabel: "~9/30",
    title: "재산세 2기분 납부",
    who: "부동산 보유자",
    summary: "주택분의 나머지 1/2과 토지분 재산세를 납부합니다.",
    detail:
      "7월에 절반을 낸 주택 재산세의 나머지와, 토지분 재산세가 이달에 부과됩니다. 나대지·상가 부속토지를 보유했다면 토지분이 여기서 나옵니다.",
    tags: ["realestate"],
    severity: "high",
  },

  // ── 10월 ──
  {
    id: "vat-2h-prelim-notice",
    month: 10,
    dueLabel: "~10/25",
    title: "부가가치세 2기 예정고지 납부",
    who: "개인 일반과세자",
    summary: "7월 확정신고 세액의 1/2을 고지받아 납부합니다.",
    detail:
      "1기 확정신고 납부세액의 50%가 예정고지됩니다. 이 금액은 다음 해 1월 확정신고에서 기납부세액으로 공제됩니다.",
    tags: ["business"],
    severity: "normal",
  },

  // ── 11월 ──
  {
    id: "income-tax-interim",
    month: 11,
    dueLabel: "~11/30",
    title: "종합소득세 중간예납",
    who: "직전 연도 종합소득세 납부실적이 있는 개인",
    summary: "작년 낸 종합소득세의 1/2을 미리 납부합니다.",
    detail:
      "5월에 낸 종합소득세 세액의 절반이 고지됩니다. 올해 소득이 작년보다 크게 줄었다면 중간예납 추계액 신고로 실제 실적 기준으로 낮춰 낼 수 있습니다. 납부한 금액은 다음 해 5월 확정신고에서 공제됩니다.",
    tags: ["common", "business", "realestate"],
    severity: "high",
  },

  // ── 12월 ──
  {
    id: "comprehensive-property-tax",
    month: 12,
    dueLabel: "12/1~12/15",
    title: "종합부동산세 신고·납부",
    who: "고가·다주택 부동산 보유자",
    summary: "공시가격 합계가 공제 기준을 넘는 보유자에게 부과됩니다.",
    detail:
      "6월 1일 기준 보유 부동산의 공시가격을 합산해 공제액(1세대 1주택자는 더 높은 공제)을 초과하는 분에 과세합니다. 재산세와 이중과세되지 않도록 기납부 재산세는 공제됩니다. 세액이 크면 분납 신청도 가능합니다.",
    tags: ["realestate"],
    severity: "high",
  },
  {
    id: "pension-contribution-deadline",
    month: 12,
    dueLabel: "~12/31",
    title: "연금저축·IRP 세액공제 납입 마감",
    who: "연금저축·IRP 가입자",
    summary: "올해 세액공제를 받으려면 12월 31일까지 납입해야 합니다.",
    detail:
      "연금저축은 연 600만원, IRP를 합산하면 연 900만원까지 납입액의 13.2%(총급여 5,500만원 이하는 16.5%)를 세액공제받습니다. 12월 31일이 지나면 그 해 공제는 불가능하니 한도 미달분이 있으면 연내에 채우세요.",
    tags: ["pension"],
    severity: "high",
  },
  {
    id: "stock-major-base-date",
    month: 12,
    dueLabel: "12/31",
    title: "국내주식 대주주 판정 기준일",
    who: "국내 상장주식 보유자",
    summary: "사업연도 종료일 보유분으로 다음 해 대주주 여부가 결정됩니다.",
    detail:
      "12월 결산법인은 12월 31일(폐장일) 기준 보유 지분율·평가액으로 대주주 여부를 판정하며, 여기에 해당하면 다음 해 양도분부터 양도소득세가 과세됩니다. 특정 종목 비중이 크다면 연말 보유량을 미리 점검하세요.",
    tags: ["stock"],
    severity: "normal",
  },
  {
    id: "crypto-tax-upcoming",
    month: 12,
    dueLabel: "시행 예정",
    title: "가상자산 소득 과세 (시행 예정)",
    who: "가상자산 보유자",
    summary: "아직 시행 전이며, 시행되면 기본공제 초과분이 기타소득으로 과세됩니다.",
    detail:
      "가상자산 양도·대여 소득에 대한 과세는 여러 차례 유예되어 아직 시행되지 않았습니다. 시행 시에는 연간 소득에서 기본공제를 뺀 금액에 분리과세되며, 취득가액 입증을 위해 거래소 거래내역을 미리 보관해 두는 것이 좋습니다. 시행 시기·세율은 확정 시 확인이 필요합니다.",
    tags: ["common"],
    severity: "normal",
    upcoming: true,
  },
];

// 월별 조회용 파생 상수 (1~12 인덱스, 0번은 비움)
export const TAX_EVENTS_BY_MONTH: readonly (readonly TaxEvent[])[] = Array.from(
  { length: 13 },
  (_, m) => (m === 0 ? [] : TAX_EVENTS.filter((e) => e.month === m)),
);

// 해외주식 양도소득 기본공제 (원) — 홈 배너·캘린더의 신고 대상 판정 기준
export const FOREIGN_CAPITAL_GAIN_DEDUCTION = 2_500_000;
