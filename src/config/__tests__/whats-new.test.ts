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

  it("5.163 거래소별 합계: 블록이 거래소 2곳 이상일 때만 보이므로 바로 가기(featureId) 없이 본문에 조건을 밝힌다(qa D-1, C87)", () => {
    const e = WHATS_NEW.find((x) => x.id === "20261127-01")!;
    expect(e.featureId).toBeUndefined();
    expect(e.body).toContain("2곳\u00a0이상이면");
    expect(e.body).toContain("상세 암호화폐");
  });

  it("5.164 맞추기 합계 대조: 도착 화면 1곳이 없어 바로 가기 없음, 체험은 인식이 막혀 있어 체험 목록에서 숨김(C87·C126)", () => {
    const e = WHATS_NEW.find((x) => x.id === "20261127-02")!;
    expect(e.title).toBe("주식을 맞춘 뒤 증권사 화면 합계와 맞으면 알려 줘요");
    expect(e.body).toBe("증권사 화면의 총 평가금액과 맞춘 결과가 같으면 한\u00a0줄로 알려 줘요");
    expect(e.featureId).toBeUndefined();
    expect(e.trialHidden).toBe(true);
    expect(WHATS_NEW.filter((x) => x.trialHidden).map((x) => x.id)).toEqual(["20261127-02", "20261127-04"]);
  });

  it("5.167 증권사 현금: 현금 줄이 조건부라 바로 가기 없음, 체험 데모 기관에 증권사가 없어 체험 목록에서 숨김(C87·C126)", () => {
    const e = WHATS_NEW.find((x) => x.id === "20261127-04")!;
    expect(e.title).toBe("증권사 현금도 증권사 이름으로 적을\u00a0수 있어요");
    expect(e.body).toBe("현금 금융기관에서 증권사를 고르면 상세 주식 증권사별에 그 증권사 현금이 함께 보여요");
    expect(e.featureId).toBeUndefined();
    expect(e.trialHidden).toBe(true);
  });

  it("5.169 배당 지급일: 폼 안 조건부 버튼이라 바로 가기 없음, 해외 과장 없이 '배당 종목', 체험에서 숨기지 않음, 본문은 하단 `상세`부터 모든 단계(C87·C126·C148)", () => {
    const e = WHATS_NEW.find((x) => x.title === "배당 입금 날짜를 지급일로 채울\u00a0수 있어요")!;
    expect(e.body).toBe("상세 › 현금 › 입출금 기록 › 배당으로 받은 돈에서 종목을 고르면 지급일로 채워요");
    expect(e.body).not.toMatch(/모든|전부|해외/);
    expect(e.featureId).toBeUndefined();
    expect(e.trialHidden).toBeUndefined();
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
