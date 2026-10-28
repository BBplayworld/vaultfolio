// #32 r2 preview 점검 스크립트 (자산 변화 Hero·상단 컨트롤·월 결산). 전역 playwright 사용.
// 실행: node .memory/qa/settlement-check.mjs <previewURL> [스크린샷 폴더]
//  - 기능 점검: 375×812 다크(완료 기준 1~10·13·15·16 중 자동화 가능 항목)
//  - 상태 7종 스크린샷: 375·1280 × 라이트·다크 → r2-<상태>-<폭>-<테마>.png (완료 기준 14)
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
const HOST = new URL(BASE).hostname;

const results = [];
const check = (id, ok, detail = "") => { results.push({ id, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`); };
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });

async function open({ width = 375, theme = "dark", demo = "1", reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: width >= 1024 ? 900 : 812 }, deviceScaleFactor: 2,
    isMobile: width < 1024, hasTouch: width < 1024, reducedMotion,
  });
  await ctx.addCookies([{ name: "theme_mode", value: theme, domain: HOST, path: "/", secure: true }]);
  // gtag 스텁 — settlement_view 발화 횟수 집계(금액 파라미터 없음 확인 포함). 값은 ga.ts가 한글 라벨로 바꿔 보낸다(card=결산 카드, menu=메뉴)
  await ctx.addInitScript(() => {
    window.__ga = [];
    window.gtag = (...a) => window.__ga.push(a);
    localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_PROXY|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?demo=${demo}`);
  await page.waitForSelector('html[data-demo-ready="1"]', { timeout: 30000, state: "attached" });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const goHash = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(1500); };
const gaCount = (page) => page.evaluate(() => window.__ga.filter((a) => a[0] === "event" && a[1] === "settlement_view").map((a) => a[2]));
const checked = (page, id) => tid(page, id).getAttribute("aria-checked");

// ───────────── 기능 점검 (375 다크) ─────────────
{
  const { ctx, page, errors } = await open();

  // 1. 허브 3카드 + 결산 배지
  await goHash(page, "#activity");
  const cards = await Promise.all(["hub-card-change", "hub-card-dividend", "hub-card-report"].map((t) => tid(page, t).count()));
  const oldCard = await tid(page, "settlement-card").count();
  const badge = (await tid(page, "hub-change-settlement-badge").count()) ? await tid(page, "hub-change-settlement-badge").textContent() : null;
  check("1 허브 카드 3개·결산 카드 흡수", cards.every((c) => c === 1) && oldCard === 0, `cards=${cards} settlement-card=${oldCard} badge=${badge}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "r2-hub-375-dark.png"), fullPage: true });

  // 9-a. 허브 카드(창 안) → source=card 1회
  await tid(page, "hub-card-change").locator("div").first().click();
  await page.waitForTimeout(1800);
  let ga = await gaCount(page);
  check("9 허브 카드 진입 settlement_view 1회", ga.length === 1 && ga[0].source === (badge ? "결산 카드" : "메뉴") && !Object.keys(ga[0]).some((k) => /amount|value|net/i.test(k)), JSON.stringify(ga));

  // 2. 컨트롤 구조
  const tablist = await page.locator('[role="tablist"]').count();
  const scopeG = await page.locator('[role="radiogroup"][aria-label="범위 선택"]').count();
  const periodG = await page.locator('[role="radiogroup"][aria-label="기간 선택"]').count();
  const periodInHero = await page.locator('[data-testid="change-hero"] [role="radiogroup"][aria-label="기간 선택"]').count();
  check("2 Radix 탭 없음·radiogroup 각 1개·기간은 Hero 안", tablist === 0 && scopeG === 1 && periodG === 1 && periodInHero === 1, `tablist=${tablist} scope=${scopeG} period=${periodG} inHero=${periodInHero}`);

  // 3. 첫 화면 위치
  const deltaBox = await tid(page, "change-hero-delta").boundingBox();
  const causeBox = await page.locator('[data-testid^="cause-row-"]').first().boundingBox();
  check("3 증감 y ≤ 200, 첫 원인 행 y < 812", deltaBox && deltaBox.y <= 200 && causeBox && causeBox.y < 812, `delta.y=${deltaBox?.y?.toFixed(1)} cause.y=${causeBox?.y?.toFixed(1)}`);

  // 4. 히트영역
  const boxes = await page.locator('[role="radiogroup"][aria-label="범위 선택"] [role="radio"], [role="radiogroup"][aria-label="기간 선택"] [role="radio"], [data-testid="settlement-prev-month"], [data-testid="settlement-next-month"]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  check("4 컨트롤 히트영역 ≥ 40×40", boxes.length === 8 && boxes.every(([w, h]) => w >= 40 && h >= 40), JSON.stringify(boxes));

  // 5. 항등식
  const v = async (id) => Number(await tid(page, id).getAttribute("data-value"));
  const [d, s, e] = [await v("change-hero-delta"), await v("change-hero-start"), await v("change-hero-end")];
  const causeVals = await page.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.map((x) => Number(x.getAttribute("data-value"))));
  const sum = causeVals.reduce((a, b) => a + b, 0);
  check("5 증감 = 끝 − 시작, 원인 합 = 증감", Math.abs(d - (e - s)) <= 1 && Math.abs(sum - d) < 10000, `delta=${d} end-start=${e - s} sum=${sum}`);

  // 6. 중복 문구
  const rootText = (await page.locator("main").textContent()) || (await page.textContent("body"));
  const titleCount = (rootText.match(/\d+월 결산/g) || []).length;
  const bad = ["순자산 비교", "무엇이 바꿨나요"].filter((t) => rootText.includes(t));
  check("6 순자산 비교·배지·월 칩 없음, 'N월 결산' 1회", bad.length === 0 && (await tid(page, "settlement-month-item").count()) === 0 && (await tid(page, "settlement-range").count()) === 0 && titleCount === 1, `bad=${bad} titleCount=${titleCount}`);
  check("6 매수·매도·상환 문구 없음", !/매수|매도|상환/.test((await tid(page, "settlement-root").textContent()) || ""));

  // C19. 캘린더 추가 = 같은 출처 정적 .ics 링크(blob·download 미사용) + text/calendar 응답
  const icsBtn = tid(page, "prep-ics-button");
  const icsHref = await icsBtn.getAttribute("href");
  const icsDownloadAttr = await icsBtn.getAttribute("download");
  const [icsReq] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/calendar/secretasset-monthly-settlement.ics"), { timeout: 10000 }).catch(() => null),
    icsBtn.click({ noWaitAfter: true }),
  ]);
  const icsResp = icsReq ? await icsReq.response().catch(() => null) : null;
  const icsType = icsResp ? icsResp.headers()["content-type"] : null;
  check("C19 캘린더 버튼 → 정적 .ics URL 이동·text/calendar", icsHref === "/calendar/secretasset-monthly-settlement.ics" && icsDownloadAttr === null && !!icsReq && /text\/calendar/.test(icsType || ""), `href=${icsHref} download=${icsDownloadAttr} type=${icsType}`);
  if (!page.url().includes("#activity/change")) { await page.goBack().catch(() => {}); await page.waitForTimeout(1500); }

  // 15. 공유 캡처 숨김 속성
  const hideArrows = await page.locator('[data-screenshot-hide] [data-testid="settlement-prev-month"]').count();
  const hideSel = await page.locator('[data-screenshot-hide] [role="radiogroup"]').count();
  const prepHidden = await page.locator('[data-screenshot-hide] [data-testid="prep-ics-button"]').count();
  const staleBadge = await tid(page, "hero-stale-badge").count();
  const staleHidden = await page.locator('[data-testid="hero-stale-badge"][data-screenshot-hide]').count();
  check("15 화살표·다음 달 준비·이전 값 배지 숨김, 선택기는 표시", hideArrows === 1 && hideSel === 0 && prepHidden === 1 && staleHidden === staleBadge, `arrows=${hideArrows} sel=${hideSel} prep=${prepHidden} stale=${staleBadge}/${staleHidden}`);

  // 8. 월 화살표
  const nextDisabled = await tid(page, "settlement-next-month").isDisabled();
  const t0 = await tid(page, "settlement-title").textContent();
  const titles = [t0];
  while (!(await tid(page, "settlement-prev-month").isDisabled())) {
    await tid(page, "settlement-prev-month").click();
    await page.waitForTimeout(500);
    titles.push(await tid(page, "settlement-title").textContent());
    if (titles.length > 14) break;
  }
  const estimated = await tid(page, "cause-estimated-badge").count();
  const firstMonth = await tid(page, "settlement-first-month").count();
  ga = await gaCount(page);
  check("8 화살표 이동·끝에서 비활성·추가 발화 없음", nextDisabled && titles.length >= 2 && new Set(titles).size === titles.length && ga.length === 1, `titles=${titles.join(" | ")} ga=${ga.length}`);
  check("8 가장 오래된 달 = 첫 달 상태", firstMonth === 1, `first=${firstMonth}`);
  // 추정 배지: 레거시 시작 달로 한 칸 앞으로
  await tid(page, "settlement-next-month").click();
  await page.waitForTimeout(500);
  check("추정 상태(예측 배지)", (await tid(page, "cause-estimated-badge").count()) > 0 || estimated > 0, `title=${await tid(page, "settlement-title").textContent()}`);

  // 9-b. 월→주→월 재발화(menu), 주식 범위 0회
  await tid(page, "change-period-week").click(); await page.waitForTimeout(600);
  await tid(page, "change-period-month").click(); await page.waitForTimeout(1200);
  ga = await gaCount(page);
  check("9 월→주→월 추가 1회(menu)", ga.length === 2 && ga[1].source === "메뉴", JSON.stringify(ga));
  await tid(page, "change-scope-stock").click(); await page.waitForTimeout(1200);
  ga = await gaCount(page);
  check("9 주식 범위 전환 0회", ga.length === 2 && (await tid(page, "settlement-root").count()) === 0, `ga=${ga.length}`);
  check("주식 Hero 표시", (await tid(page, "change-hero").count()) === 1, await tid(page, "change-hero-title").textContent().catch(() => ""));
  await tid(page, "change-scope-all").click(); await page.waitForTimeout(800);

  // 10. 키보드
  await tid(page, "change-period-month").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  const yearOn = await checked(page, "change-period-year");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  await page.keyboard.press("Tab");
  const afterTab = await page.evaluate(() => !!document.activeElement?.closest('[aria-label="기간 선택"]'));
  check("10 → 키 선택·포커스 유지·Tab 1회로 이탈", yearOn === "true" && focused === "change-period-year" && !afterTab, `year=${yearOn} focus=${focused} inGroupAfterTab=${afterTab}`);

  // 13. 기간 전환에도 썸이 같은 노드로 유지(재마운트 없음)되고 transform만 바뀌어 미끄러진다
  await page.evaluate(() => { window.__thumb = document.querySelector('[data-testid="change-hero"] [aria-label="기간 선택"] [data-slot="thumb"]'); window.__tx = window.__thumb?.style.transform; });
  for (const p of ["week", "day", "month", "stock-scope", "day"]) {
    if (p === "stock-scope") { await tid(page, "change-scope-stock").click(); } else await tid(page, `change-period-${p}`).click();
    await page.waitForTimeout(150);
  }
  const sameNode = await page.evaluate(() => document.querySelector('[data-testid="change-hero"] [aria-label="기간 선택"] [data-slot="thumb"]') === window.__thumb && window.__thumb.style.transform !== window.__tx);
  check("13 기간·범위 전환 후 썸 동일 노드 + transform 변경", sameNode);
  await tid(page, "change-scope-all").click(); await page.waitForTimeout(600);

  // 13. 모션 클래스
  const thumbCls = await page.locator('[aria-label="기간 선택"] [data-slot="thumb"]').getAttribute("class");
  const btnCls = await tid(page, "change-period-day").getAttribute("class");
  check("13 transition-all 없음·motion-safe 접두", !/transition-all/.test(thumbCls + btnCls) && /motion-safe:transition-\[transform\]/.test(thumbCls), thumbCls);

  // 7. 성적표
  await goHash(page, "#activity/report");
  await page.waitForTimeout(1500);
  const repText = await page.textContent("body");
  const attrSel = await page.locator('[aria-label="원인분해 기간"]').count();
  check("7 성적표 '왜?' 섹션·원인분해 기간 없음", !repText.includes("순자산 변화, 왜?") && attrSel === 0);
  const growthBtn = page.locator('xpath=//span[normalize-space(text())="장기 순자산 성장"]/ancestor::div[.//button][1]//button').last();
  if (await growthBtn.count()) {
    await growthBtn.click(); await page.waitForTimeout(1500);
    check("7 growth 링크 → 전체·연", (await checked(page, "change-scope-all")) === "true" && (await checked(page, "change-period-year")) === "true");
  } else check("7 growth 링크 → 전체·연", false, "growth 링크 없음(측정 전 상태일 수 있음)");

  // 16. 옛 해시·FAB
  await goHash(page, "#activity/netasset");
  check("16 #activity/netasset → 전체·연", (await checked(page, "change-period-year")) === "true" && page.url().endsWith("#activity/change"), page.url());
  await goHash(page, "#activity/profit");
  check("16 #activity/profit → 주식·일", (await checked(page, "change-scope-stock")) === "true" && (await checked(page, "change-period-day")) === "true");
  // FAB은 홈에만 있다: 홈 → 자산 업데이트 → 보유 현황 업데이트 → 과거 순자산
  await goHash(page, "");
  await page.locator('[aria-label="자산 업데이트"]:visible').first().click();
  await page.waitForTimeout(600);
  await page.getByText("보유 현황 업데이트").first().click();
  await page.waitForTimeout(600);
  await page.getByText("과거 순자산", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const dlg = await page.getByText("년도별 순자산 추가").count();
  check("16 FAB 과거 순자산 → 전체·연 + 입력 다이얼로그", dlg > 0 && (await checked(page, "change-period-year")) === "true", `dialog=${dlg}`);

  check("콘솔 오류 0", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 13-b. reduced motion — 썸 transition-duration 0
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  await goHash(page, "#activity/change");
  const dur = await page.locator('[aria-label="기간 선택"] [data-slot="thumb"]').evaluate((el) => getComputedStyle(el).transitionDuration);
  check("13 reduced-motion 썸 transition-duration 0", /^0s/.test(dur), dur);
  await ctx.close();
}

// ───────────── 상태 7종 스크린샷 (375·1280 × 라이트·다크) ─────────────
if (SHOTS) {
  for (const width of [375, 1280]) {
    for (const theme of ["light", "dark"]) {
      const name = (s) => path.join(SHOTS, `r2-${s}-${width}-${theme}.png`);
      const { ctx, page } = await open({ width, theme });
      await goHash(page, "#activity/change");
      await page.waitForTimeout(800);
      await page.screenshot({ path: name("selected") });
      await tid(page, "change-hero").screenshot({ path: name("disabled") }); // 최신 달: 다음 달 화살표 비활성
      // 체크리스트 10 — 일·주·연 Hero 구조 비교용
      for (const p of ["day", "week", "year"]) {
        await tid(page, `change-period-${p}`).click(); await page.waitForTimeout(900);
        await page.screenshot({ path: name(`period-${p}`) });
      }
      await tid(page, "change-period-month").click(); await page.waitForTimeout(1200);
      // 추정(레거시 시작 달) → 첫 달
      for (let i = 0; i < 14 && !(await tid(page, "cause-estimated-badge").count()); i++) {
        if (await tid(page, "settlement-prev-month").isDisabled()) break;
        await tid(page, "settlement-prev-month").click(); await page.waitForTimeout(500);
      }
      await page.screenshot({ path: name("estimated") });
      for (let i = 0; i < 14 && !(await tid(page, "settlement-prev-month").isDisabled()); i++) {
        await tid(page, "settlement-prev-month").click(); await page.waitForTimeout(400);
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: name("first-month") });
      // 로딩 — 주식 기준가 요청 지연
      await page.route("**/api/finance/profit**", async (r) => { await new Promise((ok) => setTimeout(ok, 15000)); await r.continue().catch(() => {}); });
      await tid(page, "change-scope-stock").click(); await page.waitForTimeout(1200);
      await page.screenshot({ path: name("loading") });
      await page.unroute("**/api/finance/profit**").catch(() => {});
      await ctx.close();
      // 오류·빈 상태는 데모 데이터로 재현 불가(엔진이 손상 입력에도 예외를 던지지 않고, 자산 0건이면 첫 페이지로 간다).
      // 코드 분기(settlement-view.tsx settlement-error·settlement-empty)로만 확인한다.
    }
  }
  console.log("스크린샷 저장:", SHOTS);
}

await browser.close();
const fail = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
