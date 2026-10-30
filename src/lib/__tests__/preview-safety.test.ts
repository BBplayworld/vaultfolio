import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { isPreviewEnv, isCloudSyncEnabled } from "../cloud-sync/config";
import { pushAsset, pullAsset, fetchRemoteVersion } from "../cloud-sync/sync-client";
import { materializeDemo, resolvePreviewAction, buildDemoRefreshMeta } from "../preview/demo-payload";
import { assetDataSchema } from "@/types/asset";
import type { AssetKeys } from "../cloud-sync/crypto";
import { PreviewGate } from "@/app/(main)/_components/preview/preview-gate";

// 데모 JSON은 정적 import 금지 대상 — 테스트도 fs로 읽는다
const DEMO_PATH = path.resolve(__dirname, "../preview/demo-data.json");
const demoRaw = JSON.parse(readFileSync(DEMO_PATH, "utf8"));

const keys = { encKey: {} as CryptoKey, privKey: new Uint8Array(32), pubKey: new Uint8Array(32) } as unknown as AssetKeys;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("1. isPreviewEnv", () => {
  it.each([
    ["preview", true],
    ["production", false],
    ["development", false],
    ["", false],
  ])("NEXT_PUBLIC_VERCEL_ENV=%j → %s", (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", value);
    expect(isPreviewEnv()).toBe(expected);
  });
  it("미설정 → false", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", undefined as unknown as string);
    expect(isPreviewEnv()).toBe(false);
  });
});

describe("2. isCloudSyncEnabled 매트릭스", () => {
  it.each([
    ["preview", "on", false],
    ["preview", "off", false],
    ["preview", "", false],
    ["production", "on", true],
    ["production", "off", false],
    ["", "", true],
    ["", "off", false],
  ])("VERCEL_ENV=%j · CLOUD_SYNC=%j → %s", (env, sync, expected) => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env);
    vi.stubEnv("NEXT_PUBLIC_CLOUD_SYNC", sync);
    expect(isCloudSyncEnabled()).toBe(expected);
  });
});

describe("3. preview에서 sync-client fetch 0건", () => {
  it("pushAsset·pullAsset·fetchRemoteVersion", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await pushAsset("a", keys)).status).toBe("error");
    expect((await pullAsset("a", keys)).status).toBe("error");
    expect(await fetchRemoteVersion("a", keys)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("4. 비 preview에서 게이트 무동작", () => {
  it.each(["production", "development", ""])("%j: DOM 비어 있음·children 그대로·?demo 무시", (env) => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env);
    expect(renderToStaticMarkup(createElement(PreviewGate))).toBe("");
    expect(renderToStaticMarkup(createElement(PreviewGate, null, createElement("p", null, "x")))).toBe("<p>x</p>");
    expect(resolvePreviewAction(isPreviewEnv(), "?demo=1", false)).toBe("none");
    expect(resolvePreviewAction(isPreviewEnv(), "?demo=empty", true)).toBe("none");
    expect(resolvePreviewAction(isPreviewEnv(), "", false)).toBe("none");
  });
  it("preview: demo/empty/choose/none 판정", () => {
    expect(resolvePreviewAction(true, "?demo=1", true)).toBe("demo");
    expect(resolvePreviewAction(true, "?demo=empty", true)).toBe("empty");
    expect(resolvePreviewAction(true, "?demo=x", true)).toBe("none");
    expect(resolvePreviewAction(true, "", false)).toBe("choose");
    expect(resolvePreviewAction(true, "", false, true)).toBe("none");
    expect(resolvePreviewAction(true, "", true)).toBe("none");
  });
});

const TODAY = "2026-10-27";
type Payload = {
  assetData: Record<string, unknown[]> & Record<string, unknown>;
  snapshots: { monthly: Array<Record<string, unknown>>; daily: Array<Record<string, unknown>> };
  nickname: string;
};
const materialize = (today = TODAY) => materializeDemo(demoRaw, today) as unknown as Payload;

describe("5. 스키마", () => {
  it("assetDataSchema.parse 통과·토큰 잔존 없음", () => {
    const p = materialize();
    expect(() => assetDataSchema.parse(p.assetData)).not.toThrow();
    expect(JSON.stringify(p)).not.toMatch(/"@(M|D|NOW)/);
    expect(p.nickname).toBe("데모");
  });
});

describe("6. 유형·개수·거래", () => {
  const p = materialize();
  const a = assetDataSchema.parse(p.assetData);
  it("모든 유형 포함, 유형당 1~3개", () => {
    const groups: Record<string, number> = {
      domestic: a.stocks.filter((s) => s.category === "domestic").length,
      foreign: a.stocks.filter((s) => s.category === "foreign").length,
      pension: a.stocks.filter((s) => s.category === "pension").length,
      isa: a.stocks.filter((s) => s.category === "isa").length,
      realEstate: a.realEstate.length,
      crypto: a.crypto.length,
      cash: a.cash.length,
      loans: a.loans.length,
    };
    for (const [k, n] of Object.entries(groups)) {
      expect(n, k).toBeGreaterThanOrEqual(1);
      expect(n, k).toBeLessThanOrEqual(3);
    }
    expect(a.stocks.some((s) => s.currency === "USD")).toBe(true);
  });
  it("배당 지급 티커 1개 이상 보유", () => {
    const tickers = a.stocks.map((s) => s.ticker);
    expect(tickers.some((t) => t === "005930" || t === "AAPL")).toBe(true);
  });
  it("월별 거래 3~5건(-3~0)", () => {
    const dates = [
      ...a.transactions.map((t) => t.date),
      ...a.cashTransactions.map((t) => t.date),
      ...a.loanTransactions.map((t) => t.date),
      ...a.cryptoTransactions.map((t) => t.date),
    ];
    for (const m of ["2026-07", "2026-08", "2026-09", "2026-10"]) {
      const n = dates.filter((d) => d.startsWith(m)).length;
      expect(n, m).toBeGreaterThanOrEqual(3);
      expect(n, m).toBeLessThanOrEqual(5);
    }
  });
  it("사건 종류 각 1건 이상 + 미기록 차이", () => {
    expect(a.cashTransactions.some((t) => t.type === "deposit")).toBe(true);
    expect(a.cashTransactions.some((t) => t.type === "withdrawal")).toBe(true);
    expect(a.transactions.some((t) => t.type === "buy")).toBe(true);
    expect(a.transactions.some((t) => t.type === "sell")).toBe(true);
    expect(a.loanTransactions.some((t) => t.type === "repay")).toBe(true);
    expect(a.cryptoTransactions.length).toBeGreaterThanOrEqual(1);
    // 부동산 재평가: 연속한 enrich 월 스냅샷의 breakdown.realEstate가 다르다
    const re = p.snapshots.monthly
      .map((s) => (s.breakdown as { realEstate?: number } | undefined)?.realEstate)
      .filter((v): v is number => typeof v === "number");
    expect(re.some((v, i) => i > 0 && v !== re[i - 1])).toBe(true);
    // 미기록 소액 차이: netAsset ≠ breakdown 합
    const gap = p.snapshots.monthly.some((s) => {
      const b = s.breakdown as Record<string, number> | undefined;
      if (!b) return false;
      const sum = b.realEstate + b.stocks + b.crypto + b.cash - b.loans - (b.tenantDeposit ?? 0);
      return sum !== s.netAsset;
    });
    expect(gap).toBe(true);
  });
  it("최신화 메타: 현금·대출 30일 초과, 주식·코인 최근", () => {
    const now = Date.parse("2026-10-27T00:00:00Z");
    const m = buildDemoRefreshMeta(now).categories;
    const days = (iso: string) => (now - Date.parse(iso)) / 86400000;
    expect(days(m.cash)).toBeGreaterThan(30);
    expect(days(m.loan)).toBeGreaterThan(30);
    expect(days(m.stock)).toBeLessThan(30);
    expect(days(m.crypto)).toBeLessThan(30);
  });
});

describe("7. 월 오프셋 변환", () => {
  it.each([
    ["2026-02-10", ["2025-11", "2025-12", "2026-01", "2026-02"]],
    ["2026-10-27", ["2026-07", "2026-08", "2026-09", "2026-10"]],
  ])("기준일 %s", (today, months) => {
    const p = materialize(today);
    const monthly = p.snapshots.monthly;
    expect(monthly.map((s) => s.month)).toEqual(months);
    const enriched = monthly.filter((s) => s.date);
    expect(enriched).toHaveLength(3); // 레거시 1건(-3)은 date·enrich 없음
    expect(monthly[0].date).toBeUndefined();
    for (const s of enriched) {
      expect(String(s.date).startsWith(String(s.month))).toBe(true);
      expect(String(s.date) <= today).toBe(true);
      expect((s.fx as { USD: number }).USD).toBeGreaterThan(0);
    }
    const usd = enriched.map((s) => (s.fx as { USD: number }).USD);
    expect(new Set(usd).size).toBe(usd.length);
    // 모든 날짜는 기준일 이하
    const a = assetDataSchema.parse(p.assetData);
    for (const t of [...a.transactions, ...a.cashTransactions, ...a.loanTransactions, ...a.cryptoTransactions]) {
      expect(t.date <= today).toBe(true);
    }
    for (const d of p.snapshots.daily) expect(String(d.date) < today).toBe(true);
  });
  it("월초(1일)에도 이번 달 날짜가 오늘을 넘지 않는다", () => {
    const p = materialize("2026-03-01");
    const a = assetDataSchema.parse(p.assetData);
    expect(a.transactions.every((t) => t.date <= "2026-03-01")).toBe(true);
    expect(p.snapshots.monthly.at(-1)?.date).toBe("2026-03-01");
  });
});

describe("8. 실제 공개 티커", () => {
  const ALLOWED = new Set(["005930", "000660", "AAPL", "NVDA", "360750", "069500", "BTC"]);
  it("주식·코인·거래 티커가 허용 목록에 속한다", () => {
    const a = assetDataSchema.parse(materialize().assetData);
    const all = [
      ...a.stocks.map((s) => s.ticker ?? ""),
      ...a.crypto.map((c) => c.symbol),
      ...a.transactions.map((t) => t.ticker),
      ...a.cryptoTransactions.map((t) => t.symbol),
    ];
    for (const t of all) expect(ALLOWED.has(t), t).toBe(true);
  });
});

describe("9. 데모 JSON 정적 import 0건", () => {
  it("src 전체 검색", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?|mjs)$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const staticImport = /import\s+[^("']*from\s+["'][^"']*demo-data\.json["']/;
    const offenders = files.filter((f) => staticImport.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    // 동적 import는 게이트 1곳에만 존재
    const dynamicUsers = files.filter((f) => /import\(\s*["'][^"']*demo-data\.json["']\s*\)/.test(readFileSync(f, "utf8")));
    expect(dynamicUsers.map((f) => path.basename(f))).toEqual(["preview-gate.tsx"]);
  });
});

describe("10. 데모 주입 상태에서는 튜토리얼 미노출(#4.36)", () => {
  const TUTORIAL_KEY = "secretasset_tutorial_status";
  const makeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
      _m: m,
    };
  };
  let ls: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    ls = makeStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
  });

  it("?demo=1 주입 후 튜토리얼 5단계 모두 건너뜀 + 표식, 스토어 activeStep 없음", async () => {
    const { applyDemoTutorialSkip, DEMO_TUTORIAL_MARKER } = await import("@/app/(main)/_components/preview/preview-gate");
    const { tutorialStore } = await import("@/stores/tutorial/tutorial-store");
    applyDemoTutorialSkip();
    const map = JSON.parse(ls.getItem(TUTORIAL_KEY)!);
    expect(Object.values(map).every((v) => v === "skipped" || v === "done")).toBe(true);
    expect(ls.getItem(DEMO_TUTORIAL_MARKER)).toBe("1");
    expect(tutorialStore.getState().activeStep).toBeNull();
    expect(tutorialStore.getState().isTutorialFinished).toBe(true);
    // 20. 현재 공지도 읽음(기존 열람 키) — 새 브라우저 데모에서 결산 등 하위 팁이 바로 보이게
    const { NOTICE_ID } = await import("@/app/(main)/_components/layout/onboarding/notice");
    expect(JSON.parse(ls.getItem("secretasset_notice_seen")!).id).toBe(NOTICE_ID);
  });

  it("20. ?demo=empty: 데모가 남긴 공지 열람 기록도 지운다(clearAssetData는 공지 키를 보존하므로 직접 삭제)", async () => {
    const { applyDemoTutorialSkip, resetDemoTutorialSkip } = await import("@/app/(main)/_components/preview/preview-gate");
    applyDemoTutorialSkip();
    expect(ls.getItem("secretasset_notice_seen")).not.toBeNull();
    resetDemoTutorialSkip();
    expect(ls.getItem("secretasset_notice_seen")).toBeNull();
  });

  it("20. 데모 이력 없으면 ?demo=empty가 사용자의 공지 열람 기록을 건드리지 않는다", async () => {
    const { resetDemoTutorialSkip } = await import("@/app/(main)/_components/preview/preview-gate");
    ls.setItem("secretasset_notice_seen", JSON.stringify({ id: "x", seenAt: 1, expiresAt: 9e15 }));
    resetDemoTutorialSkip();
    expect(ls.getItem("secretasset_notice_seen")).not.toBeNull();
  });

  it("이미 완료한 단계는 done 유지(건너뜀으로 덮지 않음)", async () => {
    const { applyDemoTutorialSkip } = await import("@/app/(main)/_components/preview/preview-gate");
    ls.setItem(TUTORIAL_KEY, JSON.stringify({ 1: "done", 2: "pending", 3: "pending", 4: "pending", 5: "pending" }));
    applyDemoTutorialSkip();
    expect(JSON.parse(ls.getItem(TUTORIAL_KEY)!)["1"]).toBe("done");
  });

  it("?demo=empty: 데모가 건너뛴 튜토리얼만 첫 사용 상태로 복구", async () => {
    const { applyDemoTutorialSkip, resetDemoTutorialSkip, DEMO_TUTORIAL_MARKER } = await import("@/app/(main)/_components/preview/preview-gate");
    const { tutorialStore } = await import("@/stores/tutorial/tutorial-store");
    applyDemoTutorialSkip();
    resetDemoTutorialSkip();
    expect(ls.getItem(TUTORIAL_KEY)).toBeNull();
    expect(ls.getItem(DEMO_TUTORIAL_MARKER)).toBeNull();
    expect(tutorialStore.getState().activeStep).toBe(1);
  });

  it("?demo=empty: 데모 이력 없으면 기존 튜토리얼 상태 그대로(무동작)", async () => {
    const { resetDemoTutorialSkip } = await import("@/app/(main)/_components/preview/preview-gate");
    const prev = JSON.stringify({ 1: "done", 2: "skipped", 3: "pending", 4: "pending", 5: "pending" });
    ls.setItem(TUTORIAL_KEY, prev);
    resetDemoTutorialSkip();
    expect(ls.getItem(TUTORIAL_KEY)).toBe(prev);
  });

  it("운영(비 preview)에서는 게이트가 데모·튜토리얼 처리를 하지 않는다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/preview/preview-gate.tsx"), "utf8");
    // 튜토리얼 처리 호출은 injectDemo·empty 분기 안에만(PreviewGateInner는 isPreviewEnv()일 때만 렌더)
    expect(src.match(/applyDemoTutorialSkip\(\);/g)?.length).toBe(1);
    expect(src.match(/resetDemoTutorialSkip\(\);/g)?.length).toBe(1);
    expect(src).toMatch(/if \(!isPreviewEnv\(\)\) return <>\{children\}<\/>;/);
  });
});
