// 보유 현황 맞추기(#91) — 장별 인식 결과를 증권사·계좌가 정해진 장으로 만들고, 장 사이 중복을 종목 단위로 합친다. 순수 함수.
import type { Stock } from "@/types/asset";
import { confirmScreenBroker, inferScreenAccount, nameKey, sameBroker, tickerKey } from "./match";
import type { MergedItem, RawScreen, RawScreenItem, ResolvedScreen, ScreenItem } from "./types";

const round4 = (n: number) => Math.round(n * 10000) / 10000;
export const sameQty = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export interface ResolveOptions {
  usdRate: number;
  /** 사용자가 장마다 고른 증권사(장 번호 → 값). 자동 확정보다 우선 */
  brokerOverrides?: Record<number, string>;
  /** 사용자가 바꾼 국내 계좌(장 번호 → category) */
  accountOverrides?: Record<number, Stock["category"]>;
}

function toScreenItem(it: RawScreenItem, screenIndex: number, row: number, account: Stock["category"], usdRate: number): ScreenItem {
  const foreign = it.section === "해외" || it.category === "foreign";
  const category: Stock["category"] = foreign ? "foreign" : account;
  let currentPrice = it.currentPrice;
  let averagePrice = it.averagePrice;
  // 해외 종목을 원화로 읽은 화면은 현행 등록과 같은 규칙으로 환율로 나눈다(KRW로 본 해외 ÷ 환율)
  if (foreign && it.originalCurrency !== "USD" && it.originalCurrency !== "JPY" && usdRate > 0) {
    currentPrice = round4(currentPrice / usdRate);
    averagePrice = round4(averagePrice / usdRate);
  }
  return {
    screenIndex,
    row,
    name: it.name,
    ticker: (it.ticker ?? "").trim(),
    category,
    quantity: it.quantity,
    averagePrice,
    currentPrice,
    currency: foreign ? "USD" : "KRW",
    quantityMissing: !!it.quantityMissing,
    averagePriceEstimated: !!it.averagePriceEstimated,
  };
}

/** 장마다 증권사(①②/사용자 선택)와 계좌를 정한다. 성공하지 못한 장은 items가 비어 있다 */
export function resolveScreens(screens: RawScreen[], existing: Stock[], opts: ResolveOptions): ResolvedScreen[] {
  return screens.map((s) => {
    const ok = s.status === "ok";
    const override = opts.brokerOverrides?.[s.index];
    const auto = ok && !override ? confirmScreenBroker(s.items, existing) : null;
    const broker = override || auto?.broker || undefined;
    const account = opts.accountOverrides?.[s.index] ?? inferScreenAccount(ok ? s.items : [], existing, broker);
    return {
      index: s.index,
      status: s.status,
      broker,
      brokerSource: override ? "user" : auto?.source,
      account,
      items: ok ? s.items.map((it, row) => toScreenItem(it, s.index, row, account, opts.usdRate)) : [],
    };
  });
}

const keyOf = (i: { ticker: string; name: string; category: Stock["category"] }) =>
  `${tickerKey(i.ticker) || `name:${nameKey(i.name)}`}|${i.category}`;

/**
 * 장 사이 같은 종목을 1건으로 합친다. 서로 다른 장에 걸친 같은 키(티커 또는 정규화 종목명+category+증권사)만 겹침으로 본다.
 * 같은 장 안 중복 행은 실제 분리 행(`항목 N`)이라 합치지 않는다. 증권사가 미확정인 장은 합치지 않는다.
 * 수량이 다르면 값 후보 2개를 남기고 큰 값을 기본으로 둔다(K1).
 */
export function mergeScreens(screens: ResolvedScreen[]): MergedItem[] {
  const out: MergedItem[] = [];
  for (const s of screens) {
    for (const it of s.items) {
      const peer =
        s.broker !== undefined
          ? out.find(
              (m) =>
                m.broker !== undefined &&
                !m.screens.includes(s.index) &&
                keyOf(m) === keyOf(it) &&
                sameBroker(m.broker, s.broker),
            )
          : undefined;
      if (!peer) {
        out.push({ ...it, screens: [s.index], broker: s.broker, seq: out.length });
        continue;
      }
      peer.screens.push(s.index);
      if (peer.quantityMissing && !it.quantityMissing) {
        peer.quantity = it.quantity;
        peer.quantityMissing = false;
      } else if (!it.quantityMissing && !peer.quantityMissing && !sameQty(peer.quantity, it.quantity)) {
        const set = new Set([...(peer.quantityCandidates ?? [peer.quantity]), it.quantity]);
        peer.quantityCandidates = [...set].sort((a, b) => a - b);
        peer.quantity = peer.quantityCandidates[peer.quantityCandidates.length - 1];
      }
      // 평단은 화면 실값이 있는 쪽을 우선한다
      if (peer.averagePriceEstimated && !it.averagePriceEstimated) {
        peer.averagePrice = it.averagePrice;
        peer.averagePriceEstimated = false;
      }
      if (!peer.ticker && it.ticker) peer.ticker = it.ticker;
    }
  }
  return out;
}
