// 직접 입력 기록 폼 공용 순수 함수(5.158 #311) — 저장값·표시 조건을 화면과 테스트가 같은 함수로 계산한다.
// trade-utils(포지션 정·역 계산)와 분리: 그쪽은 저장된 포지션과 대칭이어야 해서 손대지 않는다.

/**
 * 해외 거래 체결 환율의 단일 값 — 칸·미리보기·연결 금액·`÷ N`·저장이 모두 이 값을 쓴다.
 * 칸 값 > 0 이면 그 값, 아니면 현재 환율(> 0일 때), 둘 다 없으면 undefined. 0은 돌려주지 않는다. 국내 종목은 항상 undefined.
 */
export function resolveTradeRate(opts: { input: number | undefined; currentRate: number; isForeign: boolean }): number | undefined {
  if (!opts.isForeign) return undefined;
  if (opts.input !== undefined && opts.input > 0) return opts.input;
  return opts.currentRate > 0 ? opts.currentRate : undefined;
}
