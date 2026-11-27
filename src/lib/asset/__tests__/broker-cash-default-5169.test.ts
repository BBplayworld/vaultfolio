// #339(5.169) 배당 입금 폼 계좌 기본값 — 증권사 현금 정확 일치(5.167 규칙) + 통화 가드.
// C162: 종목 broker 값은 실제 쓰기 경로로 만든다 — 직접 입력·나눠 담기(목록 Select, '선택 안 함'=undefined), 매매 새 종목(buildPickedStockDraft),
// 맞추기·스크린샷(confirmScreenBroker: 화면 글자 → 목록명 / 기존 자유 텍스트 그대로).
import { describe, expect, it } from "vitest";
import type { Cash, Stock } from "@/types/asset";
import { brokerCashDefault, nextAutoCash } from "../broker-totals";
import { buildPickedStockDraft } from "@/lib/trade/new-stock";
import { confirmScreenBroker } from "@/lib/asset/resync/match";
import type { RawScreenItem } from "@/lib/asset/resync/types";

const cash = (id: string, institution: string | undefined, currency: Cash["currency"] = "KRW", balance = 100_000) =>
  ({ id, name: id, type: "cma", balance, currency, institution }) as Cash;
const draft = (broker: string, o: Partial<Stock> = {}): Stock =>
  ({ ...buildPickedStockDraft(`s-${broker}`, { ticker: "005930", name: "삼성전자", market: "kr" }, { broker, category: "domestic" }), quantity: 10, ...o });
const screenItem = (brokerHint: string): RawScreenItem =>
  ({ name: "삼성전자", ticker: "005930", quantity: 1, averagePrice: 1, currentPrice: 1, category: "domestic", section: "국내", brokerHint }) as RawScreenItem;
// 맞추기 경로로 붙는 broker 값
const viaScreenHint = (hint: string) => confirmScreenBroker([screenItem(hint)], [])!.broker;
const viaScreenExisting = (literal: string) => confirmScreenBroker([screenItem("")], [draft(literal)])!.broker;
// 직접 입력 폼 '선택 안 함'(__none__ → undefined)
const unassigned = (o: Partial<Stock> = {}) => ({ ...draft("키움증권", o), broker: undefined }) as Stock;

const KIWOOM_KRW = cash("kw-krw", "키움증권", "KRW", 0); // 잔액 0도 대상
const KIWOOM_USD = cash("kw-usd", "키움증권", "USD");
const KIWOOM_PART = cash("kw-part", "키움"); // 부분 일치 → 대상 아님
const HANA_BANK = cash("hana-bank", "하나은행");
const HANA_SEC = cash("hana-sec", "하나증권");
const NONE = cash("none", undefined);

describe("쓰기 경로 broker 값 확인(픽스처 전제)", () => {
  it("화면 글자 '키움' → 목록명 '키움증권', 기존 자유 텍스트는 글자 그대로", () => {
    expect(viaScreenHint("키움")).toBe("키움증권");
    expect(viaScreenExisting("키움")).toBe("키움");
    expect(viaScreenExisting("연금저축")).toBe("연금저축");
  });
});

describe("brokerCashDefault", () => {
  it("목록 값 증권사 + 같은 이름 현금 1개 → 그 계좌(잔액 0 포함), 부분 일치·은행·미지정 기관은 무시", () => {
    expect(brokerCashDefault([draft("키움증권")], [KIWOOM_KRW, KIWOOM_PART, HANA_BANK, NONE])).toBe("kw-krw");
  });
  it("공백 섞인 기관명도 정확 일치로 본다", () => {
    expect(brokerCashDefault([draft("키움증권")], [cash("sp", " 키움 증권 ")])).toBe("sp");
  });
  it("자유 텍스트 '키움'(맞추기 기존 값) → matchBrokerHint로 키움증권, 현금은 정확 일치만", () => {
    const st = draft(viaScreenExisting("키움"));
    expect(brokerCashDefault([st], [KIWOOM_KRW])).toBe("kw-krw");
    expect(brokerCashDefault([st], [KIWOOM_PART])).toBeNull();
  });
  it("화면 글자 경로(목록명) → 같은 결과", () => {
    expect(brokerCashDefault([draft(viaScreenHint("키움"))], [KIWOOM_KRW])).toBe("kw-krw");
  });
  it("같은 증권사 계좌 2개 → 종목 통화와 같은 통화 1개면 그 계좌", () => {
    expect(brokerCashDefault([draft("키움증권")], [KIWOOM_KRW, KIWOOM_USD])).toBe("kw-krw");
    const us = draft("키움증권", { category: "foreign", ticker: "AAPL", currency: "USD" });
    expect(brokerCashDefault([us], [KIWOOM_KRW, KIWOOM_USD])).toBe("kw-usd");
    // 엔화 종목은 같은 통화 계좌가 없어 기본값 없음
    const jp = draft("키움증권", { category: "foreign", ticker: "7203", currency: "JPY" });
    expect(brokerCashDefault([jp], [KIWOOM_KRW, KIWOOM_USD])).toBeNull();
    // 같은 통화 2개 → 없음
    expect(brokerCashDefault([draft("키움증권")], [KIWOOM_KRW, cash("kw-krw2", "키움증권")])).toBeNull();
  });
  it("해외·엔화 종목도 현금 1개면 통화와 무관하게 그 계좌(판정은 화면 통화 가드가 맡는다)", () => {
    const jp = draft("키움증권", { category: "foreign", ticker: "7203", currency: "JPY" });
    expect(brokerCashDefault([jp], [KIWOOM_KRW])).toBe("kw-krw");
  });
  it("하나증권 종목 ↔ 하나은행/하나증권 현금 → 하나증권만", () => {
    expect(brokerCashDefault([draft("하나증권")], [HANA_BANK, HANA_SEC])).toBe("hana-sec");
    expect(brokerCashDefault([draft("하나증권")], [HANA_BANK])).toBeNull();
  });
  it("미지정('선택 안 함'·빈 문자열·항목 N)·'기타'·목록 밖 자유 텍스트 → 없음", () => {
    expect(brokerCashDefault([unassigned()], [KIWOOM_KRW])).toBeNull();
    expect(brokerCashDefault([draft("")], [KIWOOM_KRW])).toBeNull();
    expect(brokerCashDefault([draft("항목 1")], [KIWOOM_KRW])).toBeNull();
    expect(brokerCashDefault([draft("기타")], [cash("etc", "기타")])).toBeNull();
    expect(brokerCashDefault([draft(viaScreenExisting("연금저축"))], [cash("p", "연금저축")])).toBeNull();
  });
  it("두 증권사에 나뉜 티커 → 없음, 한쪽이 미지정이면 나머지 1곳으로", () => {
    expect(brokerCashDefault([draft("키움증권"), draft("미래에셋증권")], [KIWOOM_KRW, cash("m", "미래에셋증권")])).toBeNull();
    expect(brokerCashDefault([draft("키움증권"), unassigned()], [KIWOOM_KRW])).toBe("kw-krw");
    expect(brokerCashDefault([draft("키움증권"), draft(viaScreenHint("키움"))], [KIWOOM_KRW])).toBe("kw-krw");
  });
  it("매칭 계좌 0·종목 0 → 없음", () => {
    expect(brokerCashDefault([draft("토스증권")], [KIWOOM_KRW])).toBeNull();
    expect(brokerCashDefault([], [KIWOOM_KRW])).toBeNull();
  });
});

describe("nextAutoCash — 사용자 선택 불변·되돌림·통화 가드", () => {
  const CASH = [KIWOOM_KRW, KIWOOM_USD, HANA_SEC];
  it("빈칸 → 후보로 채움(auto 기록)", () => {
    expect(nextAutoCash({ current: "", auto: null, candidate: "kw-krw", amount: 0, cash: CASH })).toEqual({ cashId: "kw-krw", auto: "kw-krw" });
  });
  it("규칙이 채운 값 → 새 후보로 교체, 후보 없으면 빈칸", () => {
    expect(nextAutoCash({ current: "kw-krw", auto: "kw-krw", candidate: "hana-sec", amount: 0, cash: CASH })).toEqual({ cashId: "hana-sec", auto: "hana-sec" });
    expect(nextAutoCash({ current: "kw-krw", auto: "kw-krw", candidate: null, amount: 0, cash: CASH })).toEqual({ cashId: "", auto: null });
  });
  it("사용자가 고른 값(auto와 다름) → 손대지 않음", () => {
    expect(nextAutoCash({ current: "hana-sec", auto: null, candidate: "kw-krw", amount: 0, cash: CASH })).toBeNull();
    expect(nextAutoCash({ current: "hana-sec", auto: "kw-krw", candidate: null, amount: 0, cash: CASH })).toBeNull();
  });
  it("바뀔 게 없으면 null", () => {
    expect(nextAutoCash({ current: "", auto: null, candidate: null, amount: 0, cash: CASH })).toBeNull();
    expect(nextAutoCash({ current: "kw-krw", auto: "kw-krw", candidate: "kw-krw", amount: 0, cash: CASH })).toBeNull();
  });
  it("통화 가드: 금액 > 0이고 표시 통화가 바뀌면 교체·비움 둘 다 안 함", () => {
    // 빈칸(원) + 금액 입력 뒤 USD 후보 → 그대로
    expect(nextAutoCash({ current: "", auto: null, candidate: "kw-usd", amount: 1_000_000, cash: CASH })).toBeNull();
    // 자동 USD → 원 후보
    expect(nextAutoCash({ current: "kw-usd", auto: "kw-usd", candidate: "kw-krw", amount: 100, cash: CASH })).toBeNull();
    // 자동 USD → 후보 없음(빈칸=원)
    expect(nextAutoCash({ current: "kw-usd", auto: "kw-usd", candidate: null, amount: 100, cash: CASH })).toBeNull();
  });
  it("통화 가드: 금액 > 0이어도 같은 통화면 진행, 금액 0이면 통화가 바뀌어도 진행", () => {
    expect(nextAutoCash({ current: "", auto: null, candidate: "kw-krw", amount: 50_000, cash: CASH })).toEqual({ cashId: "kw-krw", auto: "kw-krw" });
    expect(nextAutoCash({ current: "kw-krw", auto: "kw-krw", candidate: null, amount: 50_000, cash: CASH })).toEqual({ cashId: "", auto: null });
    expect(nextAutoCash({ current: "", auto: null, candidate: "kw-usd", amount: 0, cash: CASH })).toEqual({ cashId: "kw-usd", auto: "kw-usd" });
  });
});
