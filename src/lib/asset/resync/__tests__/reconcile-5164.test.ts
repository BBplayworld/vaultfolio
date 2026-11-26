// 5.164 #328 맞추기 결과 대조 1줄 — 경계·문장·숨김 조건(C138) + 합계 전용 호출 조건·응답 해석·GA 구간
import { describe, expect, it } from "vitest";
import {
  applyResync, collectReconcileRows, computeDiff, mergeScreens, reconcileGaCategory, reconcileLines, reconcileTotal, reconcileTolerance, resolveScreens,
  isStockTotalLabel, parseScreenTotalResponse, screenTotalTarget, settledScreenTotal, SCREEN_TOTAL_MODE, SCREEN_TOTAL_TIMEOUT_MS,
  type ReconcileFlags, type ReconcileRow, type ScreenTotalFetch, type ScreenTotalInfo,
} from "..";
import { emptySel, row, screen, st, TODAY } from "./fixtures";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const T = (value: number, label = "총 평가금액", currency: ScreenTotalInfo["currency"] = "KRW"): ScreenTotalInfo => ({ value, label, currency });
const OK: ReconcileFlags = { okShots: 1, shotProblem: false, unapplied: false, stalePrice: false, foreignRateUnsynced: false, undone: false };
const R = (name: string, screenValue: number, appValue: number): ReconcileRow => ({ name, screenValue, appValue });
const rows = (app: number) => [R("삼성전자", app, app)];

describe("허용 오차 경계", () => {
  it("총액 10만 원 → 1,000원, 1,000만 원 → 5만 원, 정확히 같으면 일치·1원 넘으면 차이", () => {
    expect(reconcileTolerance(100_000)).toBe(1000);
    expect(reconcileTolerance(10_000_000)).toBe(50_000);
    expect(reconcileTotal({ screenTotal: T(100_000), rows: rows(101_000), flags: OK }).state).toBe("match");
    expect(reconcileTotal({ screenTotal: T(100_000), rows: rows(101_001), flags: OK }).state).toBe("diff");
    expect(reconcileTotal({ screenTotal: T(10_000_000), rows: rows(10_050_000), flags: OK }).state).toBe("match");
    expect(reconcileTotal({ screenTotal: T(10_000_000), rows: rows(9_949_999), flags: OK }).state).toBe("diff");
  });
});

describe("문장(§5 표, 글자 단위)", () => {
  it("일치: 증권사 화면 합계와 맞아요 / GA match", () => {
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: rows(10_040_000), flags: OK });
    expect(reconcileLines(v)).toEqual(["증권사 화면 합계와 맞아요"]);
    expect(reconcileGaCategory(v)).toBe("resync_check_match");
  });
  it("차이 + 다른 행 3개: 2.4% · 큰 순서 2개 + 외 1개", () => {
    const rs = [R("삼성전자", 5_000_000, 5_130_000), R("TIGER 미국S&P500", 3_000_000, 3_100_000), R("SK하이닉스", 1_000_000, 1_010_000), R("KODEX 200", 1_000_000, 1_000_000)];
    // 화면 합 10,000,000 vs 앱 합 10,240,000 → 2.4%
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: rs, flags: OK });
    expect(reconcileLines(v)).toEqual([
      "증권사 화면 합계와 2.4% 달라요. 시세 시각이 달라 조금 다를 수 있어요",
      "차이가 큰 종목: 삼성전자, TIGER 미국S&P500 외 1개",
    ]);
    expect(reconcileGaCategory(v)).toBe("resync_check_diff");
  });
  it("차이 + 다른 행 없음: 안 담긴 종목 문구", () => {
    const rs = [R("a", 5_000_000, 5_000_000), R("b", 5_000_000, 5_000_000)];
    const v = reconcileTotal({ screenTotal: T(10_240_000), rows: rs, flags: OK });
    expect(reconcileLines(v)).toEqual(["증권사 화면 합계와 2.3% 달라요. 시세 시각이 달라 조금 다를 수 있어요", "화면에 안 담긴 종목이 있을 수 있어요"]);
  });
  it("행 2개만 다르면 '외 N개' 없음", () => {
    const v = reconcileTotal({ screenTotal: T(10_000_000), rows: [R("a", 5_000_000, 5_200_000), R("b", 5_000_000, 5_100_000)], flags: OK });
    expect(reconcileLines(v)[1]).toBe("차이가 큰 종목: a, b");
  });
  it("문장에 금액 숫자·금지 어휘가 없다", () => {
    const all = [reconcileLines({ state: "match" }), reconcileLines({ state: "diff", ratePct: "2.4", names: ["a"], more: 0 })].flat().join(" ");
    for (const w of ["정확", "보장", "서버", "원"]) expect(all).not.toContain(w);
  });
});

describe("숨김 조건 1~6 → 줄 없음 · GA none", () => {
  const good = { screenTotal: T(1_000_000), rows: rows(1_000_000), flags: OK };
  const hidden = (o: { screenTotal?: ScreenTotalInfo | null; rows?: ReconcileRow[]; flags?: Partial<ReconcileFlags> }) => {
    const v = reconcileTotal({ ...good, ...o, flags: { ...OK, ...o.flags } });
    expect(v.state).toBe("hidden");
    expect(reconcileLines(v)).toEqual([]);
    expect(reconcileGaCategory(v)).toBe("resync_check_none");
  };
  it("기준: 숨김 사유가 없으면 보인다", () => expect(reconcileTotal(good).state).toBe("match"));
  it("1 총액 없음·0·음수·NaN·통화 KRW 아님", () => {
    hidden({ screenTotal: null });
    hidden({ screenTotal: undefined });
    hidden({ screenTotal: T(0) });
    hidden({ screenTotal: T(-5) });
    hidden({ screenTotal: T(NaN) });
    hidden({ screenTotal: T(1_000_000, "총 평가금액", "USD") });
  });
  it("2 라벨: 평가 없음·자산·예수금·예탁·추정·순·손익", () => {
    for (const l of ["총자산", "추정자산", "예수금", "총 예탁자산", "순자산", "합계", "총평가금액 (예수금 포함)", "추정 평가금액", "순 평가금액", "총 평가손익", "평가손익", "총평가 손익", ""]) hidden({ screenTotal: T(1_000_000, l) });
    for (const l of ["총 평가금액", "총평가금액", "평가금액", "총 평가"]) expect(isStockTotalLabel(l)).toBe(true);
  });
  it("3 장 2장 이상·0장·실패·잘림·한도·실패 장 삭제", () => {
    hidden({ flags: { okShots: 2 } });
    hidden({ flags: { okShots: 0 } });
    hidden({ flags: { shotProblem: true } });
  });
  it("3-1 해외 종목 + 환율 미동기화", () => hidden({ flags: { foreignRateUnsynced: true } }));
  it("4 확인 필요·적용하지 않은 행", () => hidden({ flags: { unapplied: true } }));
  it("5 현재가 0·시세 실패", () => hidden({ flags: { stalePrice: true } }));
  it("6 되돌린 뒤", () => hidden({ flags: { undone: true } }));
  it("대응 행이 0개", () => hidden({ rows: [] }));
});

describe("collectReconcileRows — 실제 맞추기 결과와 이어붙이기", () => {
  const toss = { brokerHint: "토스증권" };
  const sam = st("s1", "005930", "domestic", "토스증권", 10, 70_000, { currentPrice: 70_000 });
  const k = st("s2", "000660", "domestic", "토스증권", 1, 100_000, { currentPrice: 100_000 });
  const other = st("s3", "035720", "domestic", "미래에셋증권", 3, 50_000);
  function run(existing: typeof sam[], items: ReturnType<typeof row>[]) {
    const resolved = resolveScreens([screen(0, items)], existing, { usdRate: 1400 });
    const diff = computeDiff(existing, mergeScreens(resolved), resolved);
    const sel = emptySel();
    const result = applyResync(existing, diff, sel, { today: TODAY, usdRate: 1400, now: 7 });
    return { diff, sel, result, c: collectReconcileRows({ diff, sel, result, existing, rates: { USD: 1400, JPY: 900 } }) };
  }
  it("변경 행은 맞춘 뒤 수량 × 앱 현재가, 화면에 없는 다른 증권사 종목은 합계에 안 들어간다", () => {
    const { c } = run([sam, k, other], [row("005930", 12, 70_000, toss), row("000660", 1, 100_000, toss)]);
    expect(c.unapplied).toBe(false);
    expect(c.rows.map((r) => r.appValue)).toEqual([840_000, 100_000]);
    expect(c.rows.map((r) => r.screenValue)).toEqual([840_000, 100_000]);
    expect(reconcileTotal({ screenTotal: T(940_000), rows: c.rows, flags: OK }).state).toBe("match");
  });
  it("신규 추가 행도 앱 값에 들어간다(화면 현재가)", () => {
    const { c } = run([sam], [row("005930", 10, 70_000, toss), row("000660", 2, 100_000, toss)]);
    expect(c.rows.map((r) => r.appValue)).toEqual([700_000, 200_000]);
  });
  it("앱 현재가가 화면과 다르면 행별 차이로 잡힌다", () => {
    const stale = { ...sam, currentPrice: 60_000 };
    const { c } = run([stale, k], [row("005930", 10, 70_000, { ...toss, currentPrice: 70_000 }), row("000660", 1, 100_000, toss)]);
    const v = reconcileTotal({ screenTotal: T(800_000), rows: c.rows, flags: OK });
    expect(v).toMatchObject({ state: "diff", names: ["이름005930"] });
  });
  it("현재가 0 종목이 있으면 stalePrice", () => {
    const zero = { ...sam, currentPrice: 0 };
    const { c } = run([zero], [row("005930", 10, 0, toss)]);
    expect(c.stalePrice).toBe(true);
  });
  it("확인 필요(수량 미인식) 행이 있으면 unapplied", () => {
    const { c } = run([sam], [row("005930", 1, 70_000, { ...toss, quantityMissing: true })]);
    expect(c.unapplied).toBe(true);
  });
});

describe("합계 전용 호출 — 보낼 조건(§3-2)", () => {
  const none = new Set<number>();
  const ask = (o: Partial<Parameters<typeof screenTotalTarget>[0]>) => screenTotalTarget({ kind: "stock", shots: [{ id: 3, status: "ok" }], failedRemoved: false, asked: none, ...o });
  it("주식·올린 장 1장·그 장 ok·실패 장 삭제 없음·처음이면 그 장 id", () => expect(ask({})).toBe(3));
  it("코인은 0회", () => expect(ask({ kind: "crypto" })).toBeNull());
  it("올린 장이 0장·2장 이상이면 0회(둘 다 ok여도)", () => {
    expect(ask({ shots: [] })).toBeNull();
    expect(ask({ shots: [{ id: 3, status: "ok" }, { id: 4, status: "ok" }] })).toBeNull();
    expect(ask({ shots: [{ id: 3, status: "ok" }, { id: 4, status: "pending" }] })).toBeNull();
  });
  it("행 인식이 실패·잘림·한도·대기·진행 중이면 0회", () => {
    for (const status of ["failed", "truncated", "limit", "pending", "parsing"]) expect(ask({ shots: [{ id: 3, status }] })).toBeNull();
  });
  it("실패 장을 지운 상태면 0회", () => expect(ask({ failedRemoved: true })).toBeNull());
  it("한 장당 1회: 이미 보낸 장은 다시 보내지 않는다(실패했어도). 다른 장은 보낸다", () => {
    expect(ask({ asked: new Set([3]) })).toBeNull();
    expect(ask({ asked: new Set([2]) })).toBe(3);
  });
  it("모드 값·제한 시간", () => {
    expect(SCREEN_TOTAL_MODE).toBe("stock-total");
    expect(SCREEN_TOTAL_TIMEOUT_MS).toBe(8000);
  });
});

describe("합계 전용 호출 — 응답 해석·판정 시점·GA 구간", () => {
  const ok = { value: 801_000, label: "총 평가금액", currency: "KRW" };
  it("{ screenTotal: {value,label,currency} }만 값으로 받는다", () => {
    expect(parseScreenTotalResponse({ screenTotal: ok })).toEqual(ok);
    expect(parseScreenTotalResponse({ screenTotal: { ...ok, currency: "USD" } })?.currency).toBe("USD");
  });
  it("null·키 없음·모양 어긋남·구버전 서버 응답({stocks})은 총액 없음", () => {
    for (const d of [null, undefined, {}, "x", 3, [], { screenTotal: null }, { screenTotal: 801_000 }, { stocks: [{ name: "a" }] },
      { screenTotal: { ...ok, value: "801000" } }, { screenTotal: { ...ok, value: 0 } }, { screenTotal: { ...ok, value: NaN } },
      { screenTotal: { ...ok, label: " " } }, { screenTotal: { ...ok, label: 5 } }, { screenTotal: { ...ok, currency: "JPY" } }, { screenTotal: { value: 5 } }]) {
      expect(parseScreenTotalResponse(d)).toBeNull();
    }
  });
  it("'맞추기'를 누른 순간 받아 둔 값만 쓴다 — 미전송·미도착·실패는 null", () => {
    expect(settledScreenTotal({ status: "none" })).toBeNull();
    expect(settledScreenTotal({ status: "pending" })).toBeNull();
    expect(settledScreenTotal({ status: "failed" })).toBeNull();
    expect(settledScreenTotal({ status: "done", total: null })).toBeNull();
    expect(settledScreenTotal({ status: "done", total: T(5) })).toEqual(T(5));
  });
  it("GA 넷 중 1개: 보냈으나 못 받음(미도착·실패·429·시간 초과) = skip, 안 보냄·받았지만 숨김 = none", () => {
    const hiddenView = reconcileTotal({ screenTotal: null, rows: rows(1), flags: OK });
    const cat = (f: ScreenTotalFetch) => reconcileGaCategory(reconcileTotal({ screenTotal: settledScreenTotal(f), rows: rows(1_000_000), flags: OK }), f.status);
    expect(cat({ status: "pending" })).toBe("resync_check_skip");
    expect(cat({ status: "failed" })).toBe("resync_check_skip");
    expect(cat({ status: "none" })).toBe("resync_check_none");
    expect(cat({ status: "done", total: null })).toBe("resync_check_none");
    expect(cat({ status: "done", total: T(1_000_000, "총자산") })).toBe("resync_check_none");
    expect(cat({ status: "done", total: T(1_000_000) })).toBe("resync_check_match");
    expect(cat({ status: "done", total: T(2_000_000) })).toBe("resync_check_diff");
    expect(reconcileGaCategory(hiddenView)).toBe("resync_check_none");
    // 못 받은 경우 줄은 항상 숨김
    for (const f of [{ status: "pending" }, { status: "failed" }, { status: "none" }] as ScreenTotalFetch[]) {
      expect(reconcileLines(reconcileTotal({ screenTotal: settledScreenTotal(f), rows: rows(1_000_000), flags: OK }))).toEqual([]);
    }
  });
});

describe("저장 0·전송 0·차감 0 (소스 grep)", () => {
  const base = path.join(__dirname, "..");
  const dlg = readFileSync(path.join(base, "../../../app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx"), "utf8");
  const callSrc = readFileSync(path.join(base, "screen-total-call.ts"), "utf8");
  // 합계 호출 함수 본문(다음 최상위 const 선언 앞까지)
  const fn = dlg.slice(dlg.indexOf("const requestScreenTotal = "), dlg.indexOf("const addFiles = "));
  it("reconcile.ts는 저장·네트워크 호출이 없고, 대화상자 GA는 category만 보낸다", () => {
    const rec = readFileSync(path.join(base, "reconcile.ts"), "utf8");
    expect(rec).not.toMatch(/localStorage|fetch\(|saveData|track\(/);
    expect(dlg).toContain('track("feature_use", { category: reconcileGaCategory(view, totalFetch.status) });');
    expect(dlg).not.toMatch(/AssetData[^\n]*screenTotal|saveData\([^)]*reconcile/);
  });
  it("합계 호출은 기기 30회 차감·장 상태 변경·인식 GA·화면 갱신·저장이 없다(대화상자 함수·호출 모듈 둘 다)", () => {
    expect(fn.length).toBeGreaterThan(100);
    for (const src of [fn, callSrc.replace(/^\/\/.*$/gm, "")]) {
      expect(src).not.toMatch(/geminiUsage|gemini-usage|setRemaining|update\(|trackParse|track\(|\bset(?!Timeout\()[A-Z]\w*\(|toast|localStorage|sessionStorage|indexedDB/);
    }
    expect(callSrc.match(/form\.append\(/g)).toHaveLength(2);
  });
  it("대화상자에서 합계를 부르는 곳은 인식 실행 끝 1곳뿐이고, 직접 보내는 요청은 행 인식 1곳 그대로다", () => {
    expect(dlg.match(/requestScreenTotal\(/g)).toHaveLength(1);
    expect(dlg.match(/startScreenTotalCall\(/g)).toHaveLength(1);
    expect(dlg.match(/\/api\/parse-screenshot/g)).toHaveLength(1);
    expect(dlg.indexOf("if (target) requestScreenTotal(target);")).toBeGreaterThan(dlg.indexOf("setRunning(false);\n    // 같은 인식 동작 안에서"));
  });
  it("닫기·초기화·언마운트에서 합계 호출을 취소하고, 판정 뒤 늦은 응답도 끊는다", () => {
    expect(dlg.match(/totalRef\.current\?\.call\.cancel\(\)/g)).toHaveLength(3); // 언마운트·resetAll·새 호출 전
    expect(dlg).toContain("sent?.call.cancel();");
    expect(dlg).toContain("totalAskedRef.current = new Set();");
  });
  it("다른 화면(종목 등록·온보딩·/ratio·코인)에는 합계 모드 호출이 없다", () => {
    const root = path.join(base, "../../..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") walk(p);
        } else if (/\.(ts|tsx)$/.test(e.name) && /stock-total|SCREEN_TOTAL_MODE|STOCK_TOTAL_MODE|startScreenTotalCall/.test(readFileSync(p, "utf8"))) hits.push(path.relative(root, p).replaceAll("\\", "/"));
      }
    };
    walk(root);
    expect(hits.sort()).toEqual([
      "app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx",
      "app/api/parse-screenshot/route.ts",
      "app/api/parse-screenshot/screen-total.ts",
      "lib/asset/resync/reconcile.ts",
      "lib/asset/resync/screen-total-call.ts",
      "server/api-guard.ts",
    ]);
  });
});
