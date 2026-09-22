/**
 * "투자 유형 테스트" 인증카드 — X-Ray 분류(테마·지역·계좌유형)를 숫자·금액 없이
 * 재미있는 유형 이름 + 한 줄 설명으로 압축한다. 축 4개(집중도·테마·지역·계좌)의
 * 조합이라 결과가 100종을 훌쩍 넘고, 같은 포트폴리오는 항상 같은 결과가 나온다(결정적).
 */

import type { Sector } from "./classification-store";
import type { ConcentrationLevel } from "./stock-xray";

export type RegionKey = "KR" | "US" | "JP" | "CN" | "HK" | "Other";
export type AccountKey = "domestic" | "foreign" | "pension_irp" | "isa" | "unlisted";

export interface InvestorAvatarSpec {
  themeKey: Sector;
  regionKey: RegionKey;
  accountKey: AccountKey;
}

export interface InvestorType {
  title: string;
  subtitle: string;
  description: string;
  avatar: InvestorAvatarSpec;
}

export interface ResolveInvestorTypeParams {
  themeKey: Sector;
  concentration: ConcentrationLevel;
  regionKey: RegionKey;
  accountKey: AccountKey;
}

// 문자열 해시(djb2 계열) — 축 조합마다 같은 값이 나오도록 결정적으로 문구 변형을 고른다.
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pick<T>(pool: readonly T[], seed: string): T {
  return pool[hashString(seed) % pool.length];
}

const CONCENTRATION_MOD: Record<ConcentrationLevel, readonly string[]> = {
  high: ["몰빵형", "올인형", "한우물형"],
  medium: ["밸런스형", "적당히형", "고루고루형"],
  low: ["잡학형", "백화점형", "찍먹형"],
};

const THEME_NOUN: Record<Sector, readonly string[]> = {
  "AI 및 반도체": ["반도체 오타쿠", "칩 신봉자", "엔비디아 신도"],
  "AI 및 소프트웨어": ["코드 몽상가", "AI 전도사", "소프트웨어 덕후"],
  "AI 인프라 및 전력": ["전력 인프라 덕후", "데이터센터 집사", "전기요 신봉자"],
  "로봇 및 산업 자동화": ["로봇 오타쿠", "자동화 신봉자", "공장 자동화 집사"],
  "자율주행 및 모빌리티": ["자율주행 몽상가", "모빌리티 덕후", "테슬라 신도"],
  "금융 및 핀테크": ["핀테크 애호가", "금융주 집사", "은행 사랑꾼"],
  "바이오 및 헬스케어": ["임상 도박사", "신약 몽상가", "바이오 오타쿠"],
  "소비재 및 유통": ["소비재 덕후", "유통주 애호가", "쇼핑몰 집사"],
  "인프라 및 물류": ["물류 오타쿠", "인프라 집사", "택배 사랑꾼"],
  "방산 및 우주항공": ["방산 덕후", "우주항공 몽상가", "로켓 오타쿠"],
  "블록체인 및 디지털자산": ["코인 오타쿠", "블록체인 신봉자", "디지털자산 덕후"],
  "ETF/펀드": ["안전제일 인덱스러", "분산투자 신봉자", "ETF 집사"],
  기타: ["종잡을 수 없는 투자자", "장르불문 수집가", "정체불명 투자자"],
};

const REGION_MOD: Record<RegionKey, readonly string[]> = {
  KR: ["국뽕", "국내파", "동학개미"],
  US: ["성조기", "미국파", "서학개미"],
  JP: ["엔화 사랑꾼", "일본파", "니케이 마니아"],
  CN: ["중국파", "차이나 신봉자", "위안화 투자자"],
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
    "믿음 하나로 버티는 갓{theme} 신도. 분산이 뭔가요, 먹는 건가요.",
    "한 번 꽂히면 끝까지 간다. {theme} 아니면 인정 안 함.",
    "계란을 한 바구니에 담았다. 그 바구니 이름은 {theme}.",
  ],
  medium: [
    "이것저것 담아도 중심은 잃지 않는 타입. {theme} 비중이 은근히 티난다.",
    "밸런스 좀 아는 편. 그래도 {theme} 취향은 못 숨김.",
    "고루고루 담았지만 마음 한 켠엔 항상 {theme}.",
  ],
  low: [
    "관심사가 매일 바뀌는 자유로운 영혼. 오늘은 {theme}, 내일은 또 몰라.",
    "찍먹은 인생의 낙. {theme}도 그중 하나일 뿐.",
    "포트폴리오가 곧 취향 백과사전. {theme}는 그 안의 한 페이지.",
  ],
};

/** 숫자·금액·비율 없이 유형 이름 + 한 줄 설명 + 아바타 스펙만 반환 — 완전 결정적. */
export function resolveInvestorType(params: ResolveInvestorTypeParams): InvestorType {
  const { themeKey, concentration, regionKey, accountKey } = params;
  const seed = `${themeKey}|${concentration}|${regionKey}|${accountKey}`;

  const concentrationMod = pick(CONCENTRATION_MOD[concentration], `c:${seed}`);
  const themeNoun = pick(THEME_NOUN[themeKey], `t:${seed}`);
  const regionMod = pick(REGION_MOD[regionKey], `r:${seed}`);
  const accountMod = pick(ACCOUNT_MOD[accountKey], `a:${seed}`);
  const descTemplate = pick(DESC_TEMPLATES[concentration], `d:${seed}`);
  const descThemeNoun = pick(THEME_NOUN[themeKey], `dt:${seed}`);

  return {
    title: `${concentrationMod} ${themeNoun}`,
    subtitle: `${regionMod} · ${accountMod}`,
    description: descTemplate.replace("{theme}", descThemeNoun),
    avatar: { themeKey, regionKey, accountKey },
  };
}
