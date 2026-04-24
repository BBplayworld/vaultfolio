// 자산 관련 고정 선택 항목 공통 설정

// 증권사 목록 (주식담보대출용)
export const securitiesFirms = [
  {
    group: "대형 증권사",
    items: ["미래에셋증권", "삼성증권", "한국투자증권", "NH투자증권", "KB증권", "메리츠증권", "신한투자증권", "하나증권", "대신증권", "교보증권"],
  },
  {
    group: "온라인/기타",
    items: ["키움증권", "유안타증권", "이베스트투자증권", "카카오페이증권", "토스증권", "기타"],
  },
] as const;

// 금융기관 목록 (현금성 자산, 대출 공통)
export const financialInstitutions = [
  {
    group: "1금융권 (시중은행)",
    items: ["KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행", "KDB산업은행", "SC제일은행", "한국씨티은행"],
  },
  {
    group: "인터넷전문은행",
    items: ["카카오뱅크", "토스뱅크", "케이뱅크"],
  },
  {
    group: "지방은행",
    items: ["부산은행", "경남은행", "대구은행", "광주은행", "전북은행", "제주은행", "iM뱅크"],
  },
  {
    group: "2금융권",
    items: ["새마을금고", "신협", "수협", "우체국", "저축은행", "삼성생명", "한화생명", "교보생명"],
  },
  {
    group: "기타",
    items: ["기타"],
  },
] as const;

// 현금성 자산 유형
export const cashTypes = [
  { value: "deposit", label: "예금" },
  { value: "savings", label: "적금" },
  { value: "bank", label: "입출금 통장" },
  { value: "cma", label: "CMA" },
  { value: "cash", label: "실물 현금" },
] as const;

// 대출 종류
export const loanTypes = [
  { value: "credit", label: "신용대출", shortLabel: "신용대출" },
  { value: "minus", label: "마이너스대출", shortLabel: "마이너스" },
  { value: "mortgage-home", label: "주택담보대출", shortLabel: "주택담보" },
  { value: "mortgage-stock", label: "주식담보대출", shortLabel: "주식담보" },
  { value: "mortgage-insurance", label: "보험담보대출", shortLabel: "보험담보" },
  { value: "mortgage-deposit", label: "예금담보대출", shortLabel: "예금담보" },
  { value: "mortgage-other", label: "기타담보대출", shortLabel: "기타담보" },
  { value: "tenant", label: "임차보증금", shortLabel: "임차보증금" },
] as const;

// 대출 종류 표시 순서
export const loanTypeOrder = loanTypes.map((t) => t.value);

// 주식 카테고리
export const stockCategories = [
  { value: "domestic", label: "국내주식", shortLabel: "국내" },
  { value: "foreign", label: "해외주식", shortLabel: "해외" },
  { value: "irp", label: "IRP", shortLabel: "IRP" },
  { value: "isa", label: "ISA", shortLabel: "ISA" },
  { value: "pension", label: "연금저축펀드", shortLabel: "연금저축" },
  { value: "unlisted", label: "비상장주식", shortLabel: "비상장" },
] as const;

// 부동산 유형
export const realEstateTypes = [
  { value: "apartment", label: "아파트" },
  { value: "house", label: "주택" },
  { value: "land", label: "토지" },
  { value: "commercial", label: "상가" },
  { value: "other", label: "기타" },
] as const;

// 암호화폐 거래소 목록
export const cryptoExchanges = [
  { value: "upbit", label: "업비트" },
  { value: "bithumb", label: "빗썸" },
  { value: "coinone", label: "코인원" },
  { value: "korbit", label: "코빗" },
  { value: "binance", label: "바이낸스" },
  { value: "bybit", label: "바이비트" },
  { value: "okx", label: "OKX" },
  { value: "coinbase", label: "코인베이스" },
  { value: "kraken", label: "크라켄" },
  { value: "other", label: "기타" },
] as const;

// 주요 암호화폐 목록
export const popularCryptos = [
  { symbol: "BTC", name: "비트코인" },
  { symbol: "ETH", name: "이더리움" },
  { symbol: "XRP", name: "리플" },
  { symbol: "ADA", name: "카르다노" },
  { symbol: "SOL", name: "솔라나" },
  { symbol: "DOGE", name: "도지코인" },
  { symbol: "MATIC", name: "폴리곤" },
  { symbol: "DOT", name: "폴카닷" },
  { symbol: "AVAX", name: "아발란체" },
  { symbol: "LINK", name: "체인링크" },
  { symbol: "UNI", name: "유니스왑" },
  { symbol: "ATOM", name: "코스모스" },
  { symbol: "LTC", name: "라이트코인" },
  { symbol: "BCH", name: "비트코인캐시" },
  { symbol: "NEAR", name: "니어프로토콜" },
  { symbol: "APT", name: "앱토스" },
  { symbol: "ARB", name: "아비트럼" },
  { symbol: "OP", name: "옵티미즘" },
  { symbol: "SUI", name: "수이" },
  { symbol: "HBAR", name: "헤데라" },
  { symbol: "other", name: "직접 입력" },
] as const;

// 빠른 입력 버튼 프리셋
export const quickButtonPresets = {
  stock: [
    { label: "10만", value: 100000 },
    { label: "50만", value: 500000 },
    { label: "100만", value: 1000000 },
    { label: "500만", value: 5000000 },
  ],
  realEstate: [
    { label: "1천만", value: 10000000 },
    { label: "5천만", value: 50000000 },
    { label: "1억", value: 100000000 },
    { label: "5억", value: 500000000 },
  ],
  loanDefault: [
    { label: "100만", value: 1000000 },
    { label: "500만", value: 5000000 },
    { label: "1000만", value: 10000000 },
    { label: "5000만", value: 50000000 },
  ],
  loanMortgage: [
    { label: "500만", value: 5000000 },
    { label: "1000만", value: 10000000 },
    { label: "5000만", value: 50000000 },
    { label: "1억", value: 100000000 },
  ],
} as const;
