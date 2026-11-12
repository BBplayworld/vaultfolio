// 4.90 #175 홈 '오늘' — A 지수 종가 줄·B 가장 큰 원인 1줄·C 7일 카드 (정적 렌더: jsdom 없음)
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyAssetSnapshot } from "@/types/asset";
import type { MarketLineValue } from "@/lib/finance/market-compare";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { NetAssetSummaryBox, WeekTrendCard } from "../dashboard";
import { MarketLine, type MarketEntryValue } from "../../activity/market-entry-line";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const mv = (m: "kr" | "us", rate: number, endDate: string, holiday = false): MarketLineValue => ({ m, rate, endDate, holiday });
const market = (o: Partial<MarketEntryValue>): MarketEntryValue => ({
  hasTickerStock: true, markets: ["kr", "us"], ready: true, values: [], linkOnly: false, ytdLinkReady: false, open: true, ...o,
});
const lineOf = (html: string) => html.match(/<button[^>]*data-testid="home-cause-line"[\s\S]*?<\/button>/)![0];
const renderLine = (m: MarketEntryValue) => renderToStaticMarkup(<MarketLine market={m} onOpen={() => {}} />);

describe("A MarketLine", () => {
  it("값: 두 시장 같은 날짜 1번, 종가 포함, 손익색·오늘·실시간 없음, testid·data 속성", () => {
    const html = renderLine(market({ values: [mv("kr", 0.8, "2026-11-11"), mv("us", -0.3, "2026-11-11")] }));
    expect(text(html)).toBe("11/11 종가 코스피 +0.8% · S&P 500 -0.3%");
    expect(html).toContain('data-testid="home-market-today"');
    expect(html).toContain('data-state="ok"');
    expect(html).toContain('data-market="kr"');
    expect(html).toContain('data-end-date="2026-11-11"');
    expect(html).toContain('aria-label="시장과 비교 하루 보기, 11/11 종가 코스피 +0.8% · S&amp;P 500 -0.3%"');
    expect(html).not.toMatch(/오늘|실시간|text-red|text-blue|profit|loss/);
  });
  it("날짜 다름: 시장마다 날짜·종가, 둘째 시장은 컨테이너 쿼리로만 숨김(JS 측정 0), 접근성 이름은 전체", () => {
    const html = renderLine(market({ values: [mv("kr", 0.8, "2026-11-12"), mv("us", -0.3, "2026-11-11")] }));
    expect(text(html)).toBe("11/12 종가 코스피 +0.8% · 11/11 종가 S&P 500 -0.3%");
    expect(html).toContain("@max-[368px]:hidden");
    expect(html).toContain('aria-label="시장과 비교 하루 보기, 11/12 종가 코스피 +0.8% · 11/11 종가 S&amp;P 500 -0.3%"');
    expect(html).toContain("whitespace-nowrap");
  });
  it("같은 날짜 형태의 숨김 임계값은 날짜 다름보다 작다", () => {
    const html = renderLine(market({ values: [mv("kr", 0.8, "2026-11-11"), mv("us", -0.3, "2026-11-11")] }));
    expect(html).toContain("@max-[296px]:hidden");
    expect(html).not.toContain("@max-[368px]:hidden");
  });
  it("휴장: 값 대신 휴장(data-holiday), 같은 묶음 전부 휴장이면 종가 생략", () => {
    const a = renderLine(market({ values: [mv("kr", 0.4, "2026-11-26"), mv("us", 0, "2026-11-26", true)] }));
    expect(text(a)).toBe("11/26 종가 코스피 +0.4% · S&P 500 휴장");
    expect(a).toContain('data-holiday="true"');
    expect(a).not.toContain("0.0%");
    expect(text(renderLine(market({ values: [mv("us", 0, "2026-11-26", true)] })))).toBe("11/26 S&P 500 휴장");
  });
  it("한 시장만", () => {
    expect(text(renderLine(market({ values: [mv("us", -0.3, "2026-11-11")] })))).toBe("11/11 종가 S&P 500 -0.3%");
  });
  it("로딩: 스켈레톤(문구 없음), 실패: 입구 문구 유지", () => {
    const l = renderLine(market({ ready: false }));
    expect(l).toContain('data-state="loading"');
    expect(text(l)).toBe("");
    expect(l).toContain("animate-pulse");
    const e = renderLine(market({ values: [] }));
    expect(e).toContain('data-state="empty"');
    expect(text(e)).toBe("지수와 나란히 보기");
  });
  it("히트영역 40px 확장(after)·캡처 제외", () => {
    const html = renderLine(market({ values: [mv("kr", 0.8, "2026-11-11")] }));
    expect(html).toContain("after:-inset-y-2.5");
    expect(html).toContain("data-screenshot-hide");
  });
});

const cause = (key: string, label: string, amount: number) => ({ key, label, sentence: label, amount, text: `${amount > 0 ? "+" : "-"}${Math.abs(amount)}만원` });
const change = (o: Record<string, unknown> = {}) => ({
  deltaNet: -10_000_000, pct: -1, isBig: false, negligible: false, label: "전일 대비", estimated: false,
  sentence: "x", causes: [cause("stock", "주식 시세 하락", -1096), cause("cash", "현금 입금", 500), cause("loan", "대출 상환", 100)], ...o,
});
const box = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    <NetAssetSummaryBox netAsset={1_000_000_000} treemapData={[]} showRealtimeBadge {...(props as object)} />,
  );

describe("B 가장 큰 원인 1줄", () => {
  it("원인 3개: |amount| 최대 1개의 label·text + 외 N개, 쉐브론 대체, 닫힘 상태(패널 inert·접힘)", () => {
    const html = box({ change: change() });
    expect(html).toContain('data-testid="home-cause-line"');
    expect(html).toContain('data-cause-key="stock"');
    const line = lineOf(html);
    expect(text(line)).toBe("주식 시세 하락 -1096만원 외 2개");
    expect(line).not.toContain("주로");
    expect(html).toContain('data-testid="home-cause-more"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="home-cause-panel"');
    expect(html).toContain('aria-label="변동 원인 펼치기, 주식 시세 하락 -1096만원 외 2개"');
    expect(html).not.toContain('aria-label="변동 원인 보기"'); // 14px 쉐브론 없음
    expect(html).toContain('id="home-cause-panel"');
    expect(html).toMatch(/id="home-cause-panel"[^>]*role="region"/);
    expect(html).toContain("grid-rows-[0fr]"); // 패널 닫힘
    expect(html).toContain('data-testid="home-cause-collapse"');
    expect(html).toContain("motion-safe:transition-[grid-template-rows");
    expect(html).not.toContain("transition-all");
  });
  it("N+1 = 목록 행 수(C84): 원인 3개면 외 2개·li 3개", () => {
    const html = box({ change: change() });
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(text(lineOf(html))).toContain("외 2개");
  });
  it("최대 원인이 첫 행이 아님(시세 -100 vs 입금 +500)", () => {
    const html = box({ change: change({ causes: [cause("stock", "주식 시세 하락", -100), cause("cash", "현금 입금", 500)] }) });
    expect(html).toContain('data-cause-key="cash"');
  });
  it("원인 1개: 외 N개 없음", () => {
    const html = box({ change: change({ causes: [cause("cash", "현금 입금", 500)] }) });
    expect(html).toContain('data-cause-key="cash"');
    expect(html).not.toContain("home-cause-more");
  });
  it("예측이면 줄 앞에 칩", () => {
    const html = box({ change: change({ estimated: true }) });
    expect(text(lineOf(html)).startsWith("예측 ")).toBe(true);
  });
  it("원인 0개+예측: B 줄·접기 없음, 현행 쉐브론 유지", () => {
    const html = box({ change: change({ causes: [], sentence: null, estimated: true }) });
    expect(html).not.toContain("home-cause-line");
    expect(html).not.toContain("home-cause-collapse");
    expect(html).toContain('aria-label="변동 원인 보기"');
  });
  it("negligible: B 줄·쉐브론·패널 없음, 현행 변동 없음", () => {
    const html = box({ change: change({ negligible: true }) });
    expect(html).not.toContain("home-cause-line");
    expect(html).not.toContain("home-cause-panel");
    expect(html).not.toContain('aria-label="변동 원인 보기"');
    expect(text(html)).toContain("전일 대비 변동 없음");
  });
  it("캡처 모드: 줄·접기 없이 현행처럼 전부 펼침", () => {
    const html = box({ change: change(), screenshotMode: true });
    expect(html).not.toContain("home-cause-line");
    expect(html).not.toContain("home-cause-collapse");
    expect(html).toContain("grid-rows-[1fr]");
    expect(html.match(/<li /g)).toHaveLength(3);
  });
  it("첫 저장 당일(change null): A·B·패널 0", () => {
    const html = box({ change: null, market: market({ values: [mv("kr", 0.8, "2026-11-11")] }), marketLine: "off", onMarketOpen: () => {} });
    expect(html).not.toContain("home-cause");
    expect(html).not.toContain("home-market-today");
  });
});

describe("A 노출 연결(NetAssetSummaryBox)", () => {
  const props = { change: change(), market: market({ values: [mv("kr", 0.8, "2026-11-11")] }), onMarketOpen: () => {} };
  it("on·pending이면 Hero 박스 바로 뒤·분포 필터 앞에 렌더, off면 없음", () => {
    const tabs = [{ value: "all", label: "전체" }, { value: "financial", label: "금융자산" }];
    const on = box({ ...props, marketLine: "on", visibleTabs: tabs, onSegmentClick: () => {} });
    expect(on).toContain("home-market-today");
    expect(on.indexOf("home-market-today")).toBeLessThan(on.indexOf('aria-label="자산 분포 필터"'));
    expect(on.indexOf("home-cause-panel")).toBeLessThan(on.indexOf("home-market-today"));
    expect(box({ ...props, marketLine: "pending", market: market({ ready: false }) })).toContain('data-state="loading"');
    expect(box({ ...props, marketLine: "off" })).not.toContain("home-market-today");
  });
  it("캡처 모드에서는 on이어도 없음", () => {
    expect(box({ ...props, marketLine: "on", screenshotMode: true })).not.toContain("home-market-today");
  });
});

const snap = (date: string, netAsset: number) => ({ date, netAsset, financialAsset: netAsset }) as DailyAssetSnapshot;
const WEEK = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];

describe("C WeekTrendCard", () => {
  it("기록 2개 이상: 버튼(aria-label), 머리 줄 ›, 제목 testid", () => {
    const html = renderToStaticMarkup(<WeekTrendCard snapshots={WEEK.map((d, i) => snap(d, 100 + i))} />);
    expect(html.startsWith("<button")).toBe(true);
    expect(html).toContain('data-testid="home-week-card"');
    expect(html).toContain('aria-label="순자산 추이, 자산 변화 주 보기"');
    expect(html).toContain("lucide-chevron-right");
    expect(html).toMatch(/data-testid="home-week-title"[^>]*>순자산 추이 \(최근 7일\)</);
  });
  it("기록 비연속이면 `최근 기록 N일`", () => {
    const dates = ["2026-10-24", "2026-10-27", "2026-10-30", "2026-11-02", "2026-11-06", "2026-11-09", "2026-11-12"];
    const html = renderToStaticMarkup(<WeekTrendCard snapshots={dates.map((d, i) => snap(d, 100 + i))} />);
    expect(html).toMatch(/data-testid="home-week-title"[^>]*>순자산 추이 \(최근 기록 7일\)</);
  });
  it("+5% 픽스처에도 pulse·글로우·▲%·주황 막대·transition-all 없음", () => {
    const html = renderToStaticMarkup(<WeekTrendCard snapshots={[snap("2026-11-11", 100), snap("2026-11-12", 110)]} />);
    expect(html).not.toContain("animate-pulse");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("▲");
    expect(html).not.toContain("transition-all");
    expect(html).not.toContain("invisible"); // 막대 위 빈 자리 행 제거
    expect(html).not.toContain(MAIN_ORANGE);
  });
  it("0개: 안내(비버튼), 1개: 하루 더 쌓이면 문구(비버튼)", () => {
    const zero = renderToStaticMarkup(<WeekTrendCard snapshots={[]} />);
    expect(zero).toContain("순자산 추이는 내일부터 그려져요");
    expect(zero).not.toContain("<button");
    const one = renderToStaticMarkup(<WeekTrendCard snapshots={[snap("2026-11-12", 100)]} />);
    expect(one).not.toContain("<button");
    expect(one).not.toContain("home-week-card");
    expect(one).toContain("하루 더 쌓이면 날짜별 변화를 비교할 수 있어요.");
  });
});
import { MAIN_PALETTE } from "@/config/theme";
const MAIN_ORANGE = MAIN_PALETTE[4];
