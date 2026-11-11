// 미국 올해(ytd) 시작 기준가 판정(#150) — 같은 날짜의 미수정(raw, MODP=0)·수정(adj, MODP=1) 종가로 고른다.
// 수정주가가 현금배당까지 조정해도 S&P 500(가격지수)과 기준이 맞게, 조정 비율이 분할·병합 수준일 때만 adj를 쓴다.
// 순수 함수 — 서버 라우트와 테스트가 같이 쓴다.

// |adj/raw − 1| 이 이 값 미만이면 배당·미세 조정으로 보고 raw
export const YTD_SPLIT_THRESHOLD = 0.2;

export function pickYtdStartPrice(raw: number | null | undefined, adj: number | null | undefined): number | null {
  const r = raw !== null && raw !== undefined && raw > 0 ? raw : null;
  const a = adj !== null && adj !== undefined && adj > 0 ? adj : null;
  if (r !== null && a !== null) return Math.abs(a / r - 1) < YTD_SPLIT_THRESHOLD ? r : a;
  // 한쪽만 받았으면 raw 우선, raw가 없을 때만 adj. 둘 다 없으면 null(기준가 없음)
  return r ?? a;
}
