// #31 preview 점검 스크립트 (spec 완료 기준 10~17). 저장소 의존성 없이 전역 playwright 사용.
// 실행: node .memory/qa/preview-check.mjs <previewURL> [스크린샷 폴더]
// 예:   node .memory/qa/preview-check.mjs https://secretasset-git-issue-434-bbplayworlds-projects.vercel.app .memory/issues/31-preview-safety/shots
// 기준 17(운영 컴포넌트 diff)은 저장소 루트에서 git으로 검사한다(BRANCH 환경변수, 기본 issue-4.34).
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

// ESM은 NODE_PATH를 무시하므로 전역 node_modules에서 직접 해석
const globalRoot = process.env.NODE_PATH || execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = createRequire(path.join(globalRoot, "noop.js"))("playwright");

const BASE = (process.argv[2] || "").replace(/\/$/, "");
const SHOTS = process.argv[3] || "";
const BRANCH = process.env.BRANCH || "issue-4.34";
if (!BASE) { console.error("usage: node preview-check.mjs <previewURL> [shotsDir]"); process.exit(2); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (id, ok, detail = "") => { results.push({ id, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`); };

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });
const net = { sync: 0, ga: 0, consoleErrors: [] };

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/sync")) net.sync++;
    if (/google-analytics\.com|googletagmanager\.com/.test(u)) net.ga++;
  });
  page.on("console", (m) => { if (m.type() === "error") net.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => net.consoleErrors.push(String(e)));
  return { ctx, page };
}
const waitReady = (page) => page.waitForSelector('html[data-demo-ready="1"]', { timeout: 30000, state: "attached" });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };
const isWelcome = async (page) => (await page.getByRole("heading", { name: "나만의 비밀 자산 금고" }).count()) > 0;
const assetCounts = (page) => page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("secretasset_asset_data") || "{}");
  return ["realEstate", "stocks", "crypto", "cash", "loans"].map((k) => (d[k] || []).length).join(",");
});

// ── 10·11·14·16: ?demo=1, 멱등, 배지, 성과 이동 ──
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?demo=1`);
  await waitReady(page);
  await page.waitForTimeout(2500);
  const search = await page.evaluate(() => location.search);
  const counts1 = await assetCounts(page);
  check("10 ?demo=1 → demoReady·쿼리 제거·홈", !search.includes("demo") && !(await isWelcome(page)) && counts1 !== "0,0,0,0,0", `search=${search} counts=${counts1}`);
  await shot(page, "10-demo-home.png");

  await page.evaluate(() => { delete document.documentElement.dataset.demoReady; });
  await page.goto(`${BASE}/?demo=1`);
  await waitReady(page);
  await page.waitForTimeout(1500);
  const counts2 = await assetCounts(page);
  check("11 ?demo=1 재접속 멱등", counts1 === counts2 && !(await isWelcome(page)), `${counts1} vs ${counts2}`);

  const badge = page.locator('[data-testid="preview-badge"]');
  const text = (await badge.textContent())?.trim() || "";
  const hide = await badge.getAttribute("data-screenshot-hide");
  const bb = await badge.boundingBox();
  const btnBoxes = await page.evaluate(() => [...document.querySelectorAll("button, a")]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.top < 60)
    .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  const overlap = bb && btnBoxes.some((r) => r.x < bb.x + bb.width && bb.x < r.x + r.w && r.y < bb.y + bb.height && bb.y < r.y + r.h);
  check("14 배지 형식·속성·한 줄·헤더 버튼 비겹침", /^PREVIEW · v4\.\d+$/.test(text) && hide !== null && bb && bb.height <= 24 && !overlap, `text="${text}" h=${bb?.height} overlap=${overlap}`);

  const before = net.consoleErrors.length;
  // 브라우저 모드는 하단 nav가 숨겨져 있어 상단 헤더의 "성과" 세그먼트로 이동
  const nav = page.locator("header").getByText("성과", { exact: true });
  const navFound = (await nav.count()) > 0;
  if (navFound) { await nav.first().click({ force: true }); await page.waitForTimeout(2500); }
  await shot(page, "16-activity.png");
  const errs = net.consoleErrors.slice(before);
  check("16 홈→성과 콘솔 오류 0·GA 0", navFound && errs.length === 0 && net.ga === 0, `errors=${errs.length} ga=${net.ga}${errs.length ? " " + errs.slice(0, 3).join(" | ") : ""}`);
  await ctx.close();
}

// ── 12: ?demo=empty ──
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/?demo=1`);
  await waitReady(page);
  await page.goto(`${BASE}/?demo=empty`);
  await waitReady(page);
  await page.waitForTimeout(1500);
  const cardGone = (await page.locator('[data-testid="preview-demo-btn"]').count()) === 0;
  check("12 ?demo=empty → 웰컴·카드 없음", (await isWelcome(page)) && cardGone && (await assetCounts(page)) === "0,0,0,0,0");
  await shot(page, "12-empty.png");
  await ctx.close();
}

// ── 13: 쿼리 없는 첫 접속 → 버튼 2개, 각각 탭 ──
for (const [btn, expectWelcome] of [["preview-demo-btn", false], ["preview-empty-btn", true]]) {
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector('[data-testid="preview-demo-btn"]', { timeout: 30000 });
  const both = (await page.locator('[data-testid="preview-empty-btn"]').count()) === 1;
  if (btn === "preview-demo-btn") await shot(page, "13-choice.png");
  await page.locator(`[data-testid="${btn}"]`).click();
  await waitReady(page);
  await page.waitForTimeout(1500);
  check(`13 첫 접속 버튼 2개 → ${btn}`, both && (await isWelcome(page)) === expectWelcome);
  await ctx.close();
}

// ── 15: #sync 해시 접속 ──
{
  const { ctx, page } = await newPage();
  await page.goto(`${BASE}/#sync=preview-check-dummy`);
  await page.waitForTimeout(4000);
  await ctx.close();
}
check("15 /api/sync 요청 0건(#sync 포함 전체)", net.sync === 0, `sync=${net.sync}`);

await browser.close();

// ── 17: 운영 컴포넌트 diff ──
try {
  const out = execSync(`git diff --stat origin/main...origin/${BRANCH} -- "src/app/(main)/_components/layout/onboarding/welcome-guide.tsx" src/app/api/sync/`, { encoding: "utf8" }).trim();
  check("17 WelcomeGuide·api/sync 무변경", out === "", out);
} catch (e) {
  check("17 WelcomeGuide·api/sync 무변경", false, String(e).slice(0, 200));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
