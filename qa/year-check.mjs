// #32 보완 — 연 탭 변화 원인 preview 점검. 실행: node .memory/qa/year-check.mjs <previewURL> [스크린샷 폴더]
// 데모에는 전년 연도별 값·전년 12월 스냅샷이 없어(첫 해 상태) 점검 중에 localStorage로 주입한다(preview 도메인만, 운영 무관).
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "noop.js"))("playwright");
const BASE = (process.argv[2] || "").replace(/\/$/, "");
const SHOTS = process.argv[3] || "";
const HOST = new URL(BASE).hostname;
const results = [];
const check = (id, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`); };
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });

async function open(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 812 }, deviceScaleFactor: 2, isMobile: width < 1024, hasTouch: width < 1024 });
  await ctx.addCookies([{ name: "theme_mode", value: "dark", domain: HOST, path: "/", secure: true }]);
  await ctx.addInitScript(() => {
    window.__ga = []; window.gtag = (...a) => window.__ga.push(a);
    localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?demo=1`);
  await page.waitForSelector('html[data-demo-ready="1"]', { timeout: 30000, state: "attached" });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const goYear = async (page) => { await page.evaluate(() => { location.hash = "#activity/netasset"; }); await page.waitForTimeout(2000); }; // → 전체·연 직행(월 탭 미경유)
// 전년 연도별 값(수동 입력 가정 6억)·전년 12월 월 스냅샷 주입 후 새로고침
const inject = async (page, withDec) => {
  await page.evaluate((withDec) => {
    const py = new Date(Date.now() + 9 * 3600e3).getUTCFullYear() - 1;
    const a = JSON.parse(localStorage.getItem("secretasset_asset_data"));
    a.yearlyNetAssets = [...a.yearlyNetAssets.filter((y) => y.year !== py), { year: py, netAsset: 600000000, note: "데모" }];
    localStorage.setItem("secretasset_asset_data", JSON.stringify(a));
    const m = JSON.parse(localStorage.getItem("secretasset_monthly_snapshots") || "[]").filter((s) => s.month !== `${py}-12`);
    if (withDec) m.push({
      month: `${py}-12`, date: `${py}-12-28`, netAsset: 598000000, financialAsset: 39000000,
      breakdown: { realEstate: 580000000, stocks: 22000000, crypto: 4500000, cash: 12500000, loans: 21000000, tenantDeposit: 0 },
      fx: { USD: 1430, JPY: 940 }, fxBase: { USD: 3500000, JPY: 0 },
      cost: { total: 538000000, stock: 20500000, crypto: 5000000, realEstate: 500000000 },
    });
    m.sort((x, y) => x.month.localeCompare(y.month));
    localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(m));
  }, withDec);
  await page.goto(`${BASE}/`); await page.waitForTimeout(3500);
};

{
  const { ctx, page, errors } = await open(375);
  // 24. 첫 해(전년 값 없음): 원인 블록 없음, 차트 정상
  await goYear(page);
  check("24 첫 해 — cause-block 0, 연도별 카드(빈 안내) 표시", (await tid(page, "cause-block").count()) === 0 && (await page.getByText(/년도별 (순자산|데이터)/).count()) > 0);

  // 정상: 전년 값 + 12월 스냅샷
  await inject(page, true);
  await goYear(page);
  const block = page.locator('[data-testid="cause-block"][data-scope="year"]');
  await page.waitForSelector('[data-testid="cause-block"]', { timeout: 10000 }).catch(() => {}); // 새로고침 직후 자산 로드 대기
  const scopes = await page.locator('[data-testid="cause-block"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-scope")));
  check("19 전체·연 원인 블록 1벌", scopes.length === 1 && scopes[0] === "year", JSON.stringify(scopes));
  const heroBox = await tid(page, "change-hero").boundingBox();
  const blockBox = await block.boundingBox();
  const rowBox = await page.locator('[data-testid^="cause-row-"]').first().boundingBox();
  const chartBox = await page.getByText("년도별 순자산").boundingBox();
  check("26 Hero 아래 원인, 그 아래 차트·목록 / 첫 행 y < 812", heroBox && blockBox && chartBox && blockBox.y > heroBox.y + heroBox.height - 1 && chartBox.y > blockBox.y + blockBox.height - 1 && rowBox.y < 812, `hero=${heroBox?.y}+${heroBox?.height} block=${blockBox?.y} row=${rowBox?.y} chart=${chartBox?.y}`);
  check("26 진행 중 배지", (await tid(page, "year-inprogress").count()) === 1, await tid(page, "change-hero-title").textContent());
  const d = Number(await tid(page, "change-hero-delta").getAttribute("data-value"));
  const vals = await page.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-value"))));
  const sum = vals.reduce((a, b) => a + b, 0);
  check("20 원인 합 = Hero 증감", Number.isFinite(d) && Math.abs(sum - d) < 10000, `delta=${d} sum=${sum} rows=${vals.length}`);
  const ga = await page.evaluate(() => window.__ga.filter((a) => a[1] === "settlement_view").length);
  check("26 연 탭 진입 settlement_view 0회", ga === 0, `ga=${ga}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "r3-year-375-dark.png") });

  // 19. 월 탭에는 month 블록 1벌, 주식·연에는 원인 없음
  await tid(page, "change-period-month").click(); await page.waitForTimeout(1200);
  check("19 월 탭 원인은 month 1벌", (await page.locator('[data-testid="cause-block"][data-scope="month"]').count()) === 1 && (await page.locator('[data-testid="cause-block"][data-scope="year"]').count()) === 0);
  await tid(page, "change-period-year").click(); await page.waitForTimeout(800);
  await tid(page, "change-scope-stock").click(); await page.waitForTimeout(1200);
  check("19 주식·연 cause-row 0", (await page.locator('[data-testid^="cause-row-"]').count()) === 0);
  await tid(page, "change-scope-all").click(); await page.waitForTimeout(800);

  // 25. 허브·성적표에 원인 복제 없음
  await page.evaluate(() => { location.hash = "#activity"; }); await page.waitForTimeout(1500);
  const hubRows = await page.locator('[data-testid^="cause-row-"]').count();
  await page.evaluate(() => { location.hash = "#activity/report"; }); await page.waitForTimeout(2000);
  const repRows = await page.locator('[data-testid^="cause-row-"]').count();
  check("25 허브·성적표 cause-row 0", hubRows === 0 && repRows === 0, `hub=${hubRows} report=${repRows}`);

  // 기록 부족: 12월 스냅샷 없음
  await inject(page, false);
  await goYear(page);
  check("기록 부족 — cause-insufficient 1줄, 행 0", (await tid(page, "cause-insufficient").count()) === 1 && (await page.locator('[data-testid^="cause-row-"]').count()) === 0);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "r3-year-insufficient-375-dark.png") });
  check("콘솔 오류 0", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
if (SHOTS) {
  const { ctx, page } = await open(1280);
  await inject(page, true);
  await goYear(page);
  await page.screenshot({ path: path.join(SHOTS, "r3-year-1280-dark.png") });
  await ctx.close();
}
await browser.close();
const fail = results.filter((r) => !r).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
