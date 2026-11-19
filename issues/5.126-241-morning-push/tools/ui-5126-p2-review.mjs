// ui-designer p2 검수 캡처 — preview(5.126)·운영(5.127) × 320·390·1280 × 다크·라이트, 체험(/?trial=1)
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const SITES = { pv: "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app", prod: "https://www.secretasset.xyz" };
const OUT = process.argv[2]; const only = process.argv[3];
const br = await chromium.launch({ proxy }); const out = {};
for (const [site, base] of Object.entries(SITES)) for (const scheme of ["dark", "light"]) for (const W of [320, 390, 1280]) {
  const id = `${site}-${W}-${scheme}`; if (only && !id.includes(only)) continue;
  const o = (out[id] = { errors: [] });
  try {
  const touch = W < 1100;
  const ctx = await br.newContext({ viewport: { width: W, height: touch ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: touch });
  await ctx.addCookies([{ name: "theme_mode", value: scheme, url: base }]);
  const p = await ctx.newPage(); p.on("pageerror", (e) => o.errors.push(String(e).slice(0, 120)));
  await p.goto(`${base}/?trial=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  o.htmlDark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 40000 }); await p.waitForTimeout(3500);
  o.version = await p.evaluate(() => (document.body.innerText.match(/v?5\.\d{3}/) || [null])[0]);
  o.seg = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="report-tab-"]')].map((b) => ({ id: b.dataset.testid, t: b.innerText.replace(/\n/g, " / "), h: Math.round(b.getBoundingClientRect().height) })));
  o.rows = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].filter((b) => b.offsetParent).map((b) => { const q = (e) => e.getBoundingClientRect(); const rate = b.querySelector('[data-testid="grow-row-rate"]'); const r = q(rate); const c = q(b.querySelector("svg.lucide-chevron-right")); const bb = q(b); const name = b.querySelector("span"); const n = q(name); const lh = parseFloat(getComputedStyle(name).lineHeight); const due = b.querySelector('[data-testid="grow-row-due"]'); const mid = (x) => (x.top + x.bottom) / 2; const rd = (v) => Math.round(v * 10) / 10;
    // 숫자 글리프 광학 중심: Range로 텍스트 rect
    const rg = document.createRange(); rg.selectNodeContents(rate); const tr = rate.textContent ? rg.getBoundingClientRect() : r;
    return { name: name.textContent.slice(0, 12), rate: rate.textContent, nameLines: Math.round(n.height / lh), rowH: Math.round(bb.height), dyRate: rd(mid(c) - mid(tr)), dyRowMid: rd(mid(c) - mid(bb)), dyNameFirstLine: rd(mid(c) - (n.top + lh / 2)), chevRight: rd(bb.right - c.right), gapRateChev: rd(c.left - r.right), due: due ? { dyChev: rd(mid(q(due)) - mid(c)), rightVsRate: rd(q(due).right - r.right), rightVsChev: rd(q(due).right - c.right) } : null }; }));
  o.docW = await p.evaluate(() => document.documentElement.scrollWidth);
  const card = p.locator('[data-testid="report-panel-grow"]'); 
  await p.screenshot({ path: `${OUT}/${id}-rows.png` });
  const row0 = p.locator('[data-testid="grow-row"]').first(); await row0.scrollIntoViewIfNeeded();
  const list = p.locator('[data-testid="grow-row"]').first().locator("xpath=.."); await list.screenshot({ path: `${OUT}/${id}-rowlist.png` }).catch((e) => o.errors.push("rowlist " + String(e).slice(0, 80)));
  // 행 펼침 (화살표 회전 상태)
  await p.locator('[data-testid="grow-row-toggle"]').first().click(); await p.waitForTimeout(600);
  o.openChev = await p.evaluate(() => { const b = document.querySelector('[data-testid="grow-row-toggle"][aria-expanded="true"]'); if (!b) return null; const c = b.querySelector("svg.lucide-chevron-right").getBoundingClientRect(); const r = b.querySelector('[data-testid="grow-row-rate"]').getBoundingClientRect(); return { dy: Math.round((((c.top + c.bottom) / 2) - ((r.top + r.bottom) / 2)) * 10) / 10, tf: getComputedStyle(b.querySelector("svg.lucide-chevron-right")).rotate }; });
  await p.screenshot({ path: `${OUT}/${id}-row-open.png` });
  await p.locator('[data-testid="grow-row-toggle"]').first().click(); await p.waitForTimeout(400);
  // 성적표 칸
  await p.evaluate(() => scrollTo(0, 0)); await p.click('[data-testid="report-tab-grade"]'); await p.waitForTimeout(2500);
  o.grade = await p.evaluate(() => { const q = (e) => e.getBoundingClientRect(); const rd = (v) => Math.round(v * 10) / 10; const panel = document.querySelector('[data-testid="report-panel-grade"]'); const h = document.querySelector('[data-testid="report-grade-hint"]'); const title = document.querySelector('[data-testid="report-section-title"]');
    const words = [...document.querySelectorAll("body *")].filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() === "자산 성적표")).map((e) => e.dataset.testid || e.tagName + "." + String(e.className).slice(0, 40));
    const res = { sectionTitle: !!(title && title.offsetParent), words, firstText: panel.innerText.slice(0, 40).replace(/\n+/g, " / "), docW: document.documentElement.scrollWidth, coarse: matchMedia("(pointer: coarse)").matches };
    if (h) { const hero = h.parentElement; const btn = h.querySelector("button"); const svg = btn.querySelector("svg"); const er = q(hero), br_ = q(btn), sr = q(svg); const af = getComputedStyle(btn, "::after"); const inset = af.content !== "none" && af.position === "absolute" ? -parseFloat(af.top) : 0;
      const hit = { l: br_.left - inset, t: br_.top - inset, r: br_.right + inset, b: br_.bottom + inset };
      const trophy = hero.querySelector("svg.lucide-trophy") || hero.querySelector("svg"); const tr = q(trophy);
      // 히트영역과 겹치는 다른 누를 수 있는 요소
      const clash = [...document.querySelectorAll("button, a, [role=button], [role=tab]")].filter((e) => e !== btn && e.offsetParent).map((e) => ({ e, r: q(e) })).filter(({ r }) => r.left < hit.r && r.right > hit.l && r.top < hit.b && r.bottom > hit.t).map(({ e }) => e.dataset.testid || e.innerText.slice(0, 20));
      const tabs = document.querySelector('[data-testid="report-tabs"]'); 
      res.hint = { icon: [rd(sr.width), rd(sr.height)], fromRight: rd(er.right - sr.right), fromTop: rd(sr.top - er.top), afterInset: inset, hitW: rd(hit.r - hit.l), hitH: rd(hit.b - hit.t), hitOutsideHero: { top: rd(er.top - hit.t), right: rd(hit.r - er.right) }, gapTabsToHit: tabs ? rd(hit.t - q(tabs).bottom) : null, clash, heroRadius: getComputedStyle(hero).borderRadius, heroPad: getComputedStyle(hero).paddingTop, trophyTop: rd(tr.top - er.top), trophyRightGapToIcon: rd(sr.left - tr.right), color: getComputedStyle(btn).color, heroBg: getComputedStyle(hero).backgroundColor, heroOverflow: getComputedStyle(hero).overflow, centerEl: (() => { const cx = (hit.l + hit.r) / 2, cy = (hit.t + hit.b) / 2; const e = document.elementFromPoint(cx, cy); return e ? (e.closest("button")?.getAttribute("aria-label") || e.tagName) : null; })(), cornerEl: (() => { const e = document.elementFromPoint(hit.l + 2, hit.b - 2); return e ? (e.closest("button")?.getAttribute("aria-label") || e.tagName) : null; })() }; }
    else if (title) { const btn = title.parentElement.parentElement.querySelector('button[aria-label="설명 보기"]'); if (btn) { const b = q(btn); res.oldHint = { top: rd(b.top), left: rd(b.left) }; } }
    const hero = [...panel.querySelectorAll("div")].find((d) => /rounded-xl/.test(d.className) && d.querySelector("svg.lucide-trophy")); if (hero) res.heroTopFromTabs = rd(q(hero).top - q(document.querySelector('[data-testid="report-tabs"]')).bottom);
    return res; });
  await p.screenshot({ path: `${OUT}/${id}-grade.png` });
  // 5축 ⓘ 열림
  const hb = site === "pv" ? p.locator('[data-testid="report-grade-hint"] button') : p.locator('[data-testid="report-panel-grade"] button[aria-label="설명 보기"]').first();
  if (!touch) await hb.hover(); else await hb.tap(); await p.waitForTimeout(800);
  const pop = () => p.evaluate(() => { const c = document.querySelector('[data-slot="popover-content"]'); if (!c) return null; const r = c.getBoundingClientRect(); const t = document.querySelector('button[aria-label="설명 보기"][data-state="open"]')?.getBoundingClientRect(); 
    // 글자 단위 어절 끊김: 각 텍스트 노드의 어절(공백 구분)이 2개 이상 줄에 걸치는지
    const broken = []; const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); const full = c.innerText; 
    for (const pEl of c.querySelectorAll("p")) { const rg = document.createRange(); const nodes = []; const w = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) nodes.push(n); let chars = []; for (const nd of nodes) for (let i = 0; i < nd.textContent.length; i++) { const ch = nd.textContent[i]; if (ch === " " || ch === "\n") { chars.push({ ch: " " }); continue; } rg.setStart(nd, i); rg.setEnd(nd, i + 1); const rr = rg.getBoundingClientRect(); chars.push({ ch, top: Math.round(rr.top) }); }
      let word = "", tops = new Set(); const flush = () => { if (word && tops.size > 1) { const a = [...tops]; if (Math.max(...a) - Math.min(...a) > 6) broken.push(word); } word = ""; tops = new Set(); }; for (const x of chars) { if (x.ch === " ") flush(); else { word += x.ch; tops.add(x.top); } } flush(); }
    return { text: c.innerText.slice(0, 30), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, triggerBottom: t ? Math.round(t.bottom) : null, broken }; });
  o.gradeHintOpen = await pop();
  await p.screenshot({ path: `${OUT}/${id}-grade-hint.png` });
  if (!touch) await p.mouse.move(5, 5); else await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // 투입 대비 성과 ⓘ
  const b2 = p.locator('[data-testid="report-panel-grade"] button[aria-label="설명 보기"]').nth(1); await b2.scrollIntoViewIfNeeded(); if (!touch) await b2.hover(); else await b2.tap(); await p.waitForTimeout(800);
  o.paren = await pop();
  await p.screenshot({ path: `${OUT}/${id}-paren.png` });
  if (!touch) await p.mouse.move(5, 5); else await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  // 키보드: ⓘ 포커스 링
  if (site === "pv") { await hb.scrollIntoViewIfNeeded(); await hb.focus(); await p.waitForTimeout(300); o.focus = await p.evaluate(() => { const b = document.activeElement; const s = getComputedStyle(b); return { label: b.getAttribute("aria-label"), outline: s.outlineStyle + " " + s.outlineWidth, ring: s.boxShadow.slice(0, 60) }; }); await p.keyboard.press("Escape"); }
  await ctx.close();
  } catch (e) { o.errors.push("FATAL " + String(e).slice(0, 300)); }
}
console.log(JSON.stringify(out, null, 1)); await br.close();
