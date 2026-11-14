// 5.111 성과 주식 종목 목록 — 손익 큰 3종목 + `외 N개`
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StockGroupRows, orderStockRows, restDisplaySum, sumStockProfit } from "../stock-group-rows";

type Row = { id: string; hasRef: boolean; profitAmount: number; currentValue: number };
const row = (id: string, profitAmount: number, currentValue: number, hasRef = true): Row => ({ id, hasRef, profitAmount, currentValue });
const render = (id: string, r: Row) => <p key={id} data-row={id}>{id}</p>;

// 20종목: 국내 10 · 해외 6(기준가 없음 1) · ISA 2 · 연금저축 1
const domestic = Array.from({ length: 10 }, (_, i) => row(`d${i}`, (i % 2 ? -1 : 1) * (i + 1) * 12_345, 1_000_000 - i * 1000));
const foreign = [
  ...Array.from({ length: 5 }, (_, i) => row(`f${i}`, (i - 2) * 33_333, 2_000_000 + i)),
  row("f-none", 0, 9_999_999, false),
];

describe("orderStockRows", () => {
  it("|손익| 내림차순, 동률은 평가금액 내림차순, 완전 동률은 입력 순서", () => {
    const rows = [row("a", 100, 10), row("b", -100, 20), row("c", 100, 20), row("d", 100, 20)];
    expect(orderStockRows(rows).map((r) => r.id)).toEqual(["b", "c", "d", "a"]);
  });
  it("기준가 없는 종목은 평가금액이 커도 맨 뒤", () => {
    const ids = orderStockRows(foreign).map((r) => r.id);
    expect(ids[ids.length - 1]).toBe("f-none");
  });
  it("입력 배열은 바꾸지 않는다", () => {
    const copy = [...domestic];
    orderStockRows(domestic);
    expect(domestic).toEqual(copy);
  });
});

describe("합 일치(원 단위, C1)", () => {
  it("보이는 3행 + 나머지 합 = 기준가 있는 전 종목 손익 합", () => {
    for (const group of [domestic, foreign]) {
      const ordered = orderStockRows(group);
      const total = sumStockProfit(group);
      expect(sumStockProfit(ordered.slice(0, 3)) + sumStockProfit(ordered.slice(3))).toBe(total);
    }
  });
});

describe("StockGroupRows 렌더", () => {
  const rowsOf = (html: string) => [...html.matchAll(/data-row="([^"]+)"/g)].map((m) => m[1]);
  it("5개 이상이면 상위 3개 행 + 패널 + `외 N개`, 합은 나머지 행 합", () => {
    const html = renderToStaticMarkup(<StockGroupRows items={domestic} renderRow={(r) => render((r as Row).id, r as Row)} />);
    const ids = rowsOf(html);
    expect(ids).toHaveLength(10);
    expect(ids.slice(0, 3)).toEqual(orderStockRows(domestic).slice(0, 3).map((r) => r.id));
    expect(html).toContain("외 7개");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("inert");
    const rest = sumStockProfit(orderStockRows(domestic).slice(3));
    expect(html).toContain(`data-value="${rest}"`);
  });
  it("4개 이하는 전부 표시, 외 줄 없음", () => {
    for (const n of [1, 2, 4]) {
      const html = renderToStaticMarkup(<StockGroupRows items={domestic.slice(0, n)} renderRow={(r) => render((r as Row).id, r as Row)} />);
      expect(rowsOf(html)).toHaveLength(n);
      expect(html).not.toContain("aria-expanded");
      expect(html).not.toContain("외 ");
    }
  });
  it("나머지에 기준가 있는 종목이 없으면 금액 생략", () => {
    const items = [row("a", 5, 5), row("b", 4, 4), row("c", 3, 3), row("x", 0, 2, false), row("y", 0, 1, false)];
    const html = renderToStaticMarkup(<StockGroupRows items={items} renderRow={(r) => render((r as Row).id, r as Row)} />);
    expect(html).toContain("외 2개");
    expect(html).not.toContain("data-value");
  });
  it("기간 4개 동시 렌더에도 aria-controls id가 겹치지 않는다", () => {
    const html = renderToStaticMarkup(
      <div>{["d", "w", "m", "y"].map((p) => <StockGroupRows key={p} items={domestic} renderRow={(r) => render((r as Row).id, r as Row)} />)}</div>,
    );
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("외 줄 원 단위 합 일치(소수 원화)", () => {
  it("보이는 3행 반올림 합 + 외 표시값 = 그룹 손익 반올림", () => {
    const mk = (p: number, v: number) => ({ hasRef: true, profitAmount: p, currentValue: v });
    const rows = [mk(200000.4, 9), mk(120000.4, 8), mk(74504.4, 7), mk(-100000.4, 6), mk(-80000.4, 5), mk(-39316.4, 4)];
    const top = rows.slice(0, 3);
    const rest = restDisplaySum(rows, top);
    const visible = top.reduce((s, r) => s + Math.round(r.profitAmount), 0);
    expect(visible + rest).toBe(Math.round(sumStockProfit(rows)));
  });
});
