/**
 * "투자 유형 테스트" 인증카드 — X-Ray 분류(테마·지역·계좌유형·투자성향·통화·지수)를 숫자·금액
 * 없이 재미있는 유형 이름 + 세세한 설명(4~7문장, 포트폴리오가 다양할수록 길어짐) + 해시태그로
 * 압축한다. 축 5개(집중도·테마·지역·계좌·투자성향[stockType])의 조합이라 결과가 수천 종을
 * 훌쩍 넘고, 같은 포트폴리오는 항상 같은 결과가 나온다(결정적). 여기에 통화(원화/달러/엔화)·
 * 지수(코스피/나스닥100 등)·세부 테마·2위 종목명까지 문구에 녹여 디테일을 더한다 — 숫자·비율은
 * 계속 미노출, 이름·라벨 같은 텍스트 정보만 사용. 문구는 재미를 유지하되 종교·국가 상징 비유나
 * 반말 놀림조 표현은 배제한 성인 눈높이 톤을 쓴다.
 */

import type { Sector, StockType } from "./classification-store";
import type { ConcentrationLevel } from "./stock-xray";
import { pick } from "./seeded-pick";

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
}

// 한국·미국 선호도 — 비율 자체는 노출하지 않고 질적 상태로만 문구화(§7-3).
export type KrUsBalance = "kr_only" | "us_only" | "kr_lead" | "us_lead" | "even";

const CONCENTRATION_MOD: Record<ConcentrationLevel, readonly string[]> = {
  high: ["집중형", "올인형", "한우물형"],
  medium: ["밸런스형", "균형형", "고루고루형"],
  low: ["잡학형", "백화점형", "다채형"],
};

const THEME_NOUN: Record<Sector, readonly string[]> = {
  "AI 및 반도체": ["반도체 마니아", "칩셋 감별사", "AI 하드웨어 마니아"],
  "AI 및 소프트웨어": ["코드 몽상가", "AI 얼리어답터", "소프트웨어 덕후"],
  "AI 인프라 및 전력": ["전력 인프라 마니아", "데이터센터 집사", "전기요 감별사"],
  "로봇 및 산업 자동화": ["로봇 덕후", "자동화 예찬론자", "공장 자동화 집사"],
  "자율주행 및 모빌리티": ["자율주행 몽상가", "모빌리티 덕후", "전기차 얼리어답터"],
  "금융 및 핀테크": ["핀테크 애호가", "금융주 집사", "은행주 마니아"],
  "바이오 및 헬스케어": ["임상 관찰가", "신약 몽상가", "바이오 마니아"],
  "소비재 및 유통": ["소비재 덕후", "유통주 애호가", "쇼핑몰 집사"],
  "인프라 및 물류": ["물류 마니아", "인프라 집사", "택배 애호가"],
  "방산 및 우주항공": ["방산 덕후", "우주항공 몽상가", "로켓 마니아"],
  "블록체인 및 디지털자산": ["코인 마니아", "블록체인 얼리어답터", "디지털자산 덕후"],
  "ETF/펀드": ["안전제일 인덱스러", "분산투자 예찬론자", "ETF 집사"],
  기타: ["종잡을 수 없는 투자자", "장르불문 수집가", "정체불명 투자자"],
};

const REGION_MOD: Record<RegionKey, readonly string[]> = {
  KR: ["국내파", "동학개미", "K-투자자"],
  US: ["미국파", "서학개미", "나스닥 러버"],
  JP: ["엔화 러버", "일본파", "니케이 마니아"],
  CN: ["중국파", "차이나 관찰자", "위안화 투자자"],
  HK: ["홍콩파", "항셍 마니아", "홍콩 직구러"],
  Other: ["글로벌 노마드", "해외파", "세계여행 투자자"],
};

const ACCOUNT_MOD: Record<AccountKey, readonly string[]> = {
  domestic: ["국내계좌러", "일반계좌 애용자", "국내주식 본진"],
  foreign: ["해외직구러", "해외계좌 애용자", "서학개미 본진"],
  pension_irp: ["세액공제 헌터", "노후 지키미", "연금 만렙"],
  isa: ["절세 만렙", "ISA 애용자", "비과세 헌터"],
  unlisted: ["비상장 헌터", "숨은 대어 사냥꾼", "장외시장 개척자"],
};

const DESC_TEMPLATES: Record<ConcentrationLevel, readonly string[]> = {
  high: [
    "믿는 만큼 크게 베팅하는 편. {theme}에 대한 확신이 남다르다.",
    "한 번 꽂히면 끝까지 간다. {theme} 아니면 성에 안 찬다.",
    "계란을 한 바구니에 담았다. 그 바구니 이름은 {theme}.",
  ],
  medium: [
    "이것저것 담아도 중심은 잃지 않는 타입. {theme} 비중이 은근히 티난다.",
    "밸런스를 아는 편. 그래도 {theme} 취향은 못 숨긴다.",
    "고루고루 담았지만 마음 한 켠엔 항상 {theme}.",
  ],
  low: [
    "관심사가 매일 바뀌는 자유로운 스타일. 오늘은 {theme}, 내일은 또 다른 이야기.",
    "다양하게 담아보는 게 인생의 낙. {theme}도 그중 하나일 뿐.",
    "포트폴리오가 곧 취향 백과사전. {theme}는 그 안의 한 페이지.",
  ],
};

// 투자 성향(stockType) 축 모디파이어 — subtitle 옆 해시태그 등에서 재사용.
const STOCK_TYPE_MOD: Record<StockType, readonly string[]> = {
  성장주: ["성장주 헌터", "고성장 추격자", "우상향 예찬론자"],
  혁신주: ["혁신주 탐험가", "미래기술 베팅러", "테크 몽상가"],
  배당성장주: ["배당성장 알뜰러", "복리 재배자", "배당나무 집사"],
  배당주: ["배당 애호가", "인컴 수집가", "현금흐름 집사"],
  지수투자: ["인덱서", "시장추종 스타일러", "분산투자 모범생"],
  가치주: ["가치투자자", "저평가 헌터", "가치주 발굴러"],
  "채권/현금성": ["안전자산러", "현금 사수대", "변동성 회피자"],
  기타: ["종잡을 수 없는 스타일러", "잡식성 투자자", "자유로운 영혼"],
};

// stockType 축 — description 2번째 문장. {stock}은 대표 보유 종목명(숫자·비율 아닌 이름만이라
// "수치 미노출" 정책 위반 아님)으로 치환.
const STOCK_TYPE_DESC: Record<StockType, readonly string[]> = {
  성장주: [
    "요즘 제일 주목받는 성장주는 놓치지 않는 타입. 최근 에이스는 단연 {stock}.",
    "성장 스토리에 확신을 갖고 움직이는 편. 그 중심엔 단연 {stock}.",
    "우상향 흐름이 보이면 주저 없이 탑승. 지금 견인차는 {stock}.",
  ],
  혁신주: [
    "아직 증명되지 않은 미래에 과감히 베팅하는 편. {stock} 하나로 계좌가 롤러코스터.",
    "검증보다 가능성을 먼저 보는 스타일. {stock}의 성장을 지켜보는 중.",
    "리스크를 감수할 줄 아는 편. 이번엔 {stock}에 승부를 걸었다.",
  ],
  배당성장주: [
    "배당도 늘고 주가도 오르는 걸 제일 좋아함. {stock}, 딱 그 표본이다.",
    "복리의 힘을 믿는 편. {stock} 배당 재투자가 낙.",
    "현금흐름도 성장도 놓치기 싫은 알뜰한 스타일. 최애는 {stock}.",
  ],
  배당주: [
    "매달 들어오는 배당이 최고의 즐거움. {stock} 배당 소식에 웃음.",
    "시세보다 현금흐름을 우선하는 편. {stock}, 든든한 부업이나 다름없다.",
    "주가 등락엔 초연해도 배당은 꼭 챙긴다. 대표주자 {stock}.",
  ],
  지수투자: [
    "굳이 종목을 고르지 않아도 되는 여유를 아는 편. {stock} 하나로 시장 전체를 산다.",
    "시장을 이기려 애쓰지 않는 편. {stock}이면 충분하다.",
    "분산이 곧 전략. {stock} 하나로 마음 편히 버틴다.",
  ],
  가치주: [
    "저평가된 가치를 알아보는 데 진심. {stock}, 아직 시장이 몰라주는 원석이다.",
    "싸게 사서 오래 버티는 스타일. {stock} 매수가는 잊지 않는다.",
    "숫자를 꼼꼼히 뜯어보는 걸 즐기는 편. 최근 발굴은 {stock}.",
  ],
  "채권/현금성": [
    "변동성보다 안정을 우선하는 편. {stock} 비중으로 마음의 평화를 지킨다.",
    "쉬어가는 것도 전략이라는 주의. {stock}, 든든한 방파제 역할을 한다.",
    "리스크 관리가 최우선. {stock} 비중 덕분에 마음이 편하다.",
  ],
  기타: [
    "한 가지 스타일로 정의되길 거부하는 편. {stock}도 그 다채로움의 일부.",
    "성향이 유연하게 바뀌는 투자자. {stock}, 요즘 가장 눈길이 가는 종목.",
    "장르를 넘나드는 폭넓은 투자. {stock}도 그 컬렉션 중 하나.",
  ],
};

// topStockName이 없는 극단 케이스(mergedStocks 빈 상태 등)용 대체 문장 — {stock} 미포함.
const STOCK_TYPE_DESC_FALLBACK: Record<StockType, string> = {
  성장주: "요즘 주목받는 성장주는 놓치지 않는 타입.",
  혁신주: "아직 증명되지 않은 미래에 과감히 베팅하는 편.",
  배당성장주: "배당도 늘고 주가도 오르는 걸 제일 좋아함.",
  배당주: "매달 들어오는 배당이 최고의 즐거움.",
  지수투자: "굳이 종목을 고르지 않아도 되는 여유를 아는 편.",
  가치주: "저평가된 가치를 알아보는 데 진심.",
  "채권/현금성": "변동성보다 안정을 우선하는 편.",
  기타: "한 가지 스타일로 정의되길 거부하는 편.",
};

// 계좌(accountKey) 축 — description 3번째 문장(마무리 코멘트). "최소 3문장" 보장용으로,
// subtitle에서만 쓰이던 accountKey를 description에도 반영해 새 풀 없이 콘텐츠를 채운다.
const ACCOUNT_DESC: Record<AccountKey, readonly string[]> = {
  domestic: [
    "계좌는 국내 하나로 심플하게 정리하는 편.",
    "국내 계좌 하나로 웬만한 건 다 해결하는 스타일.",
    "국내 증시 안에서 승부를 보는 편.",
  ],
  foreign: [
    "해외 계좌까지 챙기는 걸 보면 준비된 투자자.",
    "국경을 넘나드는 계좌 운용이 익숙한 편.",
    "해외 계좌 관리도 능숙하게 해내는 타입.",
  ],
  pension_irp: [
    "연금·IRP까지 챙기는 걸 보면 노후 준비도 철저한 편.",
    "세제 혜택 계좌를 꼼꼼히 활용하는 알뜰한 스타일.",
    "은퇴 이후까지 내다보는 장기 플레이어.",
  ],
  isa: [
    "ISA까지 활용하는 걸 보면 절세에도 밝은 편.",
    "비과세 혜택은 놓치지 않는 알뜰한 스타일.",
    "세금까지 계산하는 꼼꼼한 투자자.",
  ],
  unlisted: [
    "비상장 주식까지 담는 걸 보면 남다른 안목의 소유자.",
    "아직 알려지지 않은 기회를 먼저 찾아나서는 편.",
    "시장에 상장되기 전부터 눈여겨보는 타입.",
  ],
};

// 통화 축 — description 4번째 문장(항상 포함). {currency}는 topCurrencyLabel 그대로 치환.
const CURRENCY_DESC: readonly string[] = [
  "환전은 걱정 없이, {currency} 자산 비중을 든든히 챙기는 편.",
  "{currency}로 꾸준히 사 모으는 재미를 아는 스타일.",
  "포트폴리오의 색깔은 확실히 {currency} 쪽으로 기운다.",
  "{currency} 자산이 계좌의 중심을 단단히 잡아준다.",
];

// 지수 축 — description 5번째 문장(topIndexLabel 있을 때만 포함). {index} 치환.
const INDEX_DESC: readonly string[] = [
  "패시브 투자도 챙기는 스타일. {index} 추종 상품도 든든히 담아뒀다.",
  "지수까지 아우르는 균형 감각. {index} 라인업도 빼놓지 않는다.",
  "개별 종목 승부만큼 {index} 같은 지수 투자도 즐기는 편.",
];

// 세부 테마 — sentence1(테마 문장) 뒤에 덧붙는 연결구. subThemeLabel 있을 때만. {subTheme} 치환.
const SUB_THEME_CONNECTOR: readonly string[] = [
  "그중에서도 {subTheme} 쪽에 특히 진심이다.",
  "특히 {subTheme} 분야에 마음이 가 있다.",
  "요즘 관심은 단연 {subTheme}.",
];

// 2위 종목 — sentence2(투자성향 문장) 뒤에 덧붙는 연결구. secondStockName 있을 때만. {stock2} 치환.
const SECOND_STOCK_CONNECTOR: readonly string[] = [
  "{stock2}도 눈여겨보는 든든한 라인업.",
  "그 옆을 지키는 건 {stock2}.",
  "{stock2}까지 챙기며 포트폴리오를 다졌다.",
];

// 2위 계좌 카테고리 — sentence3(계좌 문장) 뒤에 덧붙는 연결구. secondAccountLabel 있을 때만.
const SECOND_ACCOUNT_CONNECTOR: readonly string[] = [
  "{account2}도 함께 활용하는 알뜰한 스타일.",
  "{account2} 계좌도 꾸준히 챙기는 편.",
  "{account2}까지 병행하며 두루 관리한다.",
];

// 지수×계좌 맥락 — sentence5(지수 문장) 뒤에 덧붙는 연결구. topIndexAccountLabel 있을 때만.
const INDEX_ACCOUNT_CONNECTOR: readonly string[] = [
  "그마저도 {indexAccount} 쪽으로 담아둔 비중이 크다.",
  "특히 {indexAccount} 쪽에서 채워가는 비중이 눈에 띈다.",
  "{indexAccount}도 활용해 알뜰하게 채워가는 중이다.",
];

// 한국·미국 선호도 — description 6번째 문장(krUsBalance 있을 때만).
const KR_US_BALANCE_DESC: Record<KrUsBalance, readonly string[]> = {
  kr_only: [
    "국내 주식에만 집중하는 국내파.",
    "해외보다는 국내 시장에 집중하는 편.",
    "국내 증시 안에서 승부를 보는 스타일.",
  ],
  us_only: [
    "미국 주식 위주로 포트폴리오를 꾸린 편.",
    "국내보다는 미국 시장을 더 신뢰하는 스타일.",
    "해외, 그중에서도 미국에 집중하는 편.",
  ],
  kr_lead: [
    "국내 주식이 메인이고 미국 주식도 곁들이는 편.",
    "국내 비중이 더 크지만 미국 쪽도 놓치지 않는다.",
    "국내를 중심에 두고 미국까지 챙기는 스타일.",
  ],
  us_lead: [
    "미국 주식이 메인이고 국내 주식도 함께 챙기는 편.",
    "미국 비중이 더 크지만 국내 쪽도 놓치지 않는다.",
    "미국을 중심에 두고 국내까지 챙기는 스타일.",
  ],
  even: [
    "국내와 미국을 거의 반반으로 가져가는 밸런스파.",
    "국내·미국 어느 한쪽에 치우치지 않는 균형 잡힌 스타일.",
    "국내와 미국 사이에서 고민 없이 둘 다 담는 편.",
  ],
};

// 문장 간 연결어 — 각 축 문장이 뚝뚝 끊긴 개별 항목처럼 보이지 않도록 접속부사만 앞에 붙인다.
// 어미를 활용형으로 바꿔 억지로 한 문장으로 합치지 않는다(예: "~다"→"~며" 변환은 불규칙 활용
// 조합에서 비문이 되기 쉬움) — 완결문은 그대로 두고 흐름만 연결하는 안전한 방식.
const FLOW_CONNECTOR_MID: readonly string[] = [
  "게다가 ", "동시에 ", "여기에 ", "더불어 ", "이와 함께 ", "덧붙이면 ", "그러면서 ",
];
// 설명을 마무리하는 문장(존재하는 것 중 가장 마지막) 앞에 붙어 "종합 정리" 인상을 준다.
const FLOW_CONNECTOR_CLOSING: readonly string[] = ["종합하면, ", "전체적으로 보면, ", "정리하자면, "];

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
  const regionMod = pick(REGION_MOD[regionKey], `r:${seed}`);
  const accountMod = pick(ACCOUNT_MOD[accountKey], `a:${seed}`);
  const stockTypeMod = pick(STOCK_TYPE_MOD[stockTypeKey], `st:${seed}`);
  const descTemplate = pick(DESC_TEMPLATES[concentration], `d:${seed}`);

  // title과 동일한 themeNoun을 재사용 — title이 부른 "그 사람"을 설명 첫 문장도 같은 이름으로
  // 지칭해야 하나로 종합된 인물처럼 읽힌다(독립 pick으로 다른 동의어가 나오면 제목·설명이
  // 서로 다른 사람을 말하는 것처럼 어긋나 보였음).
  const sentence1 = descTemplate.replace("{theme}", themeNoun)
    + (subThemeLabel ? ` ${pick(SUB_THEME_CONNECTOR, `sub:${seed}`).replace("{subTheme}", subThemeLabel)}` : "");

  const trimmedStock = topStockName?.trim();
  const sentence2Base = trimmedStock
    ? pick(STOCK_TYPE_DESC[stockTypeKey], `st2:${seed}`).replace("{stock}", trimmedStock)
    : STOCK_TYPE_DESC_FALLBACK[stockTypeKey];
  // sentence2는 뒤에 항상 sentence3~4가 이어지므로 마지막 문장이 될 일이 없어 항상 MID 연결어.
  const sentence2 = `${pick(FLOW_CONNECTOR_MID, `f2:${seed}`)}${sentence2Base}`
    + (secondStockName ? ` ${pick(SECOND_STOCK_CONNECTOR, `st3:${seed}`).replace("{stock2}", secondStockName)}` : "");

  const sentence3 = `${pick(FLOW_CONNECTOR_MID, `f3:${seed}`)}${pick(ACCOUNT_DESC[accountKey], `pa:${seed}`)}`
    + (secondAccountLabel ? ` ${pick(SECOND_ACCOUNT_CONNECTOR, `sa:${seed}`).replace("{account2}", secondAccountLabel)}` : "");

  // 마지막 문장 판정 — krUsBalance 있으면 sentence6이 마지막, 없고 지수 있으면 sentence5,
  // 둘 다 없으면 sentence4(항상 존재)가 마지막. 마지막 문장에만 "종합하면" 류를 붙인다.
  const isSentence4Last = !topIndexLabel && !krUsBalance;
  const isSentence5Last = Boolean(topIndexLabel) && !krUsBalance;

  const sentence4 = `${isSentence4Last ? pick(FLOW_CONNECTOR_CLOSING, `f4:${seed}`) : pick(FLOW_CONNECTOR_MID, `f4:${seed}`)}`
    + pick(CURRENCY_DESC, `cur:${seed}`).replace("{currency}", topCurrencyLabel);

  const sentence5 = topIndexLabel
    ? `${isSentence5Last ? pick(FLOW_CONNECTOR_CLOSING, `f5:${seed}`) : pick(FLOW_CONNECTOR_MID, `f5:${seed}`)}`
      + pick(INDEX_DESC, `idx:${seed}`).replace("{index}", topIndexLabel)
      + (topIndexAccountLabel ? ` ${pick(INDEX_ACCOUNT_CONNECTOR, `ia:${seed}`).replace("{indexAccount}", topIndexAccountLabel)}` : "")
    : undefined;

  const sentence6 = krUsBalance
    ? `${pick(FLOW_CONNECTOR_CLOSING, `f6:${seed}`)}${pick(KR_US_BALANCE_DESC[krUsBalance], `kru:${seed}`)}`
    : undefined;

  const currencyTag = `${topCurrencyLabel}파`;
  const indexTag = topIndexLabel ? `${topIndexLabel}추종러` : undefined;

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
