/**
 * "투자 유형 테스트" 인증카드 — X-Ray 분류(테마·지역·계좌유형·투자성향·통화·지수)를 숫자·금액
 * 없이 재미있는 유형 이름 + 세세한 설명(4~7문장, 포트폴리오가 다양할수록 길어짐) + 해시태그로
 * 압축한다. 축 5개(집중도·테마·지역·계좌·투자성향[stockType])의 조합이라 결과가 수천 종을
 * 훌쩍 넘고, 같은 포트폴리오는 항상 같은 결과가 나온다(결정적). 여기에 통화(원화/달러/엔화)·
 * 지수(코스피/나스닥100 등)·세부 테마·2위 종목명까지 문구에 녹여 디테일을 더한다 — 숫자·비율은
 * 계속 미노출, 이름·라벨 같은 텍스트 정보만 사용. 문구는 재미를 유지하되 종교·국가 상징 비유나
 * 반말 놀림조 표현은 배제한 성인 눈높이 톤을 쓴다.
 *
 * 문구 풀 작성 규칙(어휘를 늘릴 때 반드시 지킬 것):
 *  - 슬롯({theme}·{stock}·{stock2}·{index}·{account2}·{indexAccount}·{currency}) 바로 뒤에는
 *    받침 유무로 갈리는 조사(이/가·은/는·을/를·과/와·이면/면·으로/로)를 쓰지 않는다 — 종목명이
 *    모음·영문·숫자로 끝나면 비문이 된다. 도·까지·만큼·의·에·쉼표·명사 결합은 허용.
 *  - 모든 첫 문장 템플릿에는 {theme}(제목과 같은 themeNoun)를 포함해 제목·설명이 같은 인물을 가리키게 한다.
 *  - 한 문장은 되도록 30자 안팎 — 모바일 프리뷰(≈31자/줄)에서 줄바꿈이 잦아지지 않게.
 *  - 쪽지(해시태그) 항목은 공백 제거 후 9자 이하(3-3-1 배치 유지).
 *  - 테마 명사·모디파이어는 섹터/카테고리 전체에 맞는 상위 개념 어휘만 쓴다. 특정 기술·구현(라이다·GPU·배터리·채굴),
 *    사업모델(무인택시·뱅킹앱), 거래소·시장(코스피·본토·H주), 통화·계좌("해외=달러") 단정이나 다른 뜻으로 읽히는
 *    표현("지갑 수집가")은 금지 — 같은 섹터 안에서 종목마다 다를 수 있어 오해를 낳는다(예: 비전 기반 자율주행에 "라이다").
 *  - 어미("~는 편", "~스타일" 등)는 풀 안에서 고르게 분산하고, 조립 때 pickFilled가 직전 문장과 같은 어미를 건너뛴다.
 */

import type { Sector, StockType } from "./classification-store";
import type { ConcentrationLevel } from "./stock-xray";
import { hashString, pick } from "./seeded-pick";

export type RegionKey = "KR" | "US" | "JP" | "CN" | "HK" | "Other";
export type AccountKey = "domestic" | "foreign" | "pension_irp" | "isa" | "unlisted";

export interface InvestorAvatarSpec {
  themeKey: Sector;
  regionKey: RegionKey;
  accountKey: AccountKey;
  concentration: ConcentrationLevel; // 표정(눈) 결정 — investor-avatar.tsx
  stockTypeKey: StockType;           // 표정(입) 결정 — investor-avatar.tsx
}

export interface InvestorType {
  title: string;
  subtitle: string;
  description: string;
  highlightTerms: string[]; // description 안에서 강조할 실제 값(종목명·세부테마·지수명)
  tags: string[];
  avatar: InvestorAvatarSpec;
}

export interface ResolveInvestorTypeParams {
  themeKey: Sector;
  concentration: ConcentrationLevel;
  regionKey: RegionKey;
  accountKey: AccountKey;
  stockTypeKey: StockType;
  topStockName?: string;
  topCurrencyLabel: string;
  topIndexLabel?: string;
  subThemeLabel?: string;
  secondStockName?: string;
  secondAccountLabel?: string;
  topIndexAccountLabel?: string;
  krUsBalance?: KrUsBalance;
  /** 평가액 상위 종목(이름·티커) — 미국 배지의 빅테크 개별 종목 여부 판정용. */
  topHoldings?: TopHolding[];
}

export interface TopHolding {
  name: string;
  ticker?: string;
}

// 한국·미국 선호도 — 비율 자체는 노출하지 않고 질적 상태로만 문구화(§7-3).
export type KrUsBalance = "kr_only" | "us_only" | "kr_lead" | "us_lead" | "even";

const CONCENTRATION_MOD: Record<ConcentrationLevel, readonly string[]> = {
  high: ["집중형", "올인형", "한우물형", "외길형", "직진형", "송곳형", "돌직구형", "일편단심형"],
  medium: ["밸런스형", "균형형", "고루고루형", "안정감형", "적당히형", "중용형", "조화형", "황금비율형"],
  low: ["잡학형", "백화점형", "다채형", "뷔페형", "다다익선형", "취향부자형", "종합선물형", "팔방미인형"],
};

const THEME_NOUN: Record<Sector, readonly string[]> = {
  "AI 및 반도체": ["반도체 마니아", "칩셋 감별사", "AI 하드웨어 마니아", "칩 수집가", "칩 연금술사", "반도체 전도사", "반도체 탐험가", "실리콘 예찬가"],
  "AI 및 소프트웨어": ["코드 몽상가", "AI 얼리어답터", "소프트웨어 덕후", "알고리즘 탐험가", "소프트웨어 여행자", "AI 전도사", "데이터 연금술사", "코딩 낭만가"],
  "AI 인프라 및 전력": ["전력 인프라 마니아", "데이터센터 집사", "전기요 감별사", "인프라 탐방가", "전력 지킴이", "인프라 수집가", "전력 집사", "와트 감별사"],
  "로봇 및 산업 자동화": ["로봇 덕후", "자동화 예찬론자", "공장 자동화 집사", "로봇 수집가", "스마트팩토리 애호가", "로봇 관찰가", "자동화 지킴이", "정밀 제어 마니아"],
  "자율주행 및 모빌리티": ["자율주행 몽상가", "모빌리티 덕후", "미래차 얼리어답터", "자율주행 감별사", "모빌리티 탐험가", "미래 이동 예찬가", "드라이브 낭만가", "미래차 전도사"],
  "금융 및 핀테크": ["핀테크 애호가", "금융주 집사", "은행주 마니아", "금융 탐험가", "핀테크 관찰가", "핀테크 전도사", "금리 감별사", "금융 혁신 마니아"],
  "바이오 및 헬스케어": ["임상 관찰가", "신약 몽상가", "바이오 마니아", "바이오 탐험가", "헬스 탐험가", "헬스케어 감별사", "헬스케어 전도사", "생명 탐험가"],
  "소비재 및 유통": ["소비재 덕후", "유통주 애호가", "쇼핑몰 집사", "장바구니 수집가", "브랜드 감별사", "매대 관찰가", "리테일 마니아", "소비 트렌드 탐방가"],
  "인프라 및 물류": ["물류 마니아", "인프라 집사", "택배 애호가", "물류 관찰가", "운송 수집가", "물류 지킴이", "공급망 감별사", "인프라 예찬가"],
  "방산 및 우주항공": ["방산 덕후", "우주항공 몽상가", "로켓 마니아", "방산 감별사", "우주 탐험가", "방위산업 애호가", "항공 낭만가", "항공우주 전도사"],
  "블록체인 및 디지털자산": ["코인 마니아", "블록체인 얼리어답터", "디지털자산 덕후", "블록체인 탐험가", "코인 수집가", "탈중앙 전도사", "디지털자산 관찰가", "코인 낭만가"],
  "ETF/펀드": ["안전제일 인덱스러", "분산투자 예찬론자", "ETF 집사", "바구니 설계자", "시장 동행자", "ETF 전도사", "펀드 애호가", "분산 미학자"],
  기타: ["종잡을 수 없는 투자자", "장르불문 수집가", "정체불명 투자자", "취향 탐험가", "잡식성 수집가", "호기심 부자", "무한 탐색가", "장르 여행자"],
};

const REGION_MOD: Record<RegionKey, readonly string[]> = {
  KR: ["국내파", "동학개미", "K-투자자", "토종 투자자", "국내시장 지킴이", "국내증시 산책러", "홈그라운드파"],
  US: ["미국파", "서학개미", "월가 산책러", "미국주식 애호가", "미국시장 동행자", "미국증시 산책러"],
  JP: ["엔화 러버", "일본파", "니케이 마니아", "일본시장 관찰자", "도쿄증시 산책러", "일본주식 애호가", "도쿄마켓 탐험가"],
  CN: ["중국파", "차이나 관찰자", "위안화 투자자", "중국시장 탐험가", "중화권 관찰자", "차이나 산책러", "차이나마켓 러버"],
  HK: ["홍콩파", "항셍 마니아", "홍콩 직구러", "홍콩증시 산책러", "항셍 관찰자", "아시아허브 탐험가", "홍콩시장 탐험가"],
  Other: ["글로벌 노마드", "해외파", "세계여행 투자자", "지구촌 산책러", "글로벌 탐험가", "세계시장 여행자", "국경없는 투자자"],
};

// 미국 배지 조건부 풀 — 보유 구성에 어울릴 때만 후보에 합류(ETF 중심에 "빅테크 동행자"가 붙는 어색함 방지).
const US_BIGTECH_MOD = ["빅테크 동행자"] as const; // 개별 빅테크(MAG7) 종목 중심
const US_NASDAQ_MOD = ["기술주 동행자", "나스닥 러버"] as const; // 나스닥100 ETF 중심
const US_SP500_MOD = ["S&P 탐험가"] as const; // S&P500 ETF 중심
const MAG7_TICKERS = new Set(["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA"]);
const MAG7_NAMES = ["애플", "마이크로소프트", "알파벳", "구글", "아마존", "메타", "엔비디아", "테슬라"];
const isMag7 = (h: TopHolding) =>
  (h.ticker ? MAG7_TICKERS.has(h.ticker.toUpperCase()) : false) || MAG7_NAMES.some((n) => h.name.includes(n));

function regionPool(p: ResolveInvestorTypeParams): readonly string[] {
  const base = REGION_MOD[p.regionKey];
  if (p.regionKey !== "US") return base;
  const etfCentric = p.stockTypeKey === "지수투자" || p.themeKey === "ETF/펀드";
  const idx = p.topIndexLabel ?? "";
  if (etfCentric) {
    if (idx.includes("나스닥")) return [...base, ...US_NASDAQ_MOD];
    if (/S&P/i.test(idx)) return [...base, ...US_SP500_MOD];
    return base;
  }
  const top = (p.topHoldings ?? []).slice(0, 3);
  const mag = top.filter(isMag7).length;
  if (top.length > 0 && (isMag7(top[0]) || mag >= 2)) return [...base, ...US_BIGTECH_MOD, US_NASDAQ_MOD[1]];
  return base;
}

const ACCOUNT_MOD: Record<AccountKey, readonly string[]> = {
  domestic: ["국내계좌러", "일반계좌 애용자", "국내주식 본진", "국내계좌 집사", "증권사 단골", "국내주식 정착러", "일반계좌 장인"],
  foreign: ["해외직구러", "해외계좌 애용자", "서학개미 본진", "해외계좌 집사", "해외주식 단골", "직구계좌 장인", "글로벌계좌 애용자"],
  pension_irp: ["세액공제 헌터", "노후 지키미", "연금 만렙", "은퇴 설계자", "연금계좌 집사", "노후준비 모범생", "장기 플레이어"],
  isa: ["절세 만렙", "ISA 애용자", "비과세 헌터", "ISA 마스터", "절세계좌 집사", "비과세 수집가", "알뜰 절세러"],
  unlisted: ["비상장 헌터", "숨은 대어 사냥꾼", "장외시장 개척자", "장외 탐험가", "비상장 수집가", "숨은진주 탐색가", "원석 발굴러"],
};

// 첫 문장 — {theme}는 제목과 같은 themeNoun으로 치환(제목·설명이 같은 인물을 가리키도록).
const DESC_TEMPLATES: Record<ConcentrationLevel, readonly string[]> = {
  high: [
    "믿는 만큼 크게 베팅하는 편. {theme}에 대한 확신이 남다르다.",
    "한 번 꽂히면 끝까지 간다. {theme} 아니면 성에 안 찬다.",
    "계란을 한 바구니에 담았다. 그 바구니 이름은 {theme}.",
    "달걀 한 바구니 원칙? {theme}만큼은 예외다.",
    "돌다리 두들기던 신중함은 잠시 접어두고 {theme}에 올인.",
    "우물은 하나만 판다는 신조. 그 우물 이름은 {theme}.",
    "곁눈질은 사치라는 듯 {theme}만 바라본다.",
    "일편단심이라는 말이 어울린다. 마음도 계좌도 {theme} 쪽.",
    "확신이 서면 물러서지 않는 성격. 증거는 바로 {theme}.",
    "선택과 집중의 교과서 같은 구성. 주인공은 단연 {theme}.",
  ],
  medium: [
    "이것저것 담아도 중심은 잃지 않는 타입. {theme} 비중이 은근히 티난다.",
    "밸런스를 아는 편. 그래도 {theme} 취향은 못 숨긴다.",
    "고루고루 담았지만 마음 한 켠엔 항상 {theme}.",
    "모든 걸 골고루 챙기는 균형파. 시선은 자꾸 {theme} 쪽으로.",
    "계란을 여러 바구니에 나눠 담는 스타일. 그중 하나는 {theme}.",
    "급할수록 돌아가라는 말을 믿는 타입. 그 길에도 {theme}만큼은 꼭 들른다.",
    "천천히 넓게 담는 재미를 아는 스타일. 단골손님은 {theme}.",
    "분산과 취향 사이에서 줄타기 중. 저울은 살짝 {theme} 쪽으로.",
    "골고루 담아도 색깔은 은근히 분명하다. 포인트는 {theme}.",
    "한 가지에 몰빵하긴 조심스러운 성격. 그래도 {theme}엔 눈길이 머문다.",
  ],
  low: [
    "관심사가 매일 바뀌는 자유로운 스타일. 오늘은 {theme}, 내일은 또 다른 이야기.",
    "다양하게 담아보는 게 인생의 낙. {theme}도 그중 하나일 뿐.",
    "포트폴리오가 곧 취향 백과사전. {theme}도 그 안의 한 페이지.",
    "티끌 모아 태산의 정신으로 여기저기 담았다. {theme}도 그 티끌.",
    "호기심이 이끄는 대로 담은 컬렉션. {theme}도 여정의 한 정거장.",
    "구슬은 일단 넉넉히 모으는 중. 그중엔 {theme}도 있다.",
    "뷔페에서 접시를 채우듯 골고루 즐기는 타입. {theme}도 한 접시.",
    "여러 바구니에 나눠 담는 게 소신. {theme}도 그중 한 바구니.",
    "이것도 저것도 궁금한 탐험가 기질. {theme}도 지도 위 한 지점.",
    "취향이 넓은 만큼 계좌도 넓다. {theme}도 그 세계의 일부.",
  ],
};

// 투자 성향(stockType) 축 모디파이어 — 쪽지(해시태그)에 재노출.
const STOCK_TYPE_MOD: Record<StockType, readonly string[]> = {
  성장주: ["성장주 헌터", "고성장 추격자", "우상향 예찬론자", "성장스토리 수집가", "상승곡선 러버", "미래성장 탑승객", "우상향 탐험가"],
  혁신주: ["혁신주 탐험가", "미래기술 베팅러", "테크 몽상가", "게임체인저 사냥꾼", "혁신 스카우터", "신기술 개척자", "도전정신 만렙"],
  배당성장주: ["배당성장 알뜰러", "복리 재배자", "배당나무 집사", "배당 스노우볼러", "복리 농부", "성장배당 수집가", "배당새싹 재배자"],
  배당주: ["배당 애호가", "인컴 수집가", "현금흐름 집사", "배당금 수확러", "현금흐름 설계자", "통장 채우미", "배당달력 관리자"],
  지수투자: ["인덱서", "시장추종 스타일러", "분산투자 모범생", "시장 동행자", "지수 탑승객", "패시브 마스터", "ETF 적립러"],
  가치주: ["가치투자자", "저평가 헌터", "가치주 발굴러", "재무제표 탐정", "숨은원석 감별사", "안전마진 수집가", "저평가 탐정"],
  "채권/현금성": ["안전자산러", "현금 사수대", "변동성 회피자", "방파제 건축가", "안정제일 주의자", "현금 든든러", "마음편한 투자자"],
  기타: ["종잡을 수 없는 스타일", "잡식성 투자자", "자유로운 영혼", "장르 파괴자", "취향 혼합러", "컬렉션 수집가", "만능 잡식러"],
};

// stockType 축 — description 2번째 문장. {stock}은 대표 보유 종목명(숫자·비율 아닌 이름만이라
// "수치 미노출" 정책 위반 아님)으로 치환.
const STOCK_TYPE_DESC: Record<StockType, readonly string[]> = {
  성장주: [
    "요즘 제일 주목받는 성장주는 놓치지 않는 타입. 최근 에이스는 단연 {stock}.",
    "성장 스토리에 확신을 갖고 움직이는 편. 그 중심엔 단연 {stock}.",
    "우상향 흐름이 보이면 주저 없이 탑승. 지금 견인차는 {stock}.",
    "성장 곡선이 가파를수록 눈이 반짝인다. 요즘 원픽은 {stock}.",
    "미래 매출을 상상하는 게 취미. 상상의 주인공은 {stock}.",
    "올라타는 타이밍이 빠른 스타일. 이번 승차권은 {stock}.",
    "꿈이 큰 기업에 마음이 간다. 그 꿈의 대표 주자는 {stock}.",
    "성장 없인 매력 없다는 주의. 가장 믿는 동력은 {stock}.",
  ],
  혁신주: [
    "아직 증명되지 않은 미래에 과감히 베팅하는 편. {stock} 하나로 계좌가 롤러코스터.",
    "검증보다 가능성을 먼저 보는 스타일. {stock}의 성장을 지켜보는 중.",
    "리스크를 감수할 줄 아는 편. 이번엔 {stock}에 승부를 걸었다.",
    "아직 없는 시장을 먼저 사는 스타일. 요즘 선발대는 {stock}.",
    "기술이 세상을 바꾼다는 쪽에 베팅. 그 기술의 얼굴은 {stock}.",
    "불확실성을 기회로 보는 타입. 이번 기회의 이름은 {stock}.",
    "남들이 고개를 갸웃할 때 먼저 담는다. 요즘은 {stock}.",
    "미래를 앞당겨 사는 재미. 그 재미의 주인공은 {stock}.",
  ],
  배당성장주: [
    "배당도 늘고 주가도 오르는 걸 제일 좋아함. {stock}, 딱 그 표본이다.",
    "복리의 힘을 믿는 편. {stock} 배당 재투자가 낙.",
    "현금흐름도 성장도 놓치기 싫은 알뜰한 스타일. 최애는 {stock}.",
    "눈덩이처럼 불어나는 배당이 좋다. 그 핵심은 {stock}.",
    "배당은 받고 성장은 덤으로 챙기는 욕심쟁이. 대표는 {stock}.",
    "매년 오르는 배당 소식이 반가운 타입. 올해의 기대주는 {stock}.",
    "심어둔 배당나무가 무럭무럭 자라는 중. 제일 튼튼한 건 {stock}.",
    "복리 곡선을 지켜보는 게 힐링. 힐링 종목은 {stock}.",
  ],
  배당주: [
    "매달 들어오는 배당이 최고의 즐거움. {stock} 배당 소식에 웃음.",
    "시세보다 현금흐름을 우선하는 편. {stock}, 든든한 부업이나 다름없다.",
    "주가 등락엔 초연해도 배당은 꼭 챙긴다. 대표주자 {stock}.",
    "통장에 꽂히는 배당이 하루의 힘. 배당 담당은 {stock}.",
    "월급 말고 또 하나의 월급을 꿈꾸는 타입. 1순위 후보는 {stock}.",
    "주가보다 배당 달력을 먼저 보는 스타일. 달력 단골은 {stock}.",
    "현금이 들어오는 소리가 좋다. 그 소리의 주인공은 {stock}.",
    "느긋하게 받아 챙기는 배당 생활. 든든한 동반자는 {stock}.",
  ],
  지수투자: [
    "굳이 종목을 고르지 않아도 되는 여유를 아는 편. {stock} 하나로 시장 전체를 산다.",
    "시장을 이기려 애쓰지 않는 편. {stock} 하나면 충분하다.",
    "분산이 곧 전략. {stock} 하나로 마음 편히 버틴다.",
    "시장과 같이 걷는 게 가장 편하다. 동행 티켓은 {stock}.",
    "종목 고민은 시장에 맡기는 스타일. 대표 바구니는 {stock}.",
    "평균의 힘을 믿는 타입. 그 평균을 대표하는 건 {stock}.",
    "차트 걱정 없이 꾸준히 적립하는 재미. 적립 대상은 {stock}.",
    "시장 전체를 한 번에 담는 효율파. 효율의 상징은 {stock}.",
  ],
  가치주: [
    "저평가된 가치를 알아보는 데 진심. {stock}, 아직 시장이 몰라주는 원석이다.",
    "싸게 사서 오래 버티는 스타일. {stock} 매수가는 잊지 않는다.",
    "숫자를 꼼꼼히 뜯어보는 걸 즐기는 편. 최근 발굴은 {stock}.",
    "재무제표 읽는 시간이 즐겁다. 요즘 정독 중인 건 {stock}.",
    "가격보다 가치를 먼저 따지는 타입. 요즘 눈에 든 건 {stock}.",
    "안전마진이라는 말에 마음이 놓인다. 그 주인공은 {stock}.",
    "남들이 외면할 때 조용히 담는 스타일. 이번 후보는 {stock}.",
    "시간이 가치를 증명해 준다고 믿는다. 증명 대기 중인 {stock}.",
  ],
  "채권/현금성": [
    "변동성보다 안정을 우선하는 편. {stock} 비중으로 마음의 평화를 지킨다.",
    "쉬어가는 것도 전략이라는 주의. {stock}, 든든한 방파제 역할을 한다.",
    "리스크 관리가 최우선. {stock} 비중 덕분에 마음이 편하다.",
    "수익률보다 잠자리가 편한 게 우선. 잠자리 담당은 {stock}.",
    "폭풍이 와도 흔들리지 않게 준비 중. 방파제 이름은 {stock}.",
    "쉬어가는 자산도 실력이라 믿는다. 쉼터 담당은 {stock}.",
    "안정이 곧 수익이라는 지론. 지론의 근거는 {stock}.",
    "현금은 기회를 기다리는 대기석. 대기석 담당은 {stock}.",
  ],
  기타: [
    "한 가지 스타일로 정의되길 거부하는 편. {stock}도 그 다채로움의 일부.",
    "성향이 유연하게 바뀌는 투자자. {stock}, 요즘 가장 눈길이 가는 종목.",
    "장르를 넘나드는 폭넓은 투자. {stock}도 그 컬렉션 중 하나.",
    "딱 하나로 정의하기엔 취향이 넓다. 요즘 시선은 {stock}.",
    "이 종목 저 종목 넘나드는 자유인. 오늘의 픽은 {stock}.",
    "분류표를 벗어나는 재미가 있다. 그 재미 담당은 {stock}.",
    "유행보다 호기심이 먼저인 타입. 이번 호기심은 {stock}.",
    "스타일이 한 줄로 안 잡히는 투자. 그중 눈길 가는 건 {stock}.",
  ],
};

// topStockName이 없는 극단 케이스(mergedStocks 빈 상태 등)용 대체 문장 — {stock} 미포함.
const STOCK_TYPE_DESC_FALLBACK: Record<StockType, readonly string[]> = {
  성장주: ["요즘 주목받는 성장주는 놓치지 않는 타입.", "성장 스토리에 확신을 갖고 움직이는 스타일.", "우상향 흐름이 보이면 주저 없이 탑승한다."],
  혁신주: ["아직 증명되지 않은 미래에 과감히 베팅하는 편.", "검증보다 가능성을 먼저 보는 스타일.", "불확실성을 기회로 보는 타입."],
  배당성장주: ["배당도 늘고 주가도 오르는 걸 제일 좋아함.", "복리의 힘을 믿는 스타일.", "현금흐름도 성장도 놓치기 싫은 알뜰파."],
  배당주: ["매달 들어오는 배당이 최고의 즐거움.", "시세보다 현금흐름을 우선하는 스타일.", "주가 등락엔 초연해도 배당은 꼭 챙긴다."],
  지수투자: ["굳이 종목을 고르지 않아도 되는 여유를 아는 편.", "시장을 이기려 애쓰지 않는 스타일.", "분산이 곧 전략이라 믿는 타입."],
  가치주: ["저평가된 가치를 알아보는 데 진심.", "싸게 사서 오래 버티는 스타일.", "가격보다 가치를 먼저 따지는 타입."],
  "채권/현금성": ["변동성보다 안정을 우선하는 편.", "쉬어가는 것도 전략이라는 주의.", "리스크 관리가 최우선인 타입."],
  기타: ["한 가지 스타일로 정의되길 거부하는 편.", "성향이 유연하게 바뀌는 투자자.", "장르를 넘나드는 폭넓은 투자 스타일."],
};

// 계좌(accountKey) 축 — description 3번째 문장(마무리 코멘트). "최소 3문장" 보장용으로,
// subtitle에서만 쓰이던 accountKey를 description에도 반영해 새 풀 없이 콘텐츠를 채운다.
const ACCOUNT_DESC: Record<AccountKey, readonly string[]> = {
  domestic: [
    "계좌는 국내 하나로 심플하게 정리하는 편.",
    "국내 계좌 하나로 웬만한 건 다 해결하는 스타일.",
    "국내 증시 안에서 승부를 보는 편.",
    "국내 증시 한 곳에 깊이 정착한 타입.",
    "익숙한 국내 계좌에서 차분히 굴리는 스타일.",
    "홈그라운드 계좌 중심으로 안정감 있게 운용.",
    "국내 계좌 하나로 살림을 꾸리는 알뜰파.",
  ],
  foreign: [
    "해외 계좌까지 챙기는 걸 보면 준비된 투자자.",
    "국경을 넘나드는 계좌 운용이 익숙한 편.",
    "해외 계좌 관리도 능숙하게 해내는 타입.",
    "해외 증시 문턱이 낮은 글로벌 감각의 소유자.",
    "해외 계좌 앱이 홈 화면 첫 줄에 있을 것 같은 타입.",
    "해외 시장을 안방처럼 드나드는 스타일.",
    "국경 없는 계좌 운용이 일상이다.",
  ],
  pension_irp: [
    "연금·IRP까지 챙기는 걸 보면 노후 준비도 철저한 편.",
    "세제 혜택 계좌를 꼼꼼히 활용하는 알뜰한 스타일.",
    "은퇴 이후까지 내다보는 장기 플레이어.",
    "은퇴 이후의 나를 위해 미리 심어두는 스타일.",
    "세제 혜택까지 계산에 넣는 장기 설계자.",
    "연금 계좌에 꾸준히 물을 주는 타입.",
    "먼 미래를 위한 적금 같은 투자, 절대 잊지 않는다.",
  ],
  isa: [
    "ISA까지 활용하는 걸 보면 절세에도 밝은 편.",
    "비과세 혜택은 놓치지 않는 알뜰한 스타일.",
    "세금까지 계산하는 꼼꼼한 투자자.",
    "ISA 한도를 알뜰히 채워 나가는 스타일.",
    "세금 한 푼도 아까운 계산에 밝은 타입.",
    "비과세 혜택을 무기로 삼는 알뜰파.",
    "절세 계좌를 손에 익게 다루는 살림꾼.",
  ],
  unlisted: [
    "비상장 주식까지 담는 걸 보면 남다른 안목의 소유자.",
    "아직 알려지지 않은 기회를 먼저 찾아나서는 편.",
    "시장에 상장되기 전부터 눈여겨보는 타입.",
    "장외의 숨은 기회를 찾아 나서는 탐험가.",
    "이름이 알려지기 전에 먼저 알아보는 안목.",
    "비상장이라는 미지의 영역에도 발을 담근 타입.",
    "아직 시장에 없는 이야기를 먼저 읽는 스타일.",
  ],
};

// 통화 축 — description 4번째 문장(항상 포함). {currency}는 topCurrencyLabel 그대로 치환.
const CURRENCY_DESC: readonly string[] = [
  "환전은 걱정 없이, {currency} 자산 비중을 든든히 챙기는 편.",
  "{currency}로 꾸준히 사 모으는 재미를 아는 스타일.",
  "포트폴리오의 색깔은 확실히 {currency} 쪽으로 기운다.",
  "{currency} 자산이 계좌의 중심을 단단히 잡아준다.",
  "{currency} 자산이 든든한 뒷심이 되어준다.",
  "통화 분산보다 {currency} 집중이 마음 편한 스타일.",
  "{currency} 흐름에 촉이 밝은 타입.",
  "{currency} 중심으로 계좌를 짜는 스타일.",
  "지갑 속 주력 통화는 {currency}.",
  "{currency} 잔고가 든든해야 마음이 놓인다.",
  "주 무대는 {currency} 자산.",
  "자산의 무게중심은 {currency} 쪽에 있다.",
];

// 지수 축 — description 5번째 문장(topIndexLabel 있을 때만 포함). {index} 치환.
const INDEX_DESC: readonly string[] = [
  "패시브 투자도 챙기는 스타일. {index} 추종 상품도 든든히 담아뒀다.",
  "지수까지 아우르는 균형 감각. {index} 라인업도 빼놓지 않는다.",
  "개별 종목 승부만큼 {index} 같은 지수 투자도 즐기는 편.",
  "{index} 라인도 든든히 깔아뒀다.",
  "종목 승부 옆에 {index} 안전판도 나란히 뒀다.",
  "{index} 흐름은 놓치지 않고 챙기는 스타일.",
  "개별 종목과 {index} 사이에서 균형을 잡는 타입.",
  "든든한 바닥 역할은 {index} 담당.",
  "지수 투자의 기본기, {index}도 챙겼다.",
];

// 세부 테마 — sentence1(테마 문장) 뒤에 덧붙는 연결구. subThemeLabel 있을 때만. {subTheme} 치환.
const SUB_THEME_CONNECTOR: readonly string[] = [
  "그중에서도 {subTheme} 쪽에 특히 진심이다.",
  "특히 {subTheme} 분야에 마음이 가 있다.",
  "요즘 관심은 단연 {subTheme}.",
  "그중 {subTheme} 분야에서 눈이 반짝인다.",
  "관심의 초점은 {subTheme} 쪽에 맞춰져 있다.",
  "세부적으로는 {subTheme}에 애정이 깊다.",
  "특히 {subTheme}에는 시간을 아끼지 않는다.",
  "그 안에서도 최애 분야는 {subTheme}.",
];

// 2위 종목 — sentence2(투자성향 문장) 뒤에 덧붙는 연결구. secondStockName 있을 때만. {stock2} 치환.
const SECOND_STOCK_CONNECTOR: readonly string[] = [
  "{stock2}도 눈여겨보는 든든한 라인업.",
  "그 옆을 지키는 건 {stock2}.",
  "{stock2}까지 챙기며 포트폴리오를 다졌다.",
  "곁에는 든든한 조연 {stock2}.",
  "{stock2}도 빼놓을 수 없는 멤버.",
  "옆자리엔 {stock2} 자리도 마련했다.",
  "{stock2}도 나란히 담아 균형을 맞췄다.",
  "조연 자리는 {stock2}.",
];

// 2위 계좌 카테고리 — sentence3(계좌 문장) 뒤에 덧붙는 연결구. secondAccountLabel 있을 때만.
const SECOND_ACCOUNT_CONNECTOR: readonly string[] = [
  "{account2}도 함께 활용하는 알뜰한 스타일.",
  "{account2} 계좌도 꾸준히 챙기는 편.",
  "{account2}까지 병행하며 두루 관리한다.",
  "{account2}도 빼놓지 않고 알뜰히 굴린다.",
  "{account2} 쪽 관리도 소홀하지 않다.",
  "{account2}까지 넓게 살림을 펼쳤다.",
  "{account2}도 함께 돌보는 꼼꼼함.",
  "곁가지 계좌로 {account2}도 운용 중.",
];

// 지수×계좌 맥락 — sentence5(지수 문장) 뒤에 덧붙는 연결구. topIndexAccountLabel 있을 때만.
const INDEX_ACCOUNT_CONNECTOR: readonly string[] = [
  "그마저도 {indexAccount} 쪽으로 담아둔 비중이 크다.",
  "특히 {indexAccount} 쪽에서 채워가는 비중이 눈에 띈다.",
  "{indexAccount}도 활용해 알뜰하게 채워가는 중이다.",
  "그 지수 투자는 {indexAccount}에서 주로 이뤄진다.",
  "{indexAccount}에 지수를 차곡차곡 쌓는 중.",
  "지수 담당 계좌는 {indexAccount}.",
  "{indexAccount} 쪽에 지수 바구니를 크게 마련했다.",
  "지수는 주로 {indexAccount}에서 굴린다.",
];

// 한국·미국 선호도 — description 6번째 문장(krUsBalance 있을 때만).
const KR_US_BALANCE_DESC: Record<KrUsBalance, readonly string[]> = {
  kr_only: [
    "국내 주식에만 집중하는 국내파.",
    "해외보다는 국내 시장에 집중하는 편.",
    "국내 증시 안에서 승부를 보는 스타일.",
    "국내 증시 하나에 마음을 온전히 둔 스타일.",
    "홈 마켓에서만 승부하는 국내 집중형.",
    "바다 건너보다 집 앞 시장이 편한 타입.",
    "해외 눈길 없이 국내 한 우물을 판다.",
  ],
  us_only: [
    "미국 주식 위주로 포트폴리오를 꾸린 편.",
    "국내보다는 미국 시장을 더 신뢰하는 스타일.",
    "해외, 그중에서도 미국에 집중하는 편.",
    "미국 시장 하나에 온 신경을 쏟는 스타일.",
    "월가 흐름이 곧 하루 일과인 타입.",
    "시선이 태평양 건너에 고정돼 있다.",
    "국내 대신 미국 한 곳에 집중하는 노선.",
  ],
  kr_lead: [
    "국내 주식이 메인이고 미국 주식도 곁들이는 편.",
    "국내 비중이 더 크지만 미국 쪽도 놓치지 않는다.",
    "국내를 중심에 두고 미국까지 챙기는 스타일.",
    "국내를 홈으로 두고 미국을 원정 삼는 스타일.",
    "기본기는 국내, 응용은 미국.",
    "국내 비중을 든든히 두고 해외를 곁들인다.",
    "안방은 국내, 사랑방은 미국인 구성.",
  ],
  us_lead: [
    "미국 주식이 메인이고 국내 주식도 함께 챙기는 편.",
    "미국 비중이 더 크지만 국내 쪽도 놓치지 않는다.",
    "미국을 중심에 두고 국내까지 챙기는 스타일.",
    "미국을 홈으로 삼고 국내를 곁에 두는 스타일.",
    "기본기는 미국, 응용은 국내.",
    "미국 비중이 앞서고 국내가 뒤를 받친다.",
    "해외가 주연, 국내가 든든한 조연.",
  ],
  even: [
    "국내와 미국을 거의 반반으로 가져가는 밸런스파.",
    "국내·미국 어느 한쪽에 치우치지 않는 균형 잡힌 스타일.",
    "국내와 미국 사이에서 고민 없이 둘 다 담는 편.",
    "국내와 미국이 시소처럼 균형을 이룬다.",
    "양쪽 시장 모두에 발을 걸친 균형 감각.",
    "국내도 미국도 놓치기 싫은 욕심쟁이 구성.",
    "두 시장을 똑같이 아끼는 공평한 스타일.",
  ],
};

// 문장 간 연결어 — 각 축 문장이 뚝뚝 끊긴 개별 항목처럼 보이지 않도록 접속부사만 앞에 붙인다.
// 어미를 활용형으로 바꿔 억지로 한 문장으로 합치지 않는다(예: "~다"→"~며" 변환은 불규칙 활용
// 조합에서 비문이 되기 쉬움) — 완결문은 그대로 두고 흐름만 연결하는 안전한 방식.
const FLOW_CONNECTOR_MID: readonly string[] = [
  "게다가 ", "동시에 ", "여기에 ", "더불어 ", "이와 함께 ", "덧붙이면 ", "그러면서 ",
  "한편, ", "또한 ", "그리고 ", "거기에 더해 ", "아울러 ", "이어서 ", "한 걸음 더 나아가 ", "덧붙여 ", "그 밖에도 ",
];
// 설명을 마무리하는 문장(존재하는 것 중 가장 마지막) 앞에 붙어 "종합 정리" 인상을 준다.
const FLOW_CONNECTOR_CLOSING: readonly string[] = [
  "종합하면, ", "전체적으로 보면, ", "정리하자면, ", "한마디로, ", "결론적으로, ", "한 줄 요약하면, ", "돌아보면, ", "마무리하자면, ",
];

// 쪽지(해시태그) 통화·지수 표기 — 공백 제거 후 9자 이하만 사용(3-3-1 배치 유지).
const CURRENCY_TAG_FORMS: readonly string[] = ["{c}파", "{c} 러버", "{c} 사수대", "{c} 수집가", "{c} 집사"];
const INDEX_TAG_FORMS: readonly string[] = ["{i}추종러", "{i} 러버", "{i} 탑승객", "{i} 마니아", "{i} 동행자"];
const TAG_MAX_LEN = 9;

// 어미 키 — 문장 끝 어절(마침표 제거). "~는 편." → "편", "~스타일." → "스타일".
function endingKey(text: string): string {
  return text.trim().replace(/[.!?…]+$/u, "").split(/\s+/).pop() ?? "";
}

// seed 기반 결정적 선택 + 직전 문장과 같은 어미를 가진 후보는 건너뛴다(어미 반복 방지).
// fill은 슬롯 치환 함수 — 치환 결과 기준으로 어미를 비교한다. 모두 같으면 시작 후보를 그대로 쓴다.
function pickFilled(pool: readonly string[], seed: string, fill: (t: string) => string, avoid: string): string {
  const start = hashString(seed) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const text = fill(pool[(start + i) % pool.length]);
    if (endingKey(text) !== avoid) return text;
  }
  return fill(pool[start]);
}

// 쪽지 표기 후보 중 공백 제거 후 TAG_MAX_LEN 이하만 seed로 고른다(없으면 undefined).
function pickTag(forms: readonly string[], seed: string, fill: (f: string) => string): string | undefined {
  const fit = forms.map(fill).filter((t) => t.replace(/\s+/g, "").length <= TAG_MAX_LEN);
  return fit.length > 0 ? pick(fit, seed) : undefined;
}

/** 숫자·금액·비율 없이 유형 이름 + 세세한 설명 + 해시태그 + 아바타 스펙만 반환 — 완전 결정적. */
export function resolveInvestorType(params: ResolveInvestorTypeParams): InvestorType {
  const {
    themeKey, concentration, regionKey, accountKey, stockTypeKey, topStockName,
    topCurrencyLabel, topIndexLabel, subThemeLabel, secondStockName,
    secondAccountLabel, topIndexAccountLabel, krUsBalance,
  } = params;
  // 대표 종목명을 seed에 포함 — 같은 5축 범주 조합이라도 실제 보유 종목이 다르면 단어 선택이
  // 갈리도록(체감 개인화 강화). 같은 포트폴리오는 topStockName도 항상 같으므로 결정성은 유지.
  const seed = `${themeKey}|${concentration}|${regionKey}|${accountKey}|${stockTypeKey}|${topStockName?.trim() ?? ""}`;

  const concentrationMod = pick(CONCENTRATION_MOD[concentration], `c:${seed}`);
  const themeNoun = pick(THEME_NOUN[themeKey], `t:${seed}`);
  const regionMod = pick(regionPool(params), `r:${seed}`);
  const accountMod = pick(ACCOUNT_MOD[accountKey], `a:${seed}`);
  const stockTypeMod = pick(STOCK_TYPE_MOD[stockTypeKey], `st:${seed}`);

  // 슬롯 치환은 함수 replacer로 — 종목명에 "$&" 같은 특수 패턴이 있어도 그대로 들어가도록.
  const fillWith = (slot: string, value: string) => (t: string) => t.replace(slot, () => value);

  // 문장 조립 순서대로 직전 조각의 어미를 추적해, 다음 조각이 같은 어미("는 편" 등)로 끝나면 건너뛴다.
  let prevEnding = "";
  const take = (pool: readonly string[], key: string, fill: (t: string) => string = (t) => t): string => {
    const text = pickFilled(pool, `${key}:${seed}`, fill, prevEnding);
    prevEnding = endingKey(text);
    return text;
  };

  // title과 동일한 themeNoun을 재사용 — title이 부른 "그 사람"을 설명 첫 문장도 같은 이름으로
  // 지칭해야 하나로 종합된 인물처럼 읽힌다(독립 pick으로 다른 동의어가 나오면 제목·설명이
  // 서로 다른 사람을 말하는 것처럼 어긋나 보였음).
  const sentence1 = take(DESC_TEMPLATES[concentration], "d", fillWith("{theme}", themeNoun))
    + (subThemeLabel ? ` ${take(SUB_THEME_CONNECTOR, "sub", fillWith("{subTheme}", subThemeLabel))}` : "");

  const trimmedStock = topStockName?.trim();
  const sentence2Base = trimmedStock
    ? take(STOCK_TYPE_DESC[stockTypeKey], "st2", fillWith("{stock}", trimmedStock))
    : take(STOCK_TYPE_DESC_FALLBACK[stockTypeKey], "st2");
  // sentence2는 뒤에 항상 sentence3~4가 이어지므로 마지막 문장이 될 일이 없어 항상 MID 연결어.
  const sentence2 = `${pick(FLOW_CONNECTOR_MID, `f2:${seed}`)}${sentence2Base}`
    + (secondStockName ? ` ${take(SECOND_STOCK_CONNECTOR, "st3", fillWith("{stock2}", secondStockName))}` : "");

  const sentence3 = `${pick(FLOW_CONNECTOR_MID, `f3:${seed}`)}${take(ACCOUNT_DESC[accountKey], "pa")}`
    + (secondAccountLabel ? ` ${take(SECOND_ACCOUNT_CONNECTOR, "sa", fillWith("{account2}", secondAccountLabel))}` : "");

  // 마지막 문장 판정 — krUsBalance 있으면 sentence6이 마지막, 없고 지수 있으면 sentence5,
  // 둘 다 없으면 sentence4(항상 존재)가 마지막. 마지막 문장에만 "종합하면" 류를 붙인다.
  const isSentence4Last = !topIndexLabel && !krUsBalance;
  const isSentence5Last = Boolean(topIndexLabel) && !krUsBalance;

  const sentence4 = `${isSentence4Last ? pick(FLOW_CONNECTOR_CLOSING, `f4:${seed}`) : pick(FLOW_CONNECTOR_MID, `f4:${seed}`)}`
    + take(CURRENCY_DESC, "cur", fillWith("{currency}", topCurrencyLabel));

  const sentence5 = topIndexLabel
    ? `${isSentence5Last ? pick(FLOW_CONNECTOR_CLOSING, `f5:${seed}`) : pick(FLOW_CONNECTOR_MID, `f5:${seed}`)}`
      + take(INDEX_DESC, "idx", fillWith("{index}", topIndexLabel))
      + (topIndexAccountLabel ? ` ${take(INDEX_ACCOUNT_CONNECTOR, "ia", fillWith("{indexAccount}", topIndexAccountLabel))}` : "")
    : undefined;

  const sentence6 = krUsBalance
    ? `${pick(FLOW_CONNECTOR_CLOSING, `f6:${seed}`)}${take(KR_US_BALANCE_DESC[krUsBalance], "kru")}`
    : undefined;

  // 쪽지 통화·지수 표기 — 통화는 괄호 표기("달러 (USD)")를 떼고 짧게, 지수는 9자 넘으면 후보에서 제외.
  const currencyBase = topCurrencyLabel.replace(/\s*[(（][^)）]*[)）]\s*/gu, "").trim() || topCurrencyLabel;
  const currencyTag = pickTag(CURRENCY_TAG_FORMS, `ct:${seed}`, fillWith("{c}", currencyBase));
  const indexTag = topIndexLabel ? pickTag(INDEX_TAG_FORMS, `it:${seed}`, fillWith("{i}", topIndexLabel)) : undefined;

  // description에 실제로 치환된 값(종목명·세부테마·지수명)만 강조 대상으로 노출.
  // 통화·계좌 라벨("달러"/"IRP")은 카테고리성 단어라 제외 — 종목처럼 "특정" 정보에 집중.
  const highlightTerms = Array.from(
    new Set([trimmedStock, secondStockName, subThemeLabel, topIndexLabel].filter((v): v is string => Boolean(v))),
  );

  return {
    title: `${concentrationMod} ${themeNoun}`,
    subtitle: `${regionMod} · ${accountMod}`,
    description: [sentence1, sentence2, sentence3, sentence4, sentence5, sentence6].filter(Boolean).join(" "),
    highlightTerms,
    // title·subtitle 구성요소 + 투자성향·통화·지수 모디파이어를 해시태그로 재노출(별도 풀 없이 재사용).
    tags: [concentrationMod, themeNoun, regionMod, accountMod, stockTypeMod, currencyTag, indexTag]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.replace(/\s+/g, "")),
    avatar: { themeKey, regionKey, accountKey, concentration, stockTypeKey },
  };
}
