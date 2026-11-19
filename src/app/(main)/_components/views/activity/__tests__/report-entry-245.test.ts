// #245(5.130) 점검 한 장 외부 열기(1회용 대상)와 성과 화면 뒤로가기 분기 — 순수 함수.
import { beforeEach, describe, expect, it } from "vitest";
import { aimGrowStockView, clearGrowOpenKey, getGrowView, getReportTab, peekGrowOpenKey, resetReportTab, setGrowView, setReportTab } from "../report-tab";
import { getBackLabel, reportBackAction, reportEntryFromDetail, type AssetView } from "../../../layout/navigation/navigation-context";

beforeEach(() => resetReportTab());

describe("report-tab — 주식 보기로 겨누기", () => {
  it("진입(이름표 키) — 기본 칸·주식 보기·대상 키", () => {
    setReportTab("grade");
    setGrowView("crypto");
    aimGrowStockView("AAPL");
    expect([getReportTab(), getGrowView(), peekGrowOpenKey()]).toEqual(["grow", "stock", "AAPL"]);
  });
  it("타일(키 없음) — 주식 보기 목록만, 앞서 남은 대상은 지운다", () => {
    aimGrowStockView("AAPL");
    aimGrowStockView();
    expect([getGrowView(), peekGrowOpenKey()]).toEqual(["stock", null]);
  });
  it("대상은 1회용 — 읽어도 남고(초기값), 비우면 사라진다(마운트 effect)", () => {
    aimGrowStockView("005930");
    expect(peekGrowOpenKey()).toBe("005930");
    expect(peekGrowOpenKey()).toBe("005930");
    clearGrowOpenKey();
    expect(peekGrowOpenKey()).toBeNull();
    expect(getGrowView()).toBe("stock"); // 보기는 종목 페이지에 다녀와도 그대로
  });
  it("허브·홈 팁(resetReportTab)은 대상과 보기를 비운다 — 규칙(차례가 있는 첫 보기)대로 다시 정한다", () => {
    aimGrowStockView("005930");
    resetReportTab();
    expect([getReportTab(), getGrowView(), peekGrowOpenKey()]).toEqual(["grow", null, null]);
  });
});

const REPORT: AssetView = { type: "activity", tab: "report" };
describe("성과 › 자산 성적표·불리기 뒤로가기", () => {
  it("상세(상세·주식·종목 한 장)에서 들어오면 참, 허브·홈에서 들어오면 거짓", () => {
    expect(reportEntryFromDetail({ type: "detail", tab: "stocks" }, REPORT, false)).toBe(true);
    expect(reportEntryFromDetail({ type: "detail", tab: "stocks-item" }, REPORT, false)).toBe(true);
    expect(reportEntryFromDetail({ type: "activity", tab: "hub" }, REPORT, true)).toBe(false);
    expect(reportEntryFromDetail({ type: "home" }, REPORT, true)).toBe(false);
  });
  it("다른 화면으로 가는 이동은 값을 바꾸지 않는다(종목 페이지에 다녀와 pop으로 돌아와도 유지)", () => {
    expect(reportEntryFromDetail(REPORT, { type: "detail", tab: "stocks-item" }, true)).toBe(true);
    expect(reportEntryFromDetail(REPORT, { type: "home" }, false)).toBe(false);
  });
  it("상세에서 들어왔고 돌아갈 기록이 있으면 pop, 아니면 성과 허브(기존 동작)", () => {
    expect(reportBackAction(true, 3)).toBe("pop");
    expect(reportBackAction(true, 1)).toBe("hub");
    expect(reportBackAction(false, 5)).toBe("hub");
  });
  it("상단 라벨 — 상세에서 들어오면 `뒤로`, 그 밖은 `성과` 그대로. 다른 화면 라벨은 불변", () => {
    expect(getBackLabel(REPORT, undefined, true)).toBe("뒤로");
    expect(getBackLabel(REPORT, undefined, false)).toBe("성과");
    expect(getBackLabel(REPORT)).toBe("성과");
    expect(getBackLabel({ type: "activity", tab: "change" }, undefined, true)).toBe("성과");
    expect(getBackLabel({ type: "detail", tab: "stocks" }, undefined, true)).toBe("상세");
    expect(getBackLabel({ type: "detail", tab: "stocks-item" }, "stocks", true)).toBe("주식");
  });
});
