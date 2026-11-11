// 새 소식 판정(#159) — id 숫자 비교·안 본 항목·7일 간격·읽음 기록 해석·조용한 첫 기록(S7)
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareIds, parseEntryId, unseenEntries, sheetEntries, whatsNewTip, shouldSilentFirstRun, readSeen, markWhatsNewSeen, newBadgeIds,
  WHATS_NEW_GAP_MS, latestEntryId, runSilentFirstRun,
} from "../whats-new";
import { WHATS_NEW, type WhatsNewEntry } from "@/config/whats-new";

const DAY = 24 * 60 * 60 * 1000;
const e = (id: string): WhatsNewEntry => ({ id, title: `t${id}` });

describe("parseEntryId·compareIds — 문자열 비교 금지", () => {
  it("순번 없는 옛 id는 seq 0, 형식·날짜가 틀리면 null", () => {
    expect(parseEntryId("20260924")).toEqual({ date: 20260924, seq: 0 });
    expect(parseEntryId("20261112-03")).toEqual({ date: 20261112, seq: 3 });
    for (const bad of ["", "2026-11-12", "20261340", "20260230-01", "abc", "20261112-1", null, 5]) expect(parseEntryId(bad)).toBeNull();
  });
  it("-10 > -09, 20260924 < 20261112-01, 날짜가 순번보다 먼저", () => {
    expect(compareIds("20261112-10", "20261112-09")).toBeGreaterThan(0);
    expect(compareIds("20260924", "20261112-01")).toBeLessThan(0);
    expect(compareIds("20261113-01", "20261112-99")).toBeGreaterThan(0);
    expect(compareIds("20261112-01", "20261112-01")).toBe(0);
  });
});

describe("안 본 항목·시트 목록", () => {
  const today = "2026-11-15";
  it("기록 없음 → 최근 30일 전부, 30일 초과는 제외(경계 30일 포함)", () => {
    const list = [e("20261115-01"), e("20261016-01"), e("20261015-01")]; // 30일 전 · 31일 전
    expect(unseenEntries(list, null, today).map((x) => x.id)).toEqual(["20261115-01", "20261016-01"]);
  });
  it("기록 id보다 큰 것만(같은 날 순번 포함)", () => {
    const list = [e("20261115-02"), e("20261115-01"), e("20261110-01")];
    expect(unseenEntries(list, { id: "20261115-01", seenAt: 0 }, today).map((x) => x.id)).toEqual(["20261115-02"]);
  });
  it("9월 공지 id 기록(20260924)은 새 소식 전부를 안 본 것으로", () => {
    expect(unseenEntries(WHATS_NEW, { id: "20260924", seenAt: 1 }, "2026-11-12")).toHaveLength(WHATS_NEW.length);
  });
  it("시트 목록: 60일 이내·위에서 20개", () => {
    const many = Array.from({ length: 25 }, (_, i) => e(`20261115-${String(99 - i).padStart(2, "0")}`));
    expect(sheetEntries(many, today)).toHaveLength(20);
    expect(sheetEntries([e("20260916-01"), e("20260915-01")], today).map((x) => x.id)).toEqual(["20260916-01"]); // 60일 전 포함·61일 전 제외
    expect(sheetEntries([], today)).toEqual([]);
  });
});

describe("whatsNewTip — 7일 간격", () => {
  const today = "2026-11-12";
  const now = Date.parse("2026-11-12T00:00:00Z");
  const opts = { now, today };
  it("기록 없음 + 시드 전부 → 새 소식 전부, 설명은 맨 위 항목", () => {
    expect(whatsNewTip(null, opts)).toEqual({ count: WHATS_NEW.length, title: "합친 평단을 가격 흐름 위에서 봐요" });
  });
  it("seenAt 6일 23:59 전이면 없음, 7일 정각이면 새 항목만 센다", () => {
    expect(whatsNewTip({ id: "20261111-07", seenAt: now - WHATS_NEW_GAP_MS + 60_000 }, opts)).toBeNull();
    expect(whatsNewTip({ id: "20261111-07", seenAt: now - WHATS_NEW_GAP_MS }, opts)).toEqual({ count: WHATS_NEW.length - 7, title: WHATS_NEW[7].title });
  });
  it("최신까지 읽었거나 목록이 비면 없음", () => {
    expect(whatsNewTip({ id: "20261111-12", seenAt: now - 40 * DAY }, opts)).toBeNull();
    expect(whatsNewTip(null, { ...opts, entries: [] })).toBeNull();
  });
  it("4.82 시드: 팁 N과 시트 '새' 개수가 같고, 읽은 뒤 재열기는 0", () => {
    expect([...newBadgeIds(WHATS_NEW, null, today)]).toEqual(WHATS_NEW.map((x) => x.id));
    expect(newBadgeIds(WHATS_NEW, null, today).size).toBe(whatsNewTip(null, { now, today })!.count);
    expect(newBadgeIds(WHATS_NEW, { id: "20261111-12", seenAt: now }, today).size).toBe(0);
  });
});

describe("shouldSilentFirstRun(S7)", () => {
  const base = { isDataLoaded: true, hasAssets: false, hasRecord: false, eligible: true, hasEntries: true };
  it("불러오기 전(isDataLoaded=false)이면 쓰지 않는다 — 기존 사용자 전원 읽음 처리 방지", () => {
    expect(shouldSilentFirstRun({ ...base, isDataLoaded: false })).toBe(false);
  });
  it("불러온 뒤 자산이 있으면 쓰지 않는다", () => {
    expect(shouldSilentFirstRun({ ...base, hasAssets: true })).toBe(false);
  });
  it("불러온 뒤 자산 0 + 기록 없음이면 쓴다", () => {
    expect(shouldSilentFirstRun(base)).toBe(true);
  });
  it("목록이 비면·기록이 있으면·체험·잠금이면 쓰지 않는다", () => {
    expect(shouldSilentFirstRun({ ...base, hasEntries: false })).toBe(false);
    expect(shouldSilentFirstRun({ ...base, hasRecord: true })).toBe(false);
    expect(shouldSilentFirstRun({ ...base, eligible: false })).toBe(false);
  });
});

describe("읽음 기록 키 — 이전 값 → 새 로직(복원)", () => {
  const store = new Map<string, string>();
  const KEY = "secretasset_notice_seen";
  beforeEach(() => {
    store.clear();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
  });
  it("구 값 {id:20260924, seenAt, expiresAt}은 그대로 읽힌다", () => {
    store.set(KEY, JSON.stringify({ id: "20260924", seenAt: 1000, expiresAt: Date.now() + DAY }));
    expect(readSeen()).toEqual({ id: "20260924", seenAt: 1000 });
  });
  it("만료·깨진 JSON·빈 객체(체험 원본)·해석 불가 id·id 비문자열은 기록 없음, 예외 없음", () => {
    store.set(KEY, JSON.stringify({ id: "20260924", seenAt: 1, expiresAt: Date.now() - 1 }));
    expect(readSeen()).toBeNull();
    for (const raw of ["{not json", "{}", JSON.stringify({ id: "n1", seenAt: 1, expiresAt: 9e15 }), JSON.stringify({ id: 5 }), "null"]) {
      store.set(KEY, raw);
      expect(readSeen()).toBeNull();
    }
    store.delete(KEY);
    expect(readSeen()).toBeNull();
  });
  it("markWhatsNewSeen은 목록 최신 id + 지금 seenAt + 만료 90일로 쓰고, 목록이 비면 쓰지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
    markWhatsNewSeen([]);
    expect(store.get(KEY)).toBeUndefined();
    markWhatsNewSeen(WHATS_NEW);
    const v = JSON.parse(store.get(KEY)!);
    expect(v.id).toBe(latestEntryId(WHATS_NEW));
    expect(v.seenAt).toBe(Date.now());
    expect(v.expiresAt).toBe(Date.now() + 90 * DAY);
    vi.useRealTimers();
  });

  it("latestEntryId는 같은 날 NN 최대값(D1) — 정렬 순서와 무관", () => {
    expect(latestEntryId(WHATS_NEW)).toBe("20261111-12");
    expect(latestEntryId([e("20261111-01"), e("20261111-10"), e("20261111-09"), e("20261110-99")])).toBe("20261111-10");
    expect(latestEntryId([])).toBeNull();
  });

  it("D2 웰컴 화면(자산 0): 불러오기 후 기록, 이후 첫 자산 등록해도 새 소식 팁 없음", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
    expect(runSilentFirstRun({ isDataLoaded: false, hasAssets: false, eligible: true })).toBe(false); // 로드 전
    expect(store.get(KEY)).toBeUndefined();
    expect(runSilentFirstRun({ isDataLoaded: true, hasAssets: false, eligible: true })).toBe(true);
    expect(JSON.parse(store.get(KEY)!).id).toBe("20261111-12");
    expect(whatsNewTip(readSeen(), { today: "2026-11-12" })).toBeNull(); // 자산 등록 뒤 Dashboard 첫 마운트 시점
    vi.setSystemTime(new Date("2026-11-30T00:00:00Z"));
    expect(whatsNewTip(readSeen(), { today: "2026-11-30" })).toBeNull();
    vi.useRealTimers();
  });

  it("D2 기존 사용자(자산 있음)·체험·잠금은 쓰지 않는다", () => {
    expect(runSilentFirstRun({ isDataLoaded: true, hasAssets: true, eligible: true })).toBe(false);
    expect(runSilentFirstRun({ isDataLoaded: true, hasAssets: false, eligible: false })).toBe(false);
    expect(store.get(KEY)).toBeUndefined();
  });

  it("D2 배선(grep): 조용한 기록은 항상 마운트되는 WhatsNewHost에 있고 HomeTipBox엔 없다", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../app/(main)/_components/views/home");
    expect(readFileSync(path.join(dir, "whats-new-sheet.tsx"), "utf8")).toContain("runSilentFirstRun(");
    expect(readFileSync(path.join(dir, "home-tip-box.tsx"), "utf8")).not.toContain("shouldSilentFirstRun");
  });
});

describe("시트 닫힘 후 포커스 (4.84 D2) — 더보기 Esc 후 body로 떨어지지 않는다", () => {
  const fakeMain = () => {
    const attrs = new Map<string, string>();
    const doc = { activeElement: null as unknown };
    const main = {
      hasAttribute: (k: string) => attrs.has(k),
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      focus: () => { doc.activeElement = main; },
    };
    return { doc: Object.assign(doc, { querySelector: (sel: string) => (sel === "main" ? main : null) }), main, attrs };
  };
  it("더보기 경로(이동 아님): Esc 닫기 후 activeElement === main, tabindex=-1, 기본 복귀는 막는다", async () => {
    const { restoreFocusAfterSheetClose } = await import("../whats-new");
    const { doc, main, attrs } = fakeMain();
    let prevented = false;
    restoreFocusAfterSheetClose({ preventDefault: () => { prevented = true; } }, false, doc as unknown as Document);
    expect(prevented).toBe(true);
    expect(doc.activeElement).toBe(main);
    expect(attrs.get("tabindex")).toBe("-1");
  });
  it("홈 팁 경로도 같은 결과, 바로 가기로 이동한 경우(gone)는 포커스를 건드리지 않는다", async () => {
    const { restoreFocusAfterSheetClose } = await import("../whats-new");
    const a = fakeMain();
    restoreFocusAfterSheetClose({ preventDefault: () => {} }, false, a.doc as unknown as Document);
    expect(a.doc.activeElement).toBe(a.main);
    const b = fakeMain();
    let prevented = false;
    restoreFocusAfterSheetClose({ preventDefault: () => { prevented = true; } }, true, b.doc as unknown as Document);
    expect(prevented).toBe(true);
    expect(b.doc.activeElement).toBeNull();
  });
  it("호스트가 source 구분 없이 이 함수를 쓴다(홈 팁만 main으로 보내던 분기 제거)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/(main)/_components/views/home/whats-new-sheet.tsx", "utf8");
    expect(src).toContain("restoreFocusAfterSheetClose(e, goneRef.current)");
    expect(src).not.toContain('sourceRef.current === "home_tip"');
  });
});

describe("X 버튼 히트 영역 40px (4.84 D1) — 클래스 계약(실측은 qa elementFromPoint)", () => {
  it("홈 팁 X 박스 = 16 + p-3×2 = 40, 시트 X는 ::after 확장(아이콘 20 + 10×2, sm 24 + 8×2)", async () => {
    const { readFileSync } = await import("node:fs");
    const tip = readFileSync("src/app/(main)/_components/views/home/home-tip-box.tsx", "utf8");
    expect(tip).toMatch(/data-testid="home-tip-close"\s+className="shrink-0 -m-3 p-3 /);
    const sheet = readFileSync("src/components/ui/sheet.tsx", "utf8");
    expect(sheet).toContain("after:absolute after:-inset-2.5");
    expect(sheet).toContain("sm:after:-inset-2");
  });
});
