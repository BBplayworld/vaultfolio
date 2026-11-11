// 새 소식 정적 목록(#159) 형식 검사 — 새 항목을 추가할 때마다 이 테스트가 규칙을 지키는지 본다.
import { describe, expect, it } from "vitest";
import { WHATS_NEW } from "../whats-new";
import { APP_FEATURES } from "../app-features";
import { compareIds, parseEntryId } from "@/lib/whats-new";
import { todayKst } from "@/lib/tax-utils";

const FORBIDDEN: [string, RegExp][] = [
  ["금액", /\d[\d,.]*\s*(원|만|억)/],
  ["투자 판단", /사도|팔아|싸다|비싸다|물타기|추천/],
  ["과장", /완벽|혁신/],
  ["보장", /안전|보호|차단/],
];

describe("WHATS_NEW 데이터 형식", () => {
  it("id는 YYYYMMDD-NN(순번 01~99), 실제 날짜, 중복 없음", () => {
    for (const e of WHATS_NEW) {
      expect(e.id).toMatch(/^\d{8}-(0[1-9]|[1-9]\d)$/);
      expect(parseEntryId(e.id)).not.toBeNull();
    }
    expect(new Set(WHATS_NEW.map((e) => e.id)).size).toBe(WHATS_NEW.length);
  });

  it("정렬: 날짜 내림차순, 같은 날은 NN 오름차순", () => {
    for (let i = 1; i < WHATS_NEW.length; i++) {
      const a = parseEntryId(WHATS_NEW[i - 1].id)!;
      const b = parseEntryId(WHATS_NEW[i].id)!;
      expect(a.date >= b.date).toBe(true);
      if (a.date === b.date) expect(a.seq < b.seq).toBe(true);
    }
  });

  it("미래 날짜 없음(KST 오늘 이하)", () => {
    const today = Number(todayKst().replaceAll("-", ""));
    for (const e of WHATS_NEW) expect(parseEntryId(e.id)!.date).toBeLessThanOrEqual(today);
  });

  it("featureId는 APP_FEATURES에 실제로 있다", () => {
    const ids = new Set(APP_FEATURES.map((f) => f.id));
    for (const e of WHATS_NEW) if (e.featureId) expect(ids.has(e.featureId), e.id).toBe(true);
  });

  it("길이: title 2~32자, body 48자 이하", () => {
    for (const e of WHATS_NEW) {
      expect(e.title.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.title.length, e.id).toBeLessThanOrEqual(32);
      if (e.body !== undefined) expect(e.body.length, e.id).toBeLessThanOrEqual(48);
    }
  });

  it.each(FORBIDDEN)("%s 어휘 없음", (_name, re) => {
    for (const e of WHATS_NEW) {
      expect(re.test(e.title), `${e.id} title`).toBe(false);
      expect(re.test(e.body ?? ""), `${e.id} body`).toBe(false);
    }
  });

  it("목록 정렬이 compareIds 기준과 일치(큰 id가 위)", () => {
    for (let i = 1; i < WHATS_NEW.length; i++) {
      // 같은 날 안에서는 NN 오름차순이 표시 순서이므로 날짜만 비교한다
      expect(parseEntryId(WHATS_NEW[i - 1].id)!.date).toBeGreaterThanOrEqual(parseEntryId(WHATS_NEW[i].id)!.date);
    }
    expect(compareIds("20261111-02", "20261111-01")).toBeGreaterThan(0);
  });
});
