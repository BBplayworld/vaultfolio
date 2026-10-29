// #32 보완 — 연 탭 변화 원인 preview 점검. 실행: node .memory/qa/year-check.mjs <previewURL> [스크린샷 폴더]
// 데모(?demo=1)는 작년 수동 순자산 6억 + 올해 레거시 1달·enrich 3달(운영 형태)을 가진다. 운영 형태를 더 짙게(1~6월 레거시 추가,
// 전년 12월 스냅샷 없음) 주입한 상태와, 작년 값을 지운 첫 해 상태를 localStorage로 만들어 점검한다(preview 도메인만).
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
// mode: "ops" = 작년 수동값 유지 + 올해 1~6월 레거시 월 스냅샷 추가(전년 12월 없음) / "first" = 작년 수동값 삭제(첫 해)
const inject = async (page, mode) => {
  await page.evaluate((mode) => {
    const now = new Date(Date.now() + 9 * 3600e3);
    const y = now.getUTCFullYear(), py = y - 1, cm = now.getUTCMonth() + 1;
    const a = JSON.parse(localStorage.getItem("secretasset_asset_data"));
    a.yearlyNetAssets = a.yearlyNetAssets.filter((v) => v.year !== py);
    if (mode === "ops") a.yearlyNetAssets.push({ year: py, netAsset: 600000000, note: "데모" });
    localStorage.setItem("secretasset_asset_data", JSON.stringify(a));
    let m = JSON.parse(localStorage.getItem("secretasset_monthly_snapshots") || "[]").filter((s) => s.month !== `${py}-12`);
    if (mode === "ops") {
      for (let i = 1; i <= Math.min(6, cm - 4); i++) {
        const mm = `${y}-${String(i).padStart(2, "0")}`;
        if (!m.some((s) => s.month === mm)) m.push({ month: mm, netAsset: 600000000 + i * 1500000, financialAsset: 38000000 });
      }
    }
    m.sort((p, q) => p.month.localeCompare(q.month));
    localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(m));
  }, mode);
  await page.goto(`${BASE}/`); await page.waitForTimeout(3500);
};
const rowsAndSum = async (page) => {
  await page.waitForSelector('[data-testid="cause-block"]', { timeout: 10000 }).catch(() => {});
  const d = Number(await tid(page, "change-hero-delta").getAttribute("data-value"));
  const vals = await page.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-value"))));
  return { d, vals, sum: vals.reduce((x, z) => x + z, 0) };
};

{
  const { ctx, page, errors } = await open(375);
  // 27. 데모 그대로(작년 수동값 + 레거시·enrich 월): 원인 행 표시
  await goYear(page);
  let r = await rowsAndSum(page);
  const scopes = await page.locator('[data-testid="cause-block"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-scope")));
  check("19 전체·연 원인 블록 1벌", scopes.length === 1 && scopes[0] === "year", JSON.stringify(scopes));
  check("27 데모 — 행 ≥ 1, 기록 부족 0, 합계 = Hero", r.vals.length >= 1 && (await tid(page, "cause-insufficient").count()) === 0 && Math.abs(r.sum - r.d) < 10000, `delta=${r.d} sum=${r.sum} rows=${r.vals.length}`);
  const heroBox = await tid(page, "change-hero").boundingBox();
  const blockBox = await page.locator('[data-testid="cause-block"]').boundingBox();
  const rowBox = await page.locator('[data-testid^="cause-row-"]').first().boundingBox();
  const chartBox = await page.getByText(/년도별 순자산/).first().boundingBox();
  check("26 Hero 아래 원인, 그 아래 차트·목록 / 첫 행 y < 812", heroBox && blockBox && chartBox && blockBox.y > heroBox.y + heroBox.height - 1 && chartBox.y > blockBox.y + blockBox.height - 1 && rowBox.y < 812, `hero=${heroBox?.y}+${heroBox?.height} block=${blockBox?.y} row=${rowBox?.y} chart=${chartBox?.y}`);
  check("26 진행 중 배지", (await tid(page, "year-inprogress").count()) === 1, await tid(page, "change-hero-title").textContent());
  check("21 첫 구간 예측 배지", (await tid(page, "cause-estimated-badge").count()) >= 1, await tid(page, "cause-estimated-badge").first().textContent().catch(() => ""));
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

  // 27(C20). 운영 형태 짙게: 1~6월 레거시 추가, 전년 12월 스냅샷 없음
  await inject(page, "ops");
  await goYear(page);
  r = await rowsAndSum(page);
  check("27 운영 형태 — 행 ≥ 1, 기록 부족 0, 합계 = Hero", r.vals.length >= 1 && (await tid(page, "cause-insufficient").count()) === 0 && Math.abs(r.sum - r.d) < 10000, `delta=${r.d} sum=${r.sum} rows=${r.vals.length}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "r3-year-ops-375-dark.png") });
  const loanV = await page.locator('[data-testid="cause-row-loan"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-value"))));
  const unrecV = await page.locator('[data-testid="cause-row-unrecorded"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-value"))));
  check("28 대출 ≤ 0, 기록 안 된 변화와 반대 부호 아님", loanV.every((v) => v <= 0) && !(loanV[0] < 0 && unrecV[0] > 0), `loan=${loanV} unrec=${unrecV}`);

  // 24. 첫 해(작년 값 없음): 블록 없음, 연도별 카드 정상
  await inject(page, "first");
  await goYear(page);
  await page.waitForTimeout(1500);
  check("24 첫 해 — cause-block 0, 연도별 카드 표시", (await tid(page, "cause-block").count()) === 0 && (await page.getByText(/년도별 (순자산|데이터)/).count()) > 0);
  check("콘솔 오류 0", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
if (SHOTS) {
  const { ctx, page } = await open(1280);
  await goYear(page);
  await page.waitForSelector('[data-testid="cause-block"]', { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: path.join(SHOTS, "r3-year-1280-dark.png") });
  await ctx.close();
}
await browser.close();
const fail = results.filter((r) => !r).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
