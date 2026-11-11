// 새 소식 — 사용자가 체감하는 변화의 단일 출처(#159, 4.82). 홈 팁 `whats_new`·더보기 시트가 읽는다.
// 등록 시점: 체감 변화가 있는 릴리스 PR에서 developer가 추가한다(PR 본문에 `새 소식: <id> | 해당 없음(사유)` 한 줄, C82).
// 규칙: id = "YYYYMMDD-NN"(게시일 KST + 같은 날 순번 01~99). 정렬 = 날짜 내림차순, 같은 날은 NN 오름차순(큰 변화 → 개선 → 고쳤어요).
// 문구(좁은 폭 어절 끊김 방지로 `1년·5년`·`••••주`에 U+2060 단어 결합자 삽입, C25): 이득 한 줄·해요체. 금액·투자 판단·과장·보장 어휘 금지(테스트가 검사). 버전(version) 필드는 두지 않는다.

import { MARKET_PAIR_TEXT } from "./app-features";

export interface WhatsNewEntry {
  id: string; // "YYYYMMDD-NN"
  title: string; // 2~32자
  body?: string; // 48자 이하
  featureId?: string; // APP_FEATURES id — 있으면 시트에 `바로 가기 ›`
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "20261111-01",
    title: "합친 평단을 가격 흐름 위에서 봐요",
    body: "여러 증권사에서 산 같은 종목도 한 장에, 1년\u2060·\u20605년과 매수일 표시",
    featureId: "stocks",
  },
  {
    id: "20261111-02",
    title: "내 종목 등락을 시장 지수 옆에서 봐요",
    body: `${MARKET_PAIR_TEXT}과 나란히, 올해 1월부터 비교도 돼요`,
    featureId: "market-compare",
  },
  {
    id: "20261111-03",
    title: "최근 7일 순자산이 왜 변했는지 나눠 봐요",
    body: "시세·환율·순유입 등으로, 홈과 같은 숫자예요",
    featureId: "week-causes",
  },
  {
    id: "20261111-04",
    title: "달마다 앞 달보다 얼마나 변했는지 봐요",
    body: "월 결산의 월별 기록에서 이어 볼 수 있어요",
    featureId: "change",
  },
  {
    id: "20261111-05",
    title: "맞추기 뒤에도 매수일·거래 기록이 이어져요",
    body: "새 종목 매수일은 한 번에 입력해요(기본 올해 1월 1일)",
    featureId: "stocks",
  },
  {
    id: "20261111-06",
    title: "장 마감 뒤엔 그날 종가 기준 등락을 보여 줘요",
    body: "주식의 '오늘' 칩이 'M/D 종가'로 바뀌어요",
    featureId: "stocks",
  },
  {
    id: "20261111-07",
    title: "금액 표시를 끄면 주식 수량도 가려져요",
    body: "인증카드 주식 현황의 수량이 •\u2060•\u2060•\u2060•\u2060주로 보여요",
    featureId: "share-card",
  },
  {
    id: "20261111-08",
    title: "작은 비중 표시·억 단위 반올림 등을 고쳤어요",
  },
];
