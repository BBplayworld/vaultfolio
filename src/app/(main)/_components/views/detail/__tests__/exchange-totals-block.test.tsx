// #325(5.163) 거래소별 합계 블록 — 정적 렌더: 접힘 기본·화면 문자열 합 = 헤더 문자열(C150)·DOM 0 조건·맞추기 버튼 0·인증카드 숨김
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Crypto } from "@/types/asset";
import { ExchangeTotalsBlock } from "../tabs/exchange-totals-block";
import { FIXTURE, header } from "@/lib/asset/__tests__/exchange-totals.fixture";
import { formatCurrency } from "@/lib/number-utils";

const co = (o: Partial<Crypto>): Crypto =>
  ({ id: "c", name: "비트코인", symbol: "BTC", quantity: 0.1, averagePrice: 90000000, currentPrice: 140000000, purchaseDate: "2025-01-01", ...o }) as Crypto;
const texts = (html: string, id: string) => [...html.matchAll(new RegExp(`data-testid="${id}"[^>]*>(.*?)</(?:span|p)>`, "g"))].map((m) => m[1]);
const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));
const render = (crypto: Crypto[]) => renderToStaticMarkup(<ExchangeTotalsBlock crypto={crypto} />);

describe("ExchangeTotalsBlock", () => {
  const html = render(FIXTURE);

  it("처음엔 접혀 있고 패널은 항상 마운트, 토글 히트영역 40px, 인증카드 숨김 속성", () => {
    expect(html).toContain('data-testid="exchange-totals"');
    expect(html).toContain("data-screenshot-hide");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-state="closed"');
    expect(html).toContain("inert");
    expect(html).toContain("거래소별");
    expect(html).toContain("8곳");
    expect(html).toContain("min-h-10");
    expect(html).not.toMatch(/data-state="open"/);
  });

  it("C150: 화면의 행 평가금·손익 문자열 합 = 헤더 getAssetSummary().cryptoValue·cryptoProfit 문자열, 비중 합 100.0%", () => {
    const h = header(FIXTURE);
    const values = texts(html, "broker-row-value");
    expect(values).toHaveLength(8);
    expect(values.reduce((a, v) => a + num(v), 0)).toBe(num(formatCurrency(h.cryptoValue)));
    // 손익 칸: 첫 span이 금액(부호 포함), 둘째가 수익률
    const profits = [...html.matchAll(/data-testid="broker-row-profit"[^>]*><span[^>]*>(.*?)<\/span>/g)].map((m) => m[1]);
    expect(profits).toHaveLength(8);
    expect(profits.reduce((a, v) => a + num(v), 0)).toBe(num(formatCurrency(Math.round(h.cryptoProfit))));
    const shares = texts(html, "broker-row-share").map((v) => Math.round(num(v) * 10));
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("미지정은 맨 아래 1묶음 + 안내 1줄, 행 둘째 줄은 `코인 N개`·`· 비중` 조각별 nowrap(C152)", () => {
    const names = texts(html, "broker-row-name");
    expect(names.at(-1)).toBe("거래소 미지정");
    expect(names.filter((n) => n === "거래소 미지정")).toHaveLength(1);
    expect(html).toContain("거래소를 적지 않은 코인이에요.");
    expect(texts(html, "broker-row-count")[0]).toMatch(/^코인 \d+개$/);
    expect(html).toMatch(/data-testid="broker-row-count" class="whitespace-nowrap"/);
    expect(html).toMatch(/data-testid="broker-row-share" class="whitespace-nowrap">· /);
    expect(html).not.toContain("종목");
  });

  it("읽기 전용: 블록 안 버튼은 접기 토글 1개뿐(`맞추기` DOM 0)", () => {
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain("맞추기");
    expect(html).not.toContain("broker-row-resync");
  });

  it("320: 금액 칸은 다음 줄로 내려가도 오른쪽 끝에 붙는다(ml-auto), 금액·손익은 줄바꿈 없음", () => {
    // 5.167 E1: 금액 열 shrink-0 제거(손익 줄 flex-wrap) — ml-auto·nowrap은 그대로
    expect(html).toMatch(/class="text-right ml-auto"><p data-testid="broker-row-value" class="[^"]*whitespace-nowrap/);
    expect(html).not.toContain("broker-row-cash");
  });

  it("묶음 1개·코인 0건·총 평가금 0이면 DOM 0", () => {
    expect(render([])).toBe("");
    expect(render([co({ id: "a", exchange: "업비트" }), co({ id: "b", exchange: " upbit ", symbol: "ETH" })])).toBe("");
    expect(render([co({ id: "a", exchange: "" }), co({ id: "b", exchange: "항목 1" })])).toBe("");
    expect(render([co({ id: "a", exchange: "업비트", currentPrice: 0 }), co({ id: "b", exchange: "빗썸", currentPrice: 0 })])).toBe("");
    expect(render([co({ id: "a", exchange: "업비트" }), co({ id: "b", exchange: "빗썸", quantity: 0 })])).toBe("");
  });

  it("미지정이 없으면 안내 줄 없음, 투자 권유 문구 0", () => {
    const h2 = render([co({ id: "a", exchange: "업비트" }), co({ id: "b", exchange: "빗썸" })]);
    expect(h2).not.toContain("exchange-totals-note");
    expect(html).not.toMatch(/사세요|파세요|추천|비중을 (맞추|조정)/);
  });

  it("저장·서버 호출 0, 코인 탭은 selector 아래·비중바 위에 블록을 둔다", () => {
    const dir = join(process.cwd(), "src/app/(main)/_components/views/detail/tabs");
    const block = readFileSync(join(dir, "exchange-totals-block.tsx"), "utf8") + readFileSync(join(process.cwd(), "src/lib/asset/exchange-totals.ts"), "utf8");
    expect(block).not.toMatch(/localStorage|sessionStorage|fetch\(|indexedDB/);
    const tab = readFileSync(join(dir, "crypto-tab.tsx"), "utf8");
    const at = tab.indexOf("<ExchangeTotalsBlock");
    expect(at).toBeGreaterThan(tab.indexOf('ariaLabel="암호화폐 카테고리"'));
    // 5.176 #360: 비중바·범례가 공용 ShareBarLegend로 바뀌어 그 위치를 기준으로 본다(존재 확인 포함)
    expect(tab.indexOf("<ShareBarLegend")).toBeGreaterThan(-1);
    expect(at).toBeLessThan(tab.indexOf("<ShareBarLegend"));
  });
});
