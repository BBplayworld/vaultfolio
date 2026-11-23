import { RATIO_PREVIEW_UPLOAD_NOTICE, SECURITY_COPY } from "@/config/security-copy";
import { CARD_UNTIL_DAY, FIRST_RECORD_MIN_DAYS } from "@/lib/report/settlement";
import { YEAR_SETTLE_COPY } from "@/lib/report/year-settlement";

// 가이드 문구 정본(#77). 금액·예시 %·종목명·권유어·세금 0, 새 보안 문장 0(보안 문장은 security-copy 원문 import).
// 예외: market-history(#263)는 본문이 투자 탭 컴포넌트 1벌이라 지수 이름이 필요하다(문구 규칙은 투자 탭 R1~R11). 이 파일은 첫 화면 번들에 들어가므로 투자 데이터를 import하지 않는다 — 설명의 숫자(1961년·4번)는 테스트가 데이터와 대조한다.
// 글을 고치면 lastModified도 함께 갱신한다(sitemap이 이 값을 그대로 쓴다).

export const GUIDE_SLUGS = ["stock-ratio", "net-worth", "year-end", "market-history", "index-returns-by-year", "rate-hike-years", "recession-years", "recovery-years", "kospi-by-year", "monthly-buying", "yield-spread-years"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export interface GuideCta {
  label: string;
  /** link: 일반 링크, trial: 체험 이동(GA 후 이동) */
  kind: "link" | "trial";
  href: string;
}

export interface GuideDoc {
  slug: GuideSlug;
  title: string;
  description: string;
  h1: string;
  summary: string;
  steps: { title: string; body: string; inlineLink?: { label: string; href: string } }[];
  factTitle: string;
  facts: string[];
  primary: GuideCta;
  secondary: GuideCta;
  /** 루트 링크 줄(RootGuideLinks) 글자 — 짧게(320px 2줄 이하) */
  linkLabel: string;
  /** 본문 안에서 줄 중간에 끊기면 안 되는 어구(새 편만 지정 — 기존 편 출력 diff 0) */
  nowrapPhrases?: string[];
  lastModified: string;
}

export const GUIDE_BRAND_LINE = "안전한 자산 관리, 시크릿에셋";
export const GUIDE_FACT_TITLE = "시크릿에셋으로 하면";

const LOCAL_SAVE_COPY = SECURITY_COPY.find((c) => c.id === "local")!.desc;

const RATIO_CTA: GuideCta = { label: "캡처로 내 비중 보기", kind: "link", href: "/ratio" };
const TRIAL_CTA: GuideCta = { label: "예시 데이터로 둘러보기", kind: "trial", href: "/?trial=1" };

export const GUIDES: Record<GuideSlug, GuideDoc> = {
  "stock-ratio": {
    slug: "stock-ratio",
    title: "여러 증권사 주식 비중 한 번에 보기",
    description: "여러 증권사에 나눠 담은 주식을 모아 종목별 비중과 국내/해외 비율을 보는 순서예요.",
    h1: "여러 증권사 주식 비중 한 번에 보기",
    summary:
      "증권사를 여러 곳 쓰면 앱마다 보이는 비중은 그 계좌 안의 비중이에요. 내 주식 전체에서 한 종목이 차지하는 몫은 계좌를 합쳐야 보여요.",
    steps: [
      {
        title: "증권사별 보유 화면 모으기",
        body: "각 증권사 앱의 보유 종목 화면을 같은 날 열어 두세요. 날짜가 다르면 그사이 시세가 움직여 합친 숫자가 어긋나요. 종목 이름과 평가금액이 보이는 화면이면 충분해요.",
      },
      {
        title: "같은 종목은 한 줄로 합치기",
        body: "두 계좌에 같은 종목이 있으면 평가금액을 더해 한 줄로 만들어요. 해외 종목은 원화로 바꿔 더해야 국내 종목과 같은 기준이 돼요. 환율도 화면을 모은 날 기준으로 맞춰 두세요.",
      },
      {
        title: "종목별·국내/해외 비중 보기",
        body: "종목별 평가금액을 전체 합계로 나누면 종목별 비중이 나와요. 국내와 해외를 각각 더해 나누면 국내/해외 비율이 보여요. 비중은 잘잘못을 가리는 숫자가 아니에요. 지금 내 주식이 어떻게 나뉘어 있는지 보여 주는 숫자예요.",
        inlineLink: { label: "캡처 한 장으로 바로 보려면 비중 미리보기", href: "/ratio" },
      },
      {
        title: "매달 같은 날 다시 보기",
        body: "사고팔지 않아도 시세가 움직이면 비중은 바뀌어요. 월말처럼 날을 하나 정해 같은 순서로 다시 보세요. 그러면 지난번과 비교하기 쉬워요.",
      },
    ],
    factTitle: GUIDE_FACT_TITLE,
    facts: [
      "비중 미리보기에 증권앱 보유 종목 캡처 한 장을 올려요. 종목별 비중과 국내/해외 비율을 바로 보여 줘요. 가입이나 로그인은 없어요.",
      RATIO_PREVIEW_UPLOAD_NOTICE,
      "미리보기는 캡처 한 장 기준이에요. 여러 증권사를 합친 비중은 증권사마다 캡처를 올려 저장한 뒤 봐요. 상세 > 주식의 '전체'에서 같은 종목을 한 줄로 합쳐 보여 줘요. 시세는 앱이 반영해요.",
      LOCAL_SAVE_COPY,
    ],
    primary: RATIO_CTA,
    secondary: TRIAL_CTA,
    linkLabel: "주식 비중 한 번에 보기",
    lastModified: "2026-11-21",
  },
  "net-worth": {
    slug: "net-worth",
    title: "월말 순자산 정리하는 법",
    description: "자산을 종류별로 적고 대출을 빼 순자산을 구한 뒤, 매달 같은 날 기록해 변화의 이유까지 보는 순서예요.",
    h1: "월말 순자산 정리하는 법",
    summary:
      "순자산은 가진 자산에서 갚아야 할 대출을 뺀 값이에요. 한 달에 한 번 같은 방식으로 적으면 늘고 준 이유까지 보여요.",
    steps: [
      {
        title: "자산을 종류별로 적기",
        body: "부동산·주식·현금·코인처럼 종류별로 나눠 적어요. 증권사·은행·거래소가 여러 곳이면 곳마다 한 줄씩 적어요. 종류별 합계를 따로 내 두면 다음 달 비교가 쉬워요. 부동산은 어떤 값을 쓸지 한 번 정하고 매달 같은 기준으로 적어요.",
      },
      {
        title: "대출을 빼서 순자산 구하기",
        body: "자산 합계에서 대출 잔액을 빼면 순자산이에요. 대출을 자산 칸에 섞으면 합계가 부풀어 보이니 따로 적어요.",
      },
      {
        title: "매달 같은 날 기록하기",
        body: "월말처럼 날을 하나 정해 같은 순서로 적어요. 기록하는 날이 들쭉날쭉하면 시세 차이가 섞여 비교가 흐려져요.",
      },
      {
        title: "변화를 두 가지로 나눠 보기",
        body: "지난달과 순자산이 달라졌다면 이유는 크게 두 가지예요. 하나는 월급이나 생활비처럼 돈이 들고 난 입출금이에요. 다른 하나는 가진 자산의 시세·환율 변화예요. 주식을 사고팔거나 대출을 갚는 건 자산 사이의 이동이에요. 그래서 순자산은 그대로예요. 둘을 나눠 보면 모은 돈과 시세로 움직인 돈이 구분돼요.",
      },
    ],
    factTitle: GUIDE_FACT_TITLE,
    facts: [
      "주식·코인·현금·대출은 앱 화면 캡처를 올려 등록해요. 부동산은 직접 입력하고, 주식·코인 시세는 앱이 반영해요.",
      "성과 > 자산 변화의 '월'에서 지난달 대비 변화와 원인을 봐요. 지나간 달은 'N월 결산'으로 볼 수 있어요. 기록으로 설명되지 않는 부분은 '기록 안 된 변화'로 따로 보여 줘요.",
      "결산 화면의 '캘린더에 매월 결산일 추가'로 기록할 날을 정해 둘 수 있어요.",
      "지난 연도 순자산은 직접 입력하면 연도별로 비교할 수 있어요.",
      LOCAL_SAVE_COPY,
    ],
    primary: TRIAL_CTA,
    secondary: RATIO_CTA,
    linkLabel: "월말 순자산 정리",
    lastModified: "2026-11-21",
  },
  "year-end": {
    slug: "year-end",
    title: "올해 자산 결산하는 법",
    description: "작년 말과 지금 순자산을 비교하고, 그 차이를 내가 넣은 돈과 시세·환율 등으로 움직인 돈으로 나눠 보는 순서예요.",
    h1: "올해 자산 결산하는 법",
    summary:
      "한 해 동안 달라진 순자산에는 내가 넣은 돈과 시세·환율 등으로 움직인 돈이 섞여 있어요. 둘을 나누면 무엇으로 달라졌는지 보여요.",
    steps: [
      {
        title: "기준 정하기",
        body: "출발점은 작년 말 순자산이에요. 작년 말 값이 없다면 올해 처음 기록한 날을 출발점으로 삼고 '그날 이후 결산'으로 봐요.",
      },
      {
        title: "지금 순자산 구하기",
        body: "같은 날 모은 자산 합계에서 대출 잔액을 빼요. 해외 자산은 같은 날 환율로 바꿔 더해요. 적는 순서는 아래 글에 있어요.",
        inlineLink: { label: "월말 순자산 정리하는 법", href: "/guide/net-worth" },
      },
      {
        title: "올해 넣은 돈 더하기",
        body: "올해 계좌에 넣은 돈에서 꺼낸 돈을 뺀 값을 넣은 돈 하나로 써요. 주식 매수·매도와 대출 상환은 자산 사이의 이동이라 넣은 돈에 넣지 않아요.",
      },
      {
        title: "나머지 보기",
        body: "지금 순자산에서 기준을 뺀 값이 올해 달라진 금액이에요. 여기서 넣은 돈을 빼면 나머지가 남아요. 나머지는 시세·환율과 그 밖의 변화예요. 대출 이자와 받은 배당·이자, 적지 못한 입출금도 여기에 섞여요. 잘잘못이나 성과를 가리는 숫자는 아니에요.",
      },
    ],
    factTitle: GUIDE_FACT_TITLE,
    facts: [
      "지난 연도 순자산을 직접 넣으면 성과 > 자산 변화의 '연' 탭에서 올해 전체 변화를 바로 비교해요.",
      `${YEAR_SETTLE_COPY.income}과 ${YEAR_SETTLE_COPY.growth}은 월 기록이 쌓인 달부터 나눠져요. 그 전 기간은 '${YEAR_SETTLE_COPY.periodSub}' 한 줄로 합쳐 보여 줘요.`,
      `${YEAR_SETTLE_COPY.income}은 입금에서 출금을 뺀 금액, ${YEAR_SETTLE_COPY.growth}은 시세 변동·평가 갱신·환율 효과예요. ${YEAR_SETTLE_COPY.loan}은 ${YEAR_SETTLE_COPY.loanHint}.`,
      `${YEAR_SETTLE_COPY.help}. 설명되지 않는 부분은 '기록 안 된 변화'로 따로 보여 줘요.`,
      `작년 말 값이 없으면 처음 기록한 날 이후로 결산하고, ${FIRST_RECORD_MIN_DAYS}일이 지나야 보여요.`,
      `지난해 순자산이 기록돼 있으면 1월 ${CARD_UNTIL_DAY}일까지는 지난해 결산을 보여 줘요.`,
      LOCAL_SAVE_COPY,
    ],
    primary: TRIAL_CTA,
    secondary: RATIO_CTA,
    linkLabel: "올해 자산 결산",
    nowrapPhrases: [
      "1월 " + CARD_UNTIL_DAY + "일",
      FIRST_RECORD_MIN_DAYS + "일이",
      "성과 > 자산 변화",
      "'연' 탭에서",
      "'그날 이후 결산'으로",
      "'기록 안 된 변화'로",
      `'${YEAR_SETTLE_COPY.periodSub}'`,
    ],
    lastModified: "2026-11-21",
  },
  "market-history": {
    slug: "market-history",
    title: "S&P 500·나스닥100·코스피, 크게 빠진 때와 금리 한 장으로 보기",
    description: "1961년 이후 S&P 500이 연말 기준 15% 넘게 빠진 4번을 기준금리, 미국 경기침체, 같은 시기 사건과 한 장에 모았어요. 바닥까지·전고점까지 걸린 기간과 연도별 수익률도 볼 수 있어요.",
    h1: "S&P 500·나스닥100·코스피, 크게 빠진 때와 금리 한 장으로 보기",
    summary: "연말 지수가 크게 빠진 때를 그때의 기준금리, 미국 경기침체 기간, 같은 시기 사건과 한 장에 모았어요. 과거 시장 사실이고 투자 권유가 아니에요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle). 아래 steps·facts는 쓰지 않는다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "크게 빠진 때와 금리, 한 장으로 보기",
    lastModified: "2026-11-22",
  },
  "index-returns-by-year": {
    slug: "index-returns-by-year",
    title: "S&P 500·나스닥100·코스피 연도별 수익률 한눈에 보기",
    description: "세 지수의 해마다 오르내린 %를 한 격자에 모았어요. 그해 금리와 있었던 일도 같이 볼 수 있어요. 배당 제외·연말 기준이에요.",
    h1: "S&P 500·나스닥100·코스피 연도별 수익률 한눈에 보기",
    summary: "전해보다 연말 지수가 오른 해와 내린 해가 몇 번이었는지 연대별로 세어 두었어요. 해마다 오르내린 %는 아래 격자에서 볼 수 있어요. 과거 기록을 모은 글이라 앞날을 말해 주지 않아요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle) + 연대별 고유 표. 아래 steps·facts는 쓰지 않는다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "해마다 오르내린 %, 한 격자로 보기",
    lastModified: "2026-11-22",
  },
  "rate-hike-years": {
    slug: "rate-hike-years",
    title: "금리 인상기에 S&P 500·코스피는 어땠을까",
    description: "1990년 이후 연준이 금리를 올린 6번의 국면이 걸친 해마다, S&P 500·나스닥100·코스피가 전년보다 올랐는지 세어 두었어요. 과거 사실이고 투자 권유가 아니에요.",
    h1: "금리 인상기에 S&P 500·코스피는 어땠을까",
    summary: "인상 국면이 걸친 해는 연준이 목표 금리를 처음 올린 해부터, 다음에 내리기 전 마지막으로 올린 해까지예요. 1990년 이후 이런 국면은 6번, 걸친 해는 14개였고 S&P 500과 코스피는 그중 9개 해에 연말 지수가 전년보다 올랐어요. 지수 등락은 1월부터 12월까지 한 해 전체 값이라 인상이 없던 달도 들어 있어요. 금리와 지수를 같은 해에 나란히 놓았을 뿐, 한쪽이 다른 쪽을 움직였다는 뜻은 아니에요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle) + 인상 국면 고유 표. 아래 steps·facts는 쓰지 않는다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "금리 인상기의 지수",
    lastModified: "2026-11-22",
  },
  "recession-years": {
    slug: "recession-years",
    title: "미국 경기침체 때 주가는 얼마나 빠졌나",
    description: "1961년 이후 미국 경기침체 9번이 걸친 해마다 S&P 500·나스닥100·코스피가 전년보다 올랐는지 모았어요. 침체가 있었는데도 오른 해도 그대로 적었어요.",
    h1: "미국 경기침체 때 주가는 얼마나 빠졌나",
    summary: "경기침체가 걸친 해는 미국 경제연구소(NBER)가 정한 경기 고점 다음 달부터 저점 달까지의 기간이 한 달이라도 든 해예요. 1961년 이후 이런 해는 14개였고, S&P 500은 그중 6개 해에 내렸고 8개 해에는 올랐어요. 가장 크게 내린 해는 2008년(−38.5%)이었어요. 연말 값끼리 비교한 것이라 한 해 안에서 빠졌다가 돌아온 폭(2020년 3월 등)은 이 표에 나오지 않아요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle) + 침체 고유 표. 아래 steps·facts는 쓰지 않는다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "경기침체 때의 지수",
    lastModified: "2026-11-22",
  },
  "recovery-years": {
    slug: "recovery-years",
    title: "S&P 500·나스닥100·코스피, 크게 빠진 뒤 전고점까지 몇 년 걸렸나",
    description: "S&P 500·나스닥100·코스피가 연말 기준 15% 넘게 빠진 13번을 모아, 고점에서 바닥까지와 고점에서 전고점까지 걸린 햇수를 한 표에 정리했어요. 과거 사실이고 투자 권유가 아니에요.",
    h1: "S&P 500·나스닥100·코스피, 크게 빠진 뒤 전고점까지 몇 년 걸렸나",
    summary: "연말 기준으로 15% 넘게 빠진 뒤 이전 고점을 다시 넘기까지 걸린 햇수를 세 지수 13번 모두 모았어요. S&P 500은 4번 2~14년, 나스닥100은 3번 2~15년, 코스피는 6번 3~6년이 걸렸어요. 과거 기록을 모은 글이라 앞날을 말해 주지 않아요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle) + 회복 기간 고유 표. 아래 steps·facts는 쓰지 않는다. summary의 숫자(13번·4/3/6번·2~14년 등)는 테스트가 데이터와 대조한다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "크게 빠진 뒤 전고점까지 걸린 해",
    lastModified: "2026-11-23",
  },
  "kospi-by-year": {
    slug: "kospi-by-year",
    title: "코스피 연도별 수익률과 크게 빠진 해 한눈에 보기",
    description: "1982년 이후 코스피가 해마다 오르내린 %와, 한 해에 −15% 이하로 내린 7해의 같은 해 경제 이슈를 모았어요. 배당 제외·연말 기준이에요.",
    h1: "코스피 연도별 수익률과 크게 빠진 해 한눈에 보기",
    summary: "1982년 이후 코스피는 44해 중 29해에 연말 값이 전해보다 올랐고, −15% 이하로 내린 해는 7해였어요. 가장 크게 내린 해는 2000년 −50.9%였어요. 과거 기록을 모은 글이라 앞날을 말해 주지 않아요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle, 기본 지수 코스피) + −15% 이하 해 고유 표. summary의 숫자(44·29·7·2000년 −50.9%)는 테스트가 데이터와 대조한다
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "코스피 연도별 수익률과 크게 빠진 해",
    lastModified: "2026-11-23",
  },
  "monthly-buying": {
    slug: "monthly-buying",
    title: "S&P 500·나스닥100, 한 번에 넣었을 때와 매달 나눠 넣었을 때 — 시작 연도별 결과",
    description: "S&P 500·나스닥100에 같은 총액을 2000·2005·2010·2015·2020년 말에 한 번에 넣은 경우와 매달 나눠 넣은 경우의 2025년 말 결과를 한 표에 모았어요. 연말 값으로 어림했고 투자 권유가 아니에요.",
    h1: "S&P 500·나스닥100, 한 번에 넣었을 때와 매달 나눠 넣었을 때 — 시작 연도별 결과",
    summary: "시작 해 5개(2000·2005·2010·2015·2020년 말)부터 2025년 말까지, 같은 총액을 한 번에 넣은 경우와 매달 나눠 넣은 경우의 넣은 돈 대비 배수를 같은 표에 나란히 놓았어요. 매달 나눠 넣기는 월 값 대신 연말 값의 평균으로 어림했고, 늦게 넣은 돈일수록 짧게 들어가 있었어요. 과거 기록을 모은 글이라 앞날을 말해 주지 않아요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle) + 시작 해별 표. 아래 steps·facts는 쓰지 않는다. 시작 해·마지막 해(2000~2020·2025)는 정적 문자열이라 테스트가 데이터와 대조한다(연간 갱신 때 함께 고친다)
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "한 번에 넣기와 매달 나눠 넣기, 시작 해별 결과",
    lastModified: "2026-11-23",
  },
  "yield-spread-years": {
    slug: "yield-spread-years",
    title: "장단기 금리차가 마이너스였던 해와 그해·다음 해 S&P 500 연말 등락",
    description: "1976~2025년 중 장단기 금리차(10년−2년)가 마이너스인 달이 있던 해와 없던 해로 나눠, 그해와 다음 해 S&P 500 연말 등락을 같은 표에 놓았어요. 과거 사실이고 투자 권유가 아니에요.",
    h1: "장단기 금리차가 마이너스였던 해와 그해·다음 해 S&P 500 연말 등락",
    summary: "1976~2025년 중 금리차가 마이너스인 달이 있던 해는 14해, 없던 해는 36해였어요. 있던 해는 그해 14해 중 10해, 다음 해 14해 중 10해에 S&P 500이 올랐어요. 없던 해는 그해 36해 중 28해, 다음 해 35해 중 27해에 올랐어요. 두 값을 같은 해에 나란히 놓았을 뿐, 한쪽이 다른 쪽을 움직였다는 뜻은 아니에요.",
    // 본문은 투자 탭 컴포넌트(MarketHistoryArticle, 기본 지수 S&P 500) + 금리차 고유 표 2개. 아래 steps·facts는 쓰지 않는다. 범위·해 수(1976~2025·14·10·36·28·35·27)는 정적 문자열이라 테스트가 데이터와 대조한다(연간 갱신 때 함께 고친다)
    steps: [],
    factTitle: GUIDE_FACT_TITLE,
    facts: [],
    primary: { label: "내 자산도 정리해 보기", kind: "link", href: "/" },
    secondary: TRIAL_CTA,
    linkLabel: "금리차가 마이너스였던 해의 S&P 500",
    lastModified: "2026-11-23",
  },
};

/** 시장 가이드 8편의 `관련 글` 줄(5.141 #274·5.143 #282): 모든 편이 다른 편에서 1번 이상 링크된다 */
export const GUIDE_RELATED: Partial<Record<GuideSlug, GuideSlug[]>> = {
  "market-history": ["rate-hike-years", "recession-years"],
  "index-returns-by-year": ["kospi-by-year", "market-history"],
  "rate-hike-years": ["recession-years", "market-history", "yield-spread-years"],
  "recession-years": ["recovery-years", "rate-hike-years"],
  "recovery-years": ["market-history", "monthly-buying"],
  "kospi-by-year": ["index-returns-by-year", "recovery-years"],
  "monthly-buying": ["index-returns-by-year", "recovery-years"],
  "yield-spread-years": ["rate-hike-years", "index-returns-by-year"],
};
