import { RATIO_PREVIEW_UPLOAD_NOTICE, SECURITY_COPY } from "@/config/security-copy";

// 가이드 2편 문구 정본(#77). 금액·예시 %·종목명·권유어·세금 0, 새 보안 문장 0(보안 문장은 security-copy 원문 import).
// 글을 고치면 lastModified도 함께 갱신한다(sitemap이 이 값을 그대로 쓴다).

export const GUIDE_SLUGS = ["stock-ratio", "net-worth"] as const;
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
  other: GuideSlug;
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
    other: "net-worth",
    lastModified: "2026-11-06",
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
    other: "stock-ratio",
    lastModified: "2026-11-06",
  },
};
