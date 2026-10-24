// 국내 상장 ETF 전 종목 — 스크린샷 종목명 → 티커 매칭 점검(정확명 + OCR 오타 시뮬레이션)
import { describe, it, expect } from "vitest";
import etfMaster from "@/lib/data/kr-etf-master.json";
import { lookupTicker, fuzzyLookupKr } from "@/app/api/parse-screenshot/ticker-map";
import { KR_NAME_TO_CODE } from "@/lib/finance/kr-master";
import { normalizeStockName } from "@/lib/name-match";

const ETF = etfMaster as { code: string; name: string }[];

// 정규화 후 같은 키가 되는 국내 종목명(충돌) — 정확명 점검에서 제외
const normCount = new Map<string, number>();
for (const n of Object.keys(KR_NAME_TO_CODE)) {
  const k = normalizeStockName(n);
  normCount.set(k, (normCount.get(k) ?? 0) + 1);
}
const isCollision = (name: string) => (normCount.get(normalizeStockName(name)) ?? 0) > 1;

// OCR 오타 시뮬레이션: 중간·2/3 지점 한 글자 누락, 중간 한 글자 치환
function typoVariants(name: string): string[] {
  const n = normalizeStockName(name);
  if (n.length < 6) return [];
  const mid = Math.floor(n.length / 2);
  const twoThird = Math.floor((n.length * 2) / 3);
  return [
    n.slice(0, mid) + n.slice(mid + 1),
    n.slice(0, twoThird) + n.slice(twoThird + 1),
    n.slice(0, mid) + "□" + n.slice(mid + 1),
  ];
}

describe("국내 ETF 종목명 → 티커 매칭", () => {
  it("회귀: OCR 오타·줄바꿈 종목명", () => {
    expect(lookupTicker("SOL 미국TOP5채권합50")).toBe(KR_NAME_TO_CODE["SOL 미국TOP5채권혼합50"]);
    expect(lookupTicker("ACE 미국나스닥1 00")).toBe(KR_NAME_TO_CODE["ACE 미국나스닥100"]);
  });

  it("정확명은 전 종목 자기 코드로 매칭", () => {
    const wrong = ETF.filter((e) => !isCollision(e.name) && lookupTicker(e.name) !== e.code);
    if (wrong.length > 0) console.log("정확명 오매칭", wrong.slice(0, 20));
    expect(wrong).toEqual([]);
  });

  it("오타 보정 단계는 다른 종목으로 오매칭하지 않는다", () => {
    const keys = new Set(Object.keys(KR_NAME_TO_CODE).map(normalizeStockName));
    let total = 0, hit = 0, miss = 0;
    const wrong: { name: string; typo: string; got: string }[] = [];
    for (const e of ETF) {
      if (isCollision(e.name)) continue;
      for (const typo of typoVariants(e.name)) {
        if (keys.has(typo)) continue; // 오타가 다른 실존 종목명과 동일 — 판별 불가
        total++;
        const got = fuzzyLookupKr(typo);
        if (got === e.code) hit++;
        else if (!got) miss++;
        else wrong.push({ name: e.name, typo, got });
      }
    }
    console.log(`[오타 보정 단계] 전체 ${total} · 적중 ${hit} · 미결정(동률) ${miss} · 오매칭 ${wrong.length}`);
    expect(wrong).toEqual([]);
  }, 60_000);

  it("전체 lookupTicker 오타 — 다른 종목으로 오매칭하지 않는다", () => {
    const keys = new Set(Object.keys(KR_NAME_TO_CODE).map(normalizeStockName));
    const keyList = [...keys];
    let total = 0, hit = 0, miss = 0, ambiguous = 0;
    const wrong: { name: string; typo: string; got: string }[] = [];
    for (const e of ETF) {
      if (isCollision(e.name)) continue;
      const own = normalizeStockName(e.name);
      for (const typo of typoVariants(e.name)) {
        if (keys.has(typo)) continue;
        // 오타가 다른 실존 종목명의 앞부분과 같음 = 잘린 이름과 구별 불가(예: "TIGER K게임"→"tiger게임" vs "TIGER 게임TOP10")
        if (keyList.some((k) => k !== own && k.startsWith(typo))) { ambiguous++; continue; }
        total++;
        const got = lookupTicker(typo);
        if (got === e.code) hit++;
        else if (!got) miss++;
        else wrong.push({ name: e.name, typo, got });
      }
    }
    console.log(`[lookupTicker] 전체 ${total} · 적중 ${hit} · 미매칭 ${miss} · 오매칭 ${wrong.length} · 잘린 이름과 구별 불가(제외) ${ambiguous}`);
    if (wrong.length > 0) console.log("오매칭 예시", wrong.slice(0, 15));
    expect(wrong).toEqual([]);
  }, 60_000);

  it("회귀: 동률 오타는 suffix 단계로 다른 종목에 매칭하지 않는다", () => {
    expect(lookupTicker("kodex200ttr")).not.toBe(KR_NAME_TO_CODE["KODEX 200"]);
    expect(lookupTicker("PLUS 고배당주위클리정커버드콜")).not.toBe("161510");
  });

  it("잘린 이름(끝 1~3자 누락) 리포트", () => {
    let total = 0, hit = 0, miss = 0, other = 0;
    for (const e of ETF) {
      if (isCollision(e.name)) continue;
      const n = normalizeStockName(e.name);
      for (const cut of [1, 2, 3]) {
        if (n.length - cut < 6) continue;
        total++;
        const got = lookupTicker(n.slice(0, n.length - cut));
        if (got === e.code) hit++;
        else if (!got) miss++;
        else other++; // 잘린 이름이 다른 종목명의 앞부분과 겹치면 판별 불가(최단 키 선택)
      }
    }
    console.log(`[잘린 이름] 전체 ${total} · 적중 ${hit} · 미매칭 ${miss} · 다른 종목 ${other}`);
    expect(total).toBeGreaterThan(0);
  }, 60_000);
});
