// 보유 현황 맞추기(#91) — 기존 항목 찾기. 순수 함수(저장·React 호출 없음).
// 키 = 티커 + category + 증권사. 증권사 값은 실데이터 형태(`""`·`항목 N`·`연금저축` 같은 자유 텍스트·목록 밖 `데모증권`)를 그대로 다룬다.
import type { Stock } from "@/types/asset";
import { matchBrokerHint } from "@/config/asset-options";
import type { BrokerSource, RawScreenItem } from "./types";

const squash = (s: string) => s.replace(/\s/g, "");

/** 증권사 미지정으로 보는 값: 없음·빈 문자열·`항목 N` */
export function isUnassignedBroker(b: string | undefined | null): boolean {
  const t = squash(b ?? "");
  return t === "" || /^항목\d+$/.test(t);
}

/** 두 증권사 값이 같은가. 둘 다 지정된 값일 때만 true. 공백 무시, 자유 텍스트는 문자 그대로 비교, 목록명으로 같아지는 경우도 같다고 본다 */
export function sameBroker(a: string | undefined | null, b: string | undefined | null): boolean {
  if (isUnassignedBroker(a) || isUnassignedBroker(b)) return false;
  const x = squash(a!);
  const y = squash(b!);
  if (x === y) return true;
  const ma = matchBrokerHint(a!);
  return !!ma && ma === matchBrokerHint(b!);
}

/** 티커 비교용 정규화(대문자, 거래소 접미사 제거) */
export const tickerKey = (t: string | undefined | null): string => (t ?? "").trim().toUpperCase().split(":")[0];
export const nameKey = (n: string | undefined | null): string => squash(n ?? "").toLowerCase();

const DOMESTIC_FAMILY = new Set<Stock["category"]>(["domestic", "isa", "irp", "pension"]);

/** 장 증권사 확정 ①②. 확정 못 하면 null(사용자가 1회 고른다) */
export function confirmScreenBroker(
  items: RawScreenItem[],
  existing: Stock[],
  matchHint: (hint: string) => string | undefined = matchBrokerHint,
): { broker: string; source: BrokerSource } | null {
  // ① 화면 글자 brokerHint → 목록명 (가장 많이 나온 것)
  const tally = new Map<string, number>();
  for (const it of items) {
    const m = matchHint(it.brokerHint ?? "");
    if (m) tally.set(m, (tally.get(m) ?? 0) + 1);
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return { broker: top[0], source: "hint" };

  // ② 티커의 과반이 같은 broker 값을 가진 기존 항목과 일치
  const withTicker = items.filter((i) => tickerKey(i.ticker));
  if (withTicker.length === 0) return null;
  const perBroker = new Map<string, { literal: string; count: number }>();
  for (const it of withTicker) {
    const brokers = new Map<string, string>();
    for (const e of existing) {
      if (tickerKey(e.ticker) !== tickerKey(it.ticker) || isUnassignedBroker(e.broker)) continue;
      brokers.set(squash(e.broker!), e.broker!);
    }
    for (const [k, literal] of brokers) {
      const cur = perBroker.get(k);
      perBroker.set(k, { literal, count: (cur?.count ?? 0) + 1 });
    }
  }
  const winners = [...perBroker.values()].filter((v) => v.count * 2 > withTicker.length);
  return winners.length === 1 ? { broker: winners[0].literal, source: "existing" } : null;
}

/** 장 국내 계좌: 그 장에서 일치한 기존 항목의 과반 category, 없으면 일반(domestic) */
export function inferScreenAccount(items: RawScreenItem[], existing: Stock[], broker: string | undefined): Stock["category"] {
  const tally = new Map<Stock["category"], number>();
  let local = 0;
  for (const it of items) {
    if (it.section === "해외" || it.category === "foreign") continue;
    local += 1;
    const hit = existing.find(
      (e) =>
        DOMESTIC_FAMILY.has(e.category) &&
        !!tickerKey(it.ticker) &&
        tickerKey(e.ticker) === tickerKey(it.ticker) &&
        (broker ? sameBroker(e.broker, broker) : true),
    );
    if (hit) tally.set(hit.category, (tally.get(hit.category) ?? 0) + 1);
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] * 2 > local) return top[0];
  // 기타 section(연금 계좌 화면)은 서버가 irp로 분류한다 — 근거 없으면 그 분류를 따른다
  if (items.some((i) => i.section === "기타" && i.category === "irp") && !top) return "irp";
  return "domestic";
}

export type LinkKind = "exact" | "category" | "unassigned" | "name";

export type MatchResult =
  | { kind: "none" }
  | { kind: "linked"; stock: Stock; linkedBy: LinkKind }
  /** crossType: 고른 유형에는 같은 티커가 없고 같은 증권사의 다른 유형에만 있다(조용히 연결하지 않고 묻는다, 새로 추가 선택지 제공) */
  | { kind: "ambiguous"; candidates: Stock[]; crossType?: boolean };

export interface MatchTarget {
  ticker: string;
  name: string;
  category: Stock["category"];
  broker: string;
}

/**
 * 기존 항목 찾기 ①①'②③④. `used`는 이미 다른 행에 연결된 id(같은 장 중복 행이 한 줄에 몰리지 않게).
 * `sameKeyRows`는 같은 키를 가진 장 내 행 수 — 후보가 그 수 이상이면 순서대로 짝짓고, 아니면 ④.
 */
export function matchExisting(
  t: MatchTarget,
  existing: Stock[],
  used: Set<string> = new Set(),
  sameKeyRows = 1,
): MatchResult {
  const pool = existing.filter((e) => !used.has(e.id) && e.category !== "unlisted");
  const finish = (c: Stock[], kind: LinkKind): MatchResult | null => {
    if (c.length === 0) return null;
    if (c.length === 1 || c.length <= sameKeyRows) return { kind: "linked", stock: c[0], linkedBy: kind };
    return { kind: "ambiguous", candidates: c };
  };
  const tk = tickerKey(t.ticker);

  if (tk) {
    const byTicker = pool.filter((e) => tickerKey(e.ticker) === tk);
    // ① 티커·category·broker
    const r1 = finish(byTicker.filter((e) => e.category === t.category && sameBroker(e.broker, t.broker)), "exact");
    if (r1) {
      // 고른 유형 안에서 묻게 되는 경우: 같은 증권사·같은 티커의 다른 유형(IRP 등) 항목도 후보에 넣는다(고른 유형 먼저, 5.101)
      if (r1.kind === "ambiguous") {
        const rest = byTicker.filter((e) => e.category !== t.category && sameBroker(e.broker, t.broker));
        return { kind: "ambiguous", candidates: [...r1.candidates, ...rest] };
      }
      return r1;
    }
    // ①' 티커+broker, category만 다름 — 사용자가 고른 유형에 없으면 다른 유형 항목을 조용히 연결하지 않고 묻는다(5.101)
    const other = byTicker.filter((e) => sameBroker(e.broker, t.broker));
    if (other.length > 0) return { kind: "ambiguous", candidates: other, crossType: true };
    // ② 같은 티커·category, broker 미지정
    const r3 = finish(byTicker.filter((e) => e.category === t.category && isUnassignedBroker(e.broker)), "unassigned");
    if (r3) return r3;
    return { kind: "none" };
  }

  // ③ 티커 미인식 — 종목명(공백 무시) 정확 일치, 증권사 일치 또는 미지정
  const nk = nameKey(t.name);
  if (!nk) return { kind: "none" };
  const byName = pool.filter(
    (e) => nameKey(e.name) === nk && (sameBroker(e.broker, t.broker) || isUnassignedBroker(e.broker)),
  );
  return finish(byName, "name") ?? { kind: "none" };
}
