import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const PV = (b) => `https://secretasset-git-issue-${b}-bbplayworlds-projects.vercel.app`;
const br = await chromium.launch({ proxy });
const R = `(e)=>{if(!e)return null;const b=e.getBoundingClientRect();const f=n=>Math.round(n*10)/10;return{x:f(b.left),y:f(b.top),h:f(b.height),b:f(b.bottom),r:f(b.right),w:f(b.width)}}`;
async function open(base, W, H, { clearCache = false, ctx: given } = {}) {
  const ctx = given ?? await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  const reqs = [];
  p.on("request", (r) => { if (r.url().includes("/api/finance/profit")) reqs.push(r.url().replace(/^https?:\/\/[^/]+/, "")); });
  if (clearCache) { await p.goto(`${PV(base)}/?demo=1`, { waitUntil: "domcontentloaded" }).catch(() => {}); await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("secretasset_profit:")) localStorage.removeItem(k); }); reqs.length = 0; await p.reload({ waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); }
  else await p.goto(`${PV(base)}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(7000);
  return { p, ctx, reqs };
}
const measure = (p) => p.evaluate((Rs) => {
  const R = eval(Rs); const $ = (s) => document.querySelector(s);
  const my = $('[data-testid="home-my-stock"]'); const slot = $('[data-testid="home-my-stock-slot"]');
  const card = (slot || $('[data-testid="home-cause-line"]') || $('[data-testid="home-market-today"]'))?.closest(".rounded-lg");
  const cl = $('[data-testid="home-cause-line"]'); const co = $('[data-testid="home-cause-collapse"]');
  const name = my?.querySelector(".truncate"); const more = $('[data-testid="home-my-stock-more"]'); const tail = more?.parentElement;
  return { text: my?.innerText.replace(/\s+/g, " ").trim(), aria: my?.getAttribute("aria-label"), state: slot?.dataset.state, sign: $('[data-testid="home-my-stock-rate"]')?.dataset.sign,
    card: R(card), my: R(my), donut: R($('[data-testid="home-donut"]')), seg: R($('[aria-label="자산 분포 필터"]')), cause: R(cl), causeExpanded: cl?.getAttribute("aria-expanded"), collapse: co && !co.closest("[inert]") ? R(co) : null,
    nameCut: name ? name.scrollWidth > name.clientWidth : null, moreVisible: more ? R(more).y < R(tail).b - 1 : null, tip: R($('[data-testid="home-tip"]')),
    scrollW: document.documentElement.scrollWidth, vw: innerWidth, rateText: $('[data-testid="home-my-stock-rate"]')?.innerText };
}, R);
const hideDelta = async (p) => { const a = await measure(p); await p.evaluate(() => { const s = document.querySelector('[data-testid="home-my-stock-slot"]'); if (s) s.style.display = "none"; }); await p.waitForTimeout(150); const b = await measure(p); await p.evaluate(() => { const s = document.querySelector('[data-testid="home-my-stock-slot"]'); if (s) s.style.display = ""; }); await p.waitForTimeout(150); return { donutWith: a.donut?.y, donutWithout: b.donut?.y, delta: a.donut && b.donut ? Math.round((a.donut.y - b.donut.y) * 10) / 10 : null, cardDelta: Math.round((a.card.b - b.card.b) * 10) / 10 }; };
const log = (k, v) => console.log(k, JSON.stringify(v));
console.log("시각(UTC)", new Date().toISOString());
for (const [W, H] of [[390, 844], [320, 640], [1280, 900]]) {
  const { p, ctx, reqs } = await open("5132", W, H);
  const m = await measure(p); log(`${W} 접힘`, m); log(`${W} 접힘 밀림`, await hideDelta(p));
  await p.screenshot({ path: `${OUT}/dev-${W}-home.png` });
  if (m.cause && m.causeExpanded === "false") {
    await p.click('[data-testid="home-cause-line"]'); await p.waitForTimeout(600);
    const o = await measure(p); log(`${W} 펼침`, o); log(`${W} 펼침 밀림`, await hideDelta(p));
    await p.screenshot({ path: `${OUT}/dev-${W}-open.png` });
    await p.click('[data-testid="home-cause-collapse"]'); await p.waitForTimeout(600);
  }
  log(`${W} 요청(캐시 상태 그대로 첫 진입)`, reqs);
  if (W === 390) {
    // 재방문(캐시 있음)
    const r2 = await open("5132", W, H, { ctx }); log("390 재방문 요청", r2.reqs); log("390 재방문 줄", (await measure(r2.p)).text);
    // 캐시 없음
    const r3 = await open("5132", W, H, { ctx, clearCache: true }); log("390 캐시 없음 요청", r3.reqs);
    // 도착: 줄 누름 → 상세·주식 행 칩
    await r3.p.click('[data-testid="home-my-stock"]'); await r3.p.waitForTimeout(4000);
    const rows = await r3.p.evaluate(() => [...document.querySelectorAll('[data-testid="stock-row-left"]')].map((l) => { const card = l.closest("[class*='rounded']")?.parentElement ?? l.parentElement; return (card.innerText || "").replace(/\s+/g, " ").slice(0, 160); }));
    log("도착 hash", await r3.p.evaluate(() => location.hash)); log("도착 행", rows);
    await r3.p.screenshot({ path: `${OUT}/dev-390-arrive.png` });
  }
  await ctx.close();
}
// 비교: 5131(줄 없음) 요청 수
for (const clear of [false, true]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark", isMobile: true, hasTouch: true });
  const a = await open("5131", 390, 844, { ctx }); const b = await open("5131", 390, 844, { ctx, clearCache: clear });
  log(`5131 첫 진입 / ${clear ? "캐시 없음" : "재방문"} 요청`, [a.reqs.length, b.reqs.length]);
  if (!clear) log("5131 390 기준 좌표", await measure(b.p));
  await ctx.close();
}
await br.close();
