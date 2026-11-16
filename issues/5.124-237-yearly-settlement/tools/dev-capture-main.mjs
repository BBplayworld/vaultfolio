// 5.124 preview 자가 확인 — 가짜 시드(localStorage) + 시계 고정 + /api 차단(스냅샷 저장 건너뜀). 사용자 데이터 없음.
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE, ONLY] = process.argv;
const seeds = JSON.parse(readFileSync(SEEDS, "utf8"));
const b = await chromium.launch({ proxy });
const WIDTHS = { "s2-mixed": [[390, "dark"], [1280, "dark"]], "s2-mixed-march-deposit": [[390, "dark"]], "s1-measured": [[390, "dark"], [1280, "dark"]], "s6-january": [[390, "dark"], [1280, "dark"]], "s3-estimated-only": [[390, "dark"], [1280, "dark"]], "long9": [[360, "dark"], [320, "dark"]] };
const report = {};
for (const [name, s] of Object.entries(seeds)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  for (const [W, scheme] of WIDTHS[name] ?? [[390, "dark"]]) {
    const ctx = await b.newContext(ctxOpt(W, scheme));
    await ctx.clock.setFixedTime(new Date(`${s.clock}T03:00:00Z`)); // KST 정오
    const ga = [];
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) { ga.push(u); return route.fulfill({ status: 204, body: "" }); }
      if (/\/api\/finance/.test(u)) return route.fulfill({ status: 503, headers: { "X-KIS-Unavailable": "1", "content-type": "application/json" }, body: JSON.stringify({ error: "차단(자가 확인)" }) });
      if (/\/api\//.test(u)) return route.abort();
      return route.continue();
    });
    await ctx.addInitScript(({ s, scheme }) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("secretasset_asset_data", JSON.stringify(s.data));
      localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(s.monthly));
      localStorage.setItem("secretasset_daily_snapshots", JSON.stringify(s.daily));
      localStorage.setItem("secretasset_exchange_rate", JSON.stringify(s.rates));
      localStorage.setItem("secretasset_exchange_last_sync_date", s.clock);
      localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" }));
      localStorage.setItem("theme", scheme);
    }, { s, scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + "/#activity/change", { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => console.log("goto", e.message));
    await p.waitForSelector('[data-testid="change-period-year"]', { timeout: 25000 }).catch(() => {});
    await p.locator('[data-testid="change-period-year"]').first().click({ timeout: 8000 }).catch((e) => console.log(name, "year click", e.message));
    await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll("[data-sonner-toaster]").forEach((e) => { e.style.display = "none"; }));
    const tag = `${name}-${W}-${scheme}`;
    const measure = () => p.evaluate(() => {
      const q = (id) => document.querySelector(`[data-testid="${id}"]`);
      const r = (e) => { if (!e) return null; const x = e.getBoundingClientRect(); return { y: Math.round(x.top + scrollY), h: Math.round(x.height * 10) / 10, right: Math.round(x.right * 10) / 10 }; };
      const blk = q("year-settle") ?? document.querySelector('[data-testid="cause-block"]');
      const hero = q("change-hero");
      const amountRights = blk ? [...blk.querySelectorAll('[data-testid^="year-settle-group-"], [data-testid="cause-row-unrecorded"], [data-testid="year-settle-period-row"]')].filter((e) => !e.closest('[data-testid="year-settle-grow-panel"]')).map((e) => { const spans = [...e.querySelectorAll("span")].filter((x) => /[+\-−]?[\d,]+원?$/.test(x.textContent.trim()) && x.children.length === 0); const last = spans.at(-1); return last ? Math.round(last.getBoundingClientRect().right * 10) / 10 : null; }) : [];
      const yearly = JSON.parse(localStorage.getItem("secretasset_asset_data") || "{}").yearlyNetAssets;
      return {
        state: blk?.dataset.state ?? null, split: blk?.dataset.split ?? null, block: r(blk), text: blk?.innerText.replace(/\n+/g, " | ") ?? null,
        heroText: hero?.innerText.replace(/\n+/g, " | "), heroDelta: q("change-hero-delta")?.dataset.value ?? null,
        values: blk ? Object.fromEntries([...blk.querySelectorAll("[data-value]")].map((e) => [e.dataset.testid, e.dataset.value])) : null,
        amountRights, overflowX: document.documentElement.scrollWidth - innerWidth, next: r(blk?.nextElementSibling), yearly,
        oldBlock: !!document.querySelector('[data-testid="cause-block"][data-scope="year"]'),
      };
    });
    const m = await measure();
    m.ga = ga.filter((u) => /collect/.test(u)).map((u) => decodeURIComponent((/[?&]dt=([^&]*)/.exec(u) || [])[1] || "") + "|" + ((/[?&]en=([^&]*)/.exec(u) || [])[1] || "")).filter((x) => /결산|feature_use/.test(x));
    m.errs = errs;
    await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    const toggle = p.locator('[data-testid="year-settle-grow-toggle"]');
    if (await toggle.count() && (WIDTHS[name] ?? []).length) {
      await toggle.click(); await p.waitForTimeout(500);
      m.openBlockH = (await measure()).block?.h;
      await p.screenshot({ path: `${OUT}/${tag}-open.png`, fullPage: true });
    }
    if (name === "s2-link") {
      await p.locator('[data-testid="year-settle-cash-link"]').click().catch((e) => { m.linkErr = e.message; });
      await p.waitForTimeout(1500);
      m.linkHash = await p.evaluate(() => location.hash);
      await p.screenshot({ path: `${OUT}/${tag}-after-link.png` });
    }
    if (name === "s2-mixed-march-deposit" || name === "s4f-first-year-split-register" || name === "s9-no-cash") {
      const sel = name === "s9-no-cash" ? '[data-testid="year-settle-group-in"] button[aria-label="설명 보기"]' : name === "s2-mixed-march-deposit" ? '[data-testid="year-settle-period-row"] button[aria-label="설명 보기"]' : '[data-testid="cause-row-unrecorded"] button[aria-label="설명 보기"]';
      const hint = p.locator(sel).first();
      await hint.tap().catch(() => hint.click().catch(() => {}));
      await p.waitForTimeout(700);
      m.popover = await p.evaluate(() => document.querySelector('[data-radix-popper-content-wrapper]')?.innerText.replace(/\n+/g, " | ") ?? null);
      await p.screenshot({ path: `${OUT}/${tag}-hint-open.png` });
    }
    report[tag] = m;
    console.log(tag, JSON.stringify(m));
    await ctx.close();
  }
}
await b.close();
