// 새 소식 판정(#159) — id 숫자 비교·안 본 항목·7일 간격·읽음 기록 해석·조용한 첫 기록(S7)
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareIds, parseEntryId, unseenEntries, sheetEntries, whatsNewTip, shouldSilentFirstRun, readSeen, markWhatsNewSeen, newBadgeIds,
  WHATS_NEW_GAP_MS,
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
    expect(unseenEntries(WHATS_NEW, { id: "20260924", seenAt: 1 }, "2026-11-12")).toHaveLength(8);
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
  it("기록 없음 + 시드 8개 → 새 소식 8개, 설명은 맨 위 항목", () => {
    expect(whatsNewTip(null, opts)).toEqual({ count: 8, title: "합친 평단을 가격 흐름 위에서 봐요" });
  });
  it("seenAt 6일 23:59 전이면 없음, 7일 정각이면 새 항목만 센다", () => {
    expect(whatsNewTip({ id: "20261111-07", seenAt: now - WHATS_NEW_GAP_MS + 60_000 }, opts)).toBeNull();
    expect(whatsNewTip({ id: "20261111-07", seenAt: now - WHATS_NEW_GAP_MS }, opts)).toEqual({ count: 1, title: WHATS_NEW[7].title });
  });
  it("최신까지 읽었거나 목록이 비면 없음", () => {
    expect(whatsNewTip({ id: "20261111-08", seenAt: now - 40 * DAY }, opts)).toBeNull();
    expect(whatsNewTip(null, { ...opts, entries: [] })).toBeNull();
  });
  it("4.82 시드: 위 5개에만 '새' 표시", () => {
    expect([...newBadgeIds(WHATS_NEW, null, today)]).toEqual(WHATS_NEW.slice(0, 5).map((x) => x.id));
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
    expect(v.id).toBe(WHATS_NEW[0].id);
    expect(v.seenAt).toBe(Date.now());
    expect(v.expiresAt).toBe(Date.now() + 90 * DAY);
    vi.useRealTimers();
  });
});
