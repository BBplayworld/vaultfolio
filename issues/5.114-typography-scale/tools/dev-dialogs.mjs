import { chromium, PV as PV0, proxy, ctxOpt } from "./lib.mjs";
const PV = process.env.BASE || PV0;
import fs from "node:fs";
const OUT = process.argv[2]; const widths = process.argv[3].split(",").map(Number); const VERBOSE = process.argv[4] === "v";
const judge = () => {
  const roots = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[data-radix-popper-content-wrapper],[data-sonner-toast]')];
  const out = { n: roots.length, docOver: document.documentElement.scrollWidth > innerWidth, issues: [], titles: [], fs: {} };
  for (const root of roots) {
    const rr = root.getBoundingClientRect();
    if (rr.right > innerWidth + 1 || rr.left < -1) out.issues.push(`root-out ${Math.round(rr.left)}~${Math.round(rr.right)}`);
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("svg,.sr-only")) continue; if (el.querySelector(":scope > .sr-only") && !el.innerText.replace("Close","").trim()) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      const txt = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24);
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
      if (own) { const f = cs.fontSize; out.fs[f] = (out.fs[f] || 0) + 1; if (parseFloat(f) < 11 && !el.closest(".type-fixed")) out.issues.push(`small ${f} '${txt}'`); }
      // 가로 넘침: 스크롤 컨테이너가 아닌데 내용이 넘침
      if (el.scrollWidth > el.clientWidth + 1 && !["auto", "scroll"].includes(cs.overflowX) && !el.closest(".type-fixed") && cs.display !== "inline") {
        const trunc = cs.textOverflow === "ellipsis";
        out.issues.push(`${trunc ? "ellipsis" : cs.overflowX === "hidden" ? "clipX" : "overX"} ${el.tagName.toLowerCase()} '${txt}' ${el.scrollWidth}>${el.clientWidth}`);
      }
      if (cs.overflowY === "hidden" && el.scrollHeight > el.clientHeight + 1 && own && !el.closest(".type-fixed") && !/line-clamp/.test(el.className)) out.issues.push(`clipY ${el.tagName.toLowerCase()} '${txt}' ${el.scrollHeight}>${el.clientHeight}`);
      // 버튼·제목 줄 수
      if (el.matches("button,[role=button],[role=tab],[role=radio],h2,[data-slot=dialog-title],[data-slot=sheet-title],label")) {
        const rg = document.createRange(); rg.selectNodeContents(el);
        const tops = []; for (const q of rg.getClientRects()) { if (q.width > 0.5 && !tops.some((t) => Math.abs(t - q.top) < q.height * 0.6)) tops.push(q.top); }
        const isTitle = el.matches("h2,[data-slot=dialog-title],[data-slot=sheet-title]");
        if (isTitle) out.titles.push(`${cs.fontSize}/${cs.fontWeight} '${txt}' ${tops.length}줄`);
        else if (tops.length > 1 && el.matches("button,[role=button],[role=tab],[role=radio]") && el.querySelectorAll("p,div,span").length < 2) out.issues.push(`wrap ${el.tagName.toLowerCase()} '${txt}' ${tops.length}줄`);
      }
      if (r.right > innerWidth + 1 && cs.position !== "fixed") { let a = el.parentElement, sc = false; while (a && a !== root.parentElement) { if (["auto", "scroll"].includes(getComputedStyle(a).overflowX)) { sc = true; break; } a = a.parentElement; } if (!sc && own) out.issues.push(`offscreen '${txt}' r=${Math.round(r.right)}`); }
    }
  }
  out.issues = [...new Set(out.issues)].slice(0, 25);
  out.btns = roots.flatMap((root) => [...root.querySelectorAll("button,[role=button],a,[role=tab],[role=radio],[role=option],[role=menuitem],[role=combobox]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ((e.dataset.testid ? "#" + e.dataset.testid + " " : "") + (e.getAttribute("aria-label") || e.innerText || "").trim().replace(/\s+/g, " ").slice(0, 22)))).slice(0, 50);
  return out;
};
const b = await chromium.launch({ proxy });
const summary = [];
for (const W of widths) {
  const ctx = await b.newContext(ctxOpt(W)); const p = await ctx.newPage();
  const load = async () => { await p.goto(PV + "/", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(2500); const d = p.locator('[data-testid="preview-demo-btn"]'); if (await d.count()) { await d.click(); await p.waitForTimeout(3500); } };
  const check = async (name) => { await p.waitForTimeout(900); const j = await p.evaluate(judge); await p.screenshot({ path: `${OUT}/${name}-${W}.png` }); const line = `${W} ${name} dlg=${j.n} ${j.docOver ? "DOC-OVER " : ""}titles=${JSON.stringify(j.titles)} fs=${JSON.stringify(j.fs)} issues=${JSON.stringify(j.issues)}`; console.log(line); if (VERBOSE) console.log("   btns", JSON.stringify(j.btns)); summary.push({ W, name, ...j }); return j; };
  const esc = async (n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(500); } };
  const hash = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(1500); };
  const click = async (sel, opt = {}) => { const l = typeof sel === "string" ? p.locator(sel) : sel; if (!(await l.count())) { console.log(`   (없음) ${sel}`); return false; } await l.first().click({ timeout: 5000, ...opt }).catch((e) => console.log("   clickERR", String(sel), e.message.slice(0, 80))); await p.waitForTimeout(1200); return true; };
  const steps = (await import(process.argv[5] || "./steps.mjs")).default;
  await load();
  for (const [name, fn] of steps) { try { await fn({ p, check, esc, hash, click, load, W }); } catch (e) { console.log(`ERR ${W} ${name}`, e.message.slice(0, 200)); await load(); } }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/summary-${widths.join("_")}.json`, JSON.stringify(summary));
await b.close();
