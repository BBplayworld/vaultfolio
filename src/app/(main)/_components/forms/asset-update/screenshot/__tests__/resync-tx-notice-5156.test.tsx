// #310(5.156) 맞추기 미리보기 거래 기록 고지 — 삭제·이관 상태별 문구(ui.md 10절). 정적 렌더(jsdom 없음)
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KindCtx, ReconcileLines, ResyncTxNotice } from "../holdings-resync-dialog";

const html = (clearing: boolean, transferring: boolean) => renderToStaticMarkup(<ResyncTxNotice clearing={clearing} transferring={transferring} />);
const KEEP = "거래 기록은 그대로 남아요.";
const CLEAR = "지우는 종목은 거래 기록도 함께 정리돼요";
const MOVE = "옮기는 종목의 거래 기록은 새 증권사 종목으로 이어져요";

describe("ResyncTxNotice", () => {
  it("삭제 0·이관 0: 현행 문구만", () => {
    const h = html(false, false);
    expect(h).toContain(KEEP);
    expect(h).toContain('data-testid="resync-notice-1"');
    expect(h).not.toContain(CLEAR);
    expect(h).not.toContain(MOVE);
  });
  it("체크 삭제 ≥1: 정리 문구만(현행 문장 숨김)", () => {
    const h = html(true, false);
    expect(h).toContain(CLEAR);
    expect(h).not.toContain(KEEP);
    expect(h).not.toContain("resync-notice-transfer");
  });
  it("이관 체크: 이어짐 문구(testId resync-notice-transfer)만", () => {
    const h = html(false, true);
    expect(h).toMatch(/data-testid="resync-notice-transfer"[^>]*>.*옮기는 종목의 거래 기록은 새 증권사 종목으로 이어져요/);
    expect(h).not.toContain(KEEP);
    expect(h).not.toContain(CLEAR);
  });
  it("둘 다: 정리 → 이어짐 순서로 두 블록, 현행 문구 없음", () => {
    const h = html(true, true);
    expect(h).not.toContain(KEEP);
    expect(h.indexOf(CLEAR)).toBeGreaterThan(-1);
    expect(h.indexOf(MOVE)).toBeGreaterThan(h.indexOf(CLEAR));
    expect(h.match(/break-keep/g)).toHaveLength(2);
  });
  it("코인 맞추기(5.161): 정리 문구는 '코인', 삭제 0이면 현행 문구", () => {
    const coin = (clearing: boolean) =>
      renderToStaticMarkup(<KindCtx.Provider value="crypto"><ResyncTxNotice clearing={clearing} transferring={false} /></KindCtx.Provider>);
    expect(coin(true)).toContain("지우는 코인은 거래 기록도 함께 정리돼요");
    expect(coin(true)).not.toContain(KEEP);
    expect(coin(false)).toContain(KEEP);
    expect(coin(false)).not.toContain("함께 정리돼요");
  });
});

// 5.164 결과 대조 1줄 — 표시 조건(합계 없음·숨김이면 DOM 0), 대기 표시 없음
describe("ReconcileLines", () => {
  const h = (v: Parameters<typeof ReconcileLines>[0]["view"]) => renderToStaticMarkup(<ReconcileLines view={v} />);
  it("숨김 → DOM 0(자리 표시·스피너 없음)", () => expect(h({ state: "hidden" })).toBe(""));
  it("일치 → 1줄", () => {
    const m = h({ state: "match" });
    expect(m).toContain('data-testid="resync-reconcile"');
    expect(m).toContain("증권사 화면 합계와 맞아요");
    expect(m.match(/<p /g)).toHaveLength(1);
  });
  it("차이 → 2줄 문장", () => {
    const d = h({ state: "diff", ratePct: "2.4", names: ["삼성전자", "TIGER 미국S&amp;P500"], more: 1 });
    expect(d).toContain("증권사 화면 합계와 2.4% 달라요. 시세 시각이 달라 조금 다를 수 있어요");
    expect(d).toContain("차이가 큰 종목: 삼성전자, TIGER 미국S&amp;amp;P500 외 1개");
    expect(d.match(/<p /g)).toHaveLength(2);
  });
});
