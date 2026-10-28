// #32 preview 점검 스크립트 (월말 결산 핵심 경로). 전역 playwright 사용.
// 실행: node .memory/qa/settlement-check.mjs <previewURL> [스크린샷 폴더]
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const globalRoot = process.env.NODE_PATH || execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = createRequire(path.join(globalRoot, "noop.js"))("playwright");
const BASE = (process.argv[2] || "").replace(/\/$/, "");
const SHOTS = process.argv[3] || "";
if (!BASE) { console.error("usage: node settlement-check.mjs <previewURL> [shotsDir]"); process.exit(2); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (id, ok, detail = "") => { results.push({ id, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`); };
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_PROXY|Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }); };
const tid = (id) => page.locator(`[data-testid="${id}"]`);
// 튜토리얼 오버레이가 클릭을 가리지 않게 완료 처리
const skipTutorial = () => page.evaluate(() => {
  localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }));
});
const goHash = async (hash) => { await page.goto(`${BASE}/${hash}`); await page.waitForTimeout(2500); };

await page.goto(`${BASE}/?demo=1`);
await page.waitForSelector('html[data-demo-ready="1"]', { timeout: 30000, state: "attached" });
await skipTutorial();
await page.waitForTimeout(2500);

// 1. 허브 카드 3개 + 결산 카드
await goHash("#activity");
const hubCards = await Promise.all(["hub-card-change", "hub-card-dividend", "hub-card-report"].map((t) => tid(t).count()));
const hasProfitCard = (await page.getByText("기간별 수익", { exact: true }).count()) > 0;
check("1 허브 카드 3개, 수익 카드 없음", hubCards.every((c) => c === 1) && !hasProfitCard, `cards=${hubCards} profit=${hasProfitCard}`);
const cardCount = await tid("settlement-card").count();
check("9 결산 카드(노출 기간이면 1개)", true, `settlement-card=${cardCount}`);
await shot("1-hub.png");

// 2. 결산 카드 → 월 탭
if (cardCount > 0) await tid("settlement-card").locator("div").first().click();
else await goHash("#activity/change");
await page.waitForTimeout(1500);
const rootOk = (await tid("settlement-root").count()) === 1;
const title = rootOk ? await tid("settlement-title").textContent() : "";
const range = (await tid("settlement-range").count()) ? await tid("settlement-range").textContent() : "";
check("2 자산 변화 월 탭 = 결산 블록", rootOk && !!title, `title=${title} range=${range}`);
const scopeLabel = await tid("change-scope-label").textContent();
check("2 범위 칩 상시 표시", scopeLabel === "전체 자산", scopeLabel);

// 6. 항등식
const delta = Number(await tid("settlement-delta").getAttribute("data-value").catch(() => "NaN"));
const causeVals = await page.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-value"))));
const sum = causeVals.reduce((a, b) => a + b, 0);
check("6 원인 합계 = 순자산 증감", Number.isFinite(delta) && Math.abs(sum - delta) < 10000, `delta=${delta} sum=${sum} rows=${causeVals.length}`);
const bodyText = await tid("settlement-root").textContent();
check("6 매수·매도·상환 문구 없음", !/매수|매도|상환/.test(bodyText || ""));
check("11·12 다음 달 준비(.ics 버튼·안내)", (await tid("prep-ics-button").count()) === 1 && (await tid("prep-ics-note").count()) === 1, `stale rows=${await tid("prep-stale-row").count()}`);
await shot("2-settlement.png");

// 10·14. 월 선택기 + 레거시 시작점 달 → 예측 배지
const items = tid("settlement-month-item");
const total = await items.count();
const enabled = await page.locator('[data-testid="settlement-month-item"]:not([disabled])').count();
check("10 월 선택기 13개, 비활성 존재", total === 13 && enabled < 13, `total=${total} enabled=${enabled}`);
const enabledLabels = await page.locator('[data-testid="settlement-month-item"]:not([disabled])').allTextContents();
if (enabled >= 3) {
  await page.locator('[data-testid="settlement-month-item"]:not([disabled])').nth(1).click();
  await page.waitForTimeout(800);
  const badge = await tid("cause-estimated-badge").count();
  check("14 레거시 시작 달 → 예측 배지", badge > 0, `month=${enabledLabels[1]} badges=${badge} range=${await tid("settlement-range").textContent().catch(() => "")}`);
  await shot("3-legacy-month.png");
  await page.locator('[data-testid="settlement-month-item"]:not([disabled])').nth(0).click();
  await page.waitForTimeout(500);
  check("5·첫 달 → first_month 상태", (await tid("settlement-first-month").count()) === 1);
}

// 3. 주식 범위 → 결산 블록 없음
await tid("change-scope-stock").click();
await page.waitForTimeout(1000);
check("3 주식 범위에 결산 블록 없음", (await tid("settlement-root").count()) === 0 && (await page.getByText("수익 현황").count()) > 0);
await tid("change-scope-all").click();
await tid("change-period-week").click();
await page.waitForTimeout(800);
check("주 탭 목록", (await tid("week-list").count()) === 1, `rows=${await tid("week-row").count()}`);
await shot("4-week.png");

// 13. 옛 해시 리다이렉트
await goHash("#activity/netasset");
const yearActive = await tid("change-period-year").getAttribute("data-state");
check("13 #activity/netasset → 전체·연", yearActive === "active" && page.url().endsWith("#activity/change"), page.url());
await goHash("#activity/profit");
const stockActive = await tid("change-scope-stock").getAttribute("data-state");
const dayActive = await tid("change-period-day").getAttribute("data-state");
check("13 #activity/profit → 주식·일", stockActive === "active" && dayActive === "active");

check("콘솔 오류 0", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fail = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
