/**
 * asset/grow-pick.ts
 * 자산 불리기 확장(#242, 5.127) `내 선택` — 내가 정하거나 점검한 뒤 가격이 어떻게 됐는지를 건수로 센다(순수 함수 1개, 새 요청 0).
 * 결론 줄·패널 행·점검 한 장 이력 줄 값이 모두 computePick의 결과다(계산 2벌 금지).
 *  - 기록 1번 = 정함(정하지 않은 자산을 처음 정함 — 항목의 base.price) / 그대로 두기(choice same) / 바꾸기(choice keep·check·none)
 *    정함은 키당 최대 1번이고, 그 자산의 묶음을 바꾸면 정함이 바꾸기로 바뀐다(첫 결정은 기록이 아니라 항목에만 남는다)
 *  - 그 뒤 가격 = 같은 키의 다음 기록 가격 → 없으면 지금 가격(수량 합 > 0일 때만) → 판 자산은 그 기록 뒤 가장 늦은 매도 단가(이 앱 기록) → 없으면 세지 않는다.
 *    매도 뒤 가격은 쓰지도 조회하지도 않는다
 *  - 셀 수 있는 기록 = 30일이 지났고 두 가격이 모두 있는 것. 오름 = 화면에 쓰는 소수 1자리 %가 0보다 큰 것만(같음·내림은 '오르지 않음')
 *  - 주식·코인 보기 각각 따로 센다. 부동산·실물(r:·p:) 기록은 가격이 시세가 아니라 어디에도 넣지 않는다
 *  - 여기서 만드는 값은 화면 밖으로 나가지 않는다(서버·GA·AI 프롬프트·공유 0)
 */

import type { Crypto, Stock } from "@/types/asset";
import type { CryptoTransaction, Transaction } from "@/types/transaction";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { cryptoLabelKey, isStockLabelKey, labelKeyKind, reviewKey, stockLabelTime, type StockLabels, type StockReviewHit } from "@/lib/asset/stock-labels";
import { elapsedSince, kstDayText } from "@/lib/asset/grow-rows";

/** 셀 수 있게 되는 날 수 */
export const PICK_MIN_DAYS = 30;
/** 문장·행을 그리기 시작하는 건수 */
export const PICK_MIN_COUNT = 3;

export type PickKind = "set" | "same" | "move";
/** 패널 행 순서 — 값과 무관하게 고정. move의 표시 낱말만 `바꾸기`(저장 값·testId는 move 그대로) */
export const PICK_ROWS: readonly { kind: PickKind; label: string }[] = [
  { kind: "set", label: "정함" },
  { kind: "same", label: "그대로 두기" },
  { kind: "move", label: "바꾸기" },
];

export interface PickEvent {
  key: string;
  kind: PickKind;
  at: string;
  ms: number;
  /** 그때 가격 */
  price: number;
  hit?: StockReviewHit;
  /** 지금 가진 자산(수량 합 > 0)의 기록인지 */
  held: boolean;
  /** 기록한 날부터 지난 날 수(KST) */
  days: number;
  /** 그 뒤 가격 — next = 다음 기록, now = 지금 가격, sell = 매도 단가. 없으면 null */
  end: { kind: "next" | "now" | "sell"; price: number } | null;
  /** 화면에 쓰는 소수 1자리 % */
  pct: number | null;
  up: boolean;
  /** 건수(N)에 들어가는지 — 30일 지남 + 두 가격 있음 */
  counted: boolean;
}

export interface PickTally {
  n: number;
  up: number;
  /** 이 묶음의 기록이 있는 지금 가진 자산의 키(패널 행 거름용) */
  keys: string[];
}

export interface PickResult {
  /** count = 건수 문장, buy = 매수 문장, wait = 아직 못 셈(패널 없음) */
  state: "count" | "buy" | "wait";
  /** 셀 수 있는 기록 수와 그중 오름 — rows 세 묶음의 합과 같다 */
  n: number;
  up: number;
  rows: Record<PickKind, PickTally>;
  /** 그대로 두기·바꾸기 중 내 ±% 조건에 닿아 한 점검(hit down·up) — same ∪ move의 부분집합 */
  hit: PickTally;
  /** 이 앱에 기록한 매수 — 다른 축(N에 들어가지 않는다) */
  buys: PickTally;
  /** 가진 자산의 기록 중 30일이 안 돼 N에 못 든 수 */
  late: number;
  /** 가진 자산의 그때 가격이 있는 기록 전체(30일 미만 포함) — '아직 못 셈' 문장의 기록 수 */
  records: number;
  /** wait일 때 이유 — none = 기록 0, price = 지금 가격을 못 받아서, days = 30일 지난 기록이 모자라서 */
  waitReason: "none" | "price" | "days";
  events: PickEvent[];
}

export interface PickInput {
  /** 키별 지금 보유 — 수량 합과 지금 가격(없으면 null) */
  held: ReadonlyMap<string, { qty: number; nowPrice: number | null }>;
  /** 지금 가진 자산의 매수 거래(통화가 자산과 같은 것) */
  buys: readonly { key: string; price: number }[];
  /** 키별 매도 거래(날짜 YYYY-MM-DD) */
  sells: ReadonlyMap<string, readonly { date: string; price: number }[]>;
}

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;
const ROUND1 = (v: number) => Math.round(v * 10) / 10;
const pctOf = (start: number, end: number) => ROUND1((end / start - 1) * 100);
const emptyTally = (): PickTally => ({ n: 0, up: 0, keys: [] });
const add = (t: PickTally, e: { key: string; up: boolean; held: boolean }) => {
  t.n++;
  if (e.up) t.up++;
  if (e.held && !t.keys.includes(e.key)) t.keys.push(e.key);
};

/**
 * 한 보기(주식 또는 코인)의 `내 선택`. view와 종류가 다른 키·부동산·실물·예약 접두 키는 읽지 않는다.
 * 합 규칙: rows.set + rows.same + rows.move = n, 오름 합 = up. hit.n ≤ rows.same.n + rows.move.n. buys는 합에 들어가지 않는다.
 */
export function computePick(labels: StockLabels, view: "stock" | "crypto", input: PickInput, nowMs: number): PickResult {
  const today = kstDayText(nowMs);
  const byKey = new Map<string, Omit<PickEvent, "held" | "days" | "end" | "pct" | "up" | "counted">[]>();
  const push = (e: Omit<PickEvent, "held" | "days" | "end" | "pct" | "up" | "counted">) => { byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]); };
  const reviews = (labels.reviews ?? []).filter((r) => labelKeyKind(r.t) === view);
  for (const r of reviews) {
    const ms = stockLabelTime(r.at);
    if (ms === null) continue;
    push({ key: r.t, kind: r.choice === "same" ? "same" : "move", at: r.at, ms, price: r.price, ...(r.hit ? { hit: r.hit } : {}) });
  }
  for (const [key, item] of Object.entries(labels.items)) {
    if (labelKeyKind(key) !== view || item.label === null || !(item.base?.price && item.base.price > 0)) continue;
    const ms = stockLabelTime(item.labeledAt);
    // 묶음을 바꾼 날의 '정한 날'은 바꾸기 기록이 이미 센다(한 번의 누름은 한 종류로만)
    if (ms === null || reviews.some((r) => r.t === key && stockLabelTime(r.at) === ms)) continue;
    push({ key, kind: "set", at: item.labeledAt, ms, price: item.base.price });
  }

  const events: PickEvent[] = [];
  for (const [key, list] of [...byKey.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const h = input.held.get(key);
    const held = !!h && h.qty > 0;
    const sells = (input.sells.get(key) ?? []).filter((s) => DAY_TEXT.test(s.date) && s.date <= today && s.price > 0);
    const sorted = [...list].sort((a, b) => a.ms - b.ms || (reviewKey({ t: a.kind, at: a.at }) < reviewKey({ t: b.kind, at: b.at }) ? -1 : 1));
    sorted.forEach((e, i) => {
      const next = sorted[i + 1];
      let end: PickEvent["end"] = null;
      if (held) {
        end = next ? { kind: "next", price: next.price } : h!.nowPrice !== null && h!.nowPrice > 0 ? { kind: "now", price: h!.nowPrice } : null;
      } else {
        // 판 자산 — 그 기록 뒤(같은 날 포함) 매도 거래가 이 앱에 있을 때만. 마지막 기록의 그 뒤 가격 = 가장 늦은 매도 단가
        const after = sells.filter((s) => s.date >= kstDayText(e.ms));
        if (after.length > 0) end = next ? { kind: "next", price: next.price } : { kind: "sell", price: after.reduce((a, b) => (b.date >= a.date ? b : a)).price };
      }
      const days = elapsedSince(e.at, nowMs)?.days ?? 0;
      const pct = end ? pctOf(e.price, end.price) : null;
      events.push({ ...e, held, days, end, pct, up: pct !== null && pct > 0, counted: end !== null && days >= PICK_MIN_DAYS && e.ms <= nowMs });
    });
  }

  const rows: Record<PickKind, PickTally> = { set: emptyTally(), same: emptyTally(), move: emptyTally() };
  const hit = emptyTally();
  for (const e of events) {
    if (!e.counted) continue;
    add(rows[e.kind], e);
    if (e.kind !== "set" && (e.hit === "down" || e.hit === "up")) add(hit, e);
  }
  const buys = emptyTally();
  for (const b of input.buys) {
    const h = input.held.get(b.key);
    if (!h || !(h.qty > 0) || h.nowPrice === null || !(h.nowPrice > 0) || !(b.price > 0)) continue;
    add(buys, { key: b.key, up: pctOf(b.price, h.nowPrice) > 0, held: true });
  }
  const n = rows.set.n + rows.same.n + rows.move.n;
  const up = rows.set.up + rows.same.up + rows.move.up;
  const heldEvents = events.filter((e) => e.held);
  const late = heldEvents.filter((e) => e.days < PICK_MIN_DAYS).length;
  const unpriced = heldEvents.filter((e) => e.days >= PICK_MIN_DAYS && e.end === null).length;
  const state = n >= PICK_MIN_COUNT ? "count" : buys.n >= PICK_MIN_COUNT ? "buy" : "wait";
  const waitReason = heldEvents.length === 0 ? "none" : n + unpriced >= PICK_MIN_COUNT ? "price" : "days";
  return { state, n, up, rows, hit, buys, late, records: heldEvents.length, waitReason, events };
}

// ─── 문장 ────────────────────────────────────────────────────────────
// 굵은 것은 숫자(건수)뿐 — `모두`·`없음`·`오름`은 어느 상태에서도 보통 굵기(좋은 결과만 굵어지지 않게). b = 굵게 그릴 조각

export type PickText = readonly { t: string; b?: boolean }[];
export const pickTextOf = (parts: PickText): string => parts.map((p) => p.t).join("");

/** 결론 줄 — 상태표(spec 4절)와 같은 문자열. wait은 가운뎃점 앞뒤 두 조각(각각 nowrap으로 그린다) */
export function pickHeadline(r: PickResult): PickText {
  if (r.state === "count") {
    if (r.up === 0) return [{ t: `${r.n}번 중 그때보다 오른 것 없음` }];
    if (r.up === r.n) return [{ t: `${r.n}번 모두 그때보다 오름` }];
    return [{ t: `${r.n}번 중 ` }, { t: `${r.up}번`, b: true }, { t: "은 그때보다 오름" }];
  }
  if (r.state === "buy") {
    const b = r.buys;
    if (b.up === 0) return [{ t: `매수 ${b.n}건 중 매수가보다 오른 것 없음` }];
    if (b.up === b.n) return [{ t: `매수 ${b.n}건 모두 매수가보다 오름` }];
    return [{ t: `매수 ${b.n}건 중 ` }, { t: `${b.up}건`, b: true }, { t: "은 매수가보다 오름" }];
  }
  if (r.waitReason === "none") return [{ t: "30일 지난 기록" }, { t: "3번부터 보여요" }];
  if (r.waitReason === "price") return [{ t: `기록 ${r.records}번 ·` }, { t: "가격을 받으면 보여요" }];
  return [{ t: `기록 ${r.records}번 ·` }, { t: "30일 지난 3번부터 보여요" }];
}

/** 패널 행 오른쪽 — `오름 3번` / `모두 오름`(2번 이상 전부) / `오름 없음`. 1번뿐인 행은 `오름 1번`. always = 주석 줄(늘 `오름 m번`·`오름 없음`) */
export function pickUpText(t: { n: number; up: number }, unit: "번" | "건" = "번", always = false): PickText {
  if (t.up === 0) return [{ t: "오름 없음" }];
  if (!always && t.up === t.n && t.n > 1) return [{ t: "모두 오름" }];
  return [{ t: "오름 " }, { t: `${t.up}${unit}`, b: true }];
}

/** 점검 한 장 이력 줄 오른쪽 값 — 그 기록부터 다음 기록(next)·지금(now)까지. 판 자산의 매도 단가는 그리지 않는다 */
export function pickAfterOf(r: PickResult, key: string, at: string): { kind: "now" | "next"; pct: number } | null {
  const e = r.events.find((x) => x.key === key && x.at === at && x.kind !== "set");
  if (!e || !e.end || e.end.kind === "sell" || e.pct === null) return null;
  return { kind: e.end.kind, pct: e.pct };
}

// ─── 입력 만들기 ─────────────────────────────────────────────────────

const pushTo = <T,>(m: Map<string, T[]>, k: string, v: T) => { m.set(k, [...(m.get(k) ?? []), v]); };

/**
 * 주식 보기 입력 — 키 = normalizeTicker. '가진 종목' = 수량 합 > 0(전량 매도 뒤 수량 0으로 남은 보유 건은 판 종목). 상장폐지 보유 건은 뺀다.
 * 거래는 stockId로 보유 건에 잇고 통화가 종목과 같을 때만 쓴다. 보유 건이 지워져 남은 매도 거래는 거래의 티커가 키와 같을 때만 쓴다.
 */
export function stockPickInput(stocks: Stock[], transactions: Transaction[]): PickInput {
  const held = new Map<string, { qty: number; nowPrice: number | null }>();
  const byId = new Map<string, { key: string; currency: string }>();
  for (const s of stocks) {
    if (!s.ticker) continue;
    const key = normalizeTicker(s);
    if (!isStockLabelKey(key) || labelKeyKind(key) !== "stock") continue;
    byId.set(s.id, { key, currency: s.currency });
    if (s.inactiveStatus === "delisted") continue;
    const h = held.get(key) ?? { qty: 0, nowPrice: null };
    held.set(key, { qty: h.qty + (s.quantity > 0 ? s.quantity : 0), nowPrice: h.nowPrice ?? (s.currentPrice > 0 ? s.currentPrice : null) });
  }
  const buys: { key: string; price: number }[] = [];
  const sells = new Map<string, { date: string; price: number }[]>();
  for (const t of transactions) {
    const own = byId.get(t.stockId);
    if (own && t.currency !== own.currency) continue;
    if (t.type === "buy") { if (own) buys.push({ key: own.key, price: t.price }); continue; }
    const key = own?.key ?? (t.ticker ?? "").trim().toUpperCase();
    if (key) pushTo(sells, key, { date: t.date, price: t.price });
  }
  return { held, buys, sells };
}

/** 코인 보기 입력 — 키 = `c:`+대문자 심볼(심볼 묶음). 거래는 cryptoId로, 보유 건이 지워져 남은 매도 거래는 거래의 심볼로 잇는다. 모두 원화 */
export function cryptoPickInput(crypto: Crypto[], transactions: CryptoTransaction[]): PickInput {
  const held = new Map<string, { qty: number; nowPrice: number | null }>();
  const byId = new Map<string, string>();
  for (const c of crypto) {
    const key = cryptoLabelKey(c.symbol);
    if (!key) continue;
    byId.set(c.id, key);
    const h = held.get(key) ?? { qty: 0, nowPrice: null };
    held.set(key, { qty: h.qty + (c.quantity > 0 ? c.quantity : 0), nowPrice: h.nowPrice ?? (c.currentPrice > 0 ? c.currentPrice : null) });
  }
  const buys: { key: string; price: number }[] = [];
  const sells = new Map<string, { date: string; price: number }[]>();
  for (const t of transactions) {
    const key = byId.get(t.cryptoId) ?? (byId.has(t.cryptoId) ? null : cryptoLabelKey(t.symbol));
    if (!key) continue;
    if (t.type === "buy") { if (byId.has(t.cryptoId)) buys.push({ key, price: t.price }); continue; }
    pushTo(sells, key, { date: t.date, price: t.price });
  }
  return { held, buys, sells };
}
