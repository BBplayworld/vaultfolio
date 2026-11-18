// 재설계 4차 시각안 캡처 — preview(데모, cb36907) 불리기 화면 본문을 mock-redesign4.html로 바꿔 찍는다. 코드 수정 0, 데모 값만.
// node mock-redesign4-shot.mjs <OUT>
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const html = readFileSync(new URL("./mock-redesign4.html", import.meta.url), "utf8");
const css = html.match(/<style id="mk-style">([\s\S]*?)<\/style>/)[1]; const js = html.match(/<script id="mk-script">([\s\S]*?)<\/script>/)[1].replace(/\nif \(document\.body[\s\S]*$/, "");
const b = await chromium.launch({ proxy });
const jobs = [ // [이름, 폭, 높이, 옵션, fullPage, 요소 선택자]
  ["390-first", 390, 844, {}, false, null], ["390-review", 390, 844, {}, false, '[data-mk="review"]'], ["390-card", 390, 844, { open: "Apple" }, false, '[data-mk="list"]'],
  ["390-full", 390, 844, { open: "Apple" }, true, null], ["320-first", 320, 844, {}, false, null], ["1280", 1280, 900, {}, false, null], ["1280-full", 1280, 900, { open: "Apple" }, true, null],
];
for (const [name, W, H, opts, full, sel] of jobs) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(6000);
  const info = await p.evaluate(({ css, js, opts }) => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    // eslint-disable-next-line no-new-func
    const renderMock = new Function(`${js}; return renderMock;`)();
    const title = document.querySelector('[data-testid="grow-title"]'); const card = title.closest('[data-slot="card"]') ?? title.closest("div.min-w-0");
    const content = card.querySelector('[data-slot="card-content"]') ?? card.children[1];
    content.innerHTML = '<div id="mk-root"></div>'; const meta = renderMock(content.querySelector("#mk-root"), opts);
    document.querySelector('[data-testid="grow-hint"]')?.remove();
    scrollTo(0, 0); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; });
    const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null; };
    const rows = [...document.querySelectorAll('[data-mk="row"] > .mk-c:first-child')].map((e) => Math.round(e.getBoundingClientRect().bottom));
    const nameW = [...document.querySelectorAll(".mk-name")].map((e) => e.scrollWidth + "/" + e.clientWidth).join(" "); const plW = [...document.querySelectorAll(".mk-pl")].map((e) => Math.round(e.getBoundingClientRect().right - e.parentElement.getBoundingClientRect().right)).join(","); const over = [...document.querySelectorAll(".mk *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" && !e.classList.contains("mk-mini")).map((e) => e.className + ":" + e.textContent.slice(0, 20));
    const hits = [...document.querySelectorAll(".mk-tabs button, .mk-g, .mk-chip, .mk-cycle, .mk-rv-row, .mk-choices span")].map((e) => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.height + (e.classList.contains("mk-chip") ? 12 : 0), 999)); });
    return { nameW, plW, meta, vh: innerHeight, hero: y('[data-mk="hero"]'), axes: y('[data-mk="axes"]'), review: y('[data-mk="review"]'), reviewTop: (() => { const e = document.querySelector('[data-mk="review"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(), listHead: y(".mk-th"), rows, docW: document.documentElement.scrollWidth, over, minHit: Math.min(...hits) };
  }, { css, js, opts });
  console.log(name, JSON.stringify(info));
  await p.waitForTimeout(400);
  if (sel) await p.locator(sel).screenshot({ path: `${OUT}/redesign4-${name}.png` }); else await p.screenshot({ path: `${OUT}/redesign4-${name}.png`, fullPage: full });
  await ctx.close();
}
await b.close();
