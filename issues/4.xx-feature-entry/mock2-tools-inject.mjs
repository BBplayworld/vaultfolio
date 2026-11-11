// v2 '내 주식 도구' 묶음 목업 — 운영 ?trial=1 상세·주식 DOM에 주입(코드 수정 아님)
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/noop.js")("playwright");
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const BASE = "https://www.secretasset.xyz";
const OUT = process.env.OUT || "m2";
const widths = (process.env.W || "375").split(",").map(Number);
const themes = (process.env.T || "light,dark").split(",");
const b = await chromium.launch({ proxy });

const ICONS = {
  chev: '<path d="m9 18 6-6-6-6"/>',
  market: '<path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18v3"/><path d="M8 14v7"/>',
  xray: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
  tax: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
};
const svg = (k, cls) => `<svg class="${cls} shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

for (const theme of themes) for (const w of widths) {
  const mobile = w < 640;
  const ctx = await b.newContext({ viewport: { width: w, height: mobile ? 812 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const p = await ctx.newPage();
  const tag = `${w}-${theme}`;
  await p.goto(`${BASE}/?trial=1`, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  const dark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
  if (dark !== (theme === "dark")) console.log("THEME MISMATCH", tag);
  const go = async (hash, ms = 3000) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };

  for (const variant of ["T-A", "T-B"]) {
    await go("#home", 1500);
    await go("#detail/stocks", 4500);
    await p.evaluate(({ variant, svgSrc, ICONS }) => {
      const svg = eval(svgSrc);
      const wrap = document.querySelector('[data-testid="stock-market-entry-wrap"]');
      const vals = [...wrap.querySelectorAll("span.whitespace-nowrap")].map((s) => s.textContent.trim()).filter((t) => /%/.test(t));
      const fmt = (t) => { const m = t.match(/^(.*?)\s*(-?[\d.]+%)$/); return m ? `${m[1]} <span class="font-semibold text-foreground tabular-nums">${m[2].replace("-", "−")}</span>` : t; };
      wrap.style.display = "none";
      const xray = [...document.querySelectorAll("button")].find((x) => /X-RAY/i.test(x.textContent));
      const tax = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "세금 계산해 보기");
      const xTop = xray?.querySelector("span.truncate")?.textContent.split(" · ")[0] ?? "대형주 75%";
      const xm = xTop.match(/^(.*?)\s*([\d.]+%)$/);
      const xHtml = xm ? `${xm[1]} <span class="font-semibold text-foreground tabular-nums">${xm[2]}</span>` : xTop;
      const items = [
        { k: "market", name: "시장과 비교", val: `1주 ${fmt(vals[0] ?? "코스피 -7.8%")}`, valWide: `1주 ${vals.map(fmt).join('<span class="mx-1.5 text-muted-foreground/60">·</span>')}` },
        { k: "xray", name: "X-Ray 분석", val: xHtml, valWide: xHtml },
        { k: "tax", name: "해외주식 세금", val: `올해 마감 <span class="font-semibold text-foreground tabular-nums">D-50</span>`, valWide: `올해 마감 <span class="font-semibold text-foreground tabular-nums">D-50</span> · 1년 합산 기본공제`, wide: true },
      ];
      const host = document.createElement("div");
      host.setAttribute("data-mock", "tools");
      if (variant === "T-A") {
        host.className = "grid grid-cols-2 gap-2";
        host.innerHTML = items.map((it) => `<button type="button" class="${it.wide ? "col-span-2 " : ""}min-w-0 flex flex-col items-start gap-1.5 rounded-lg dark:rounded-xl bg-muted/50 dark:bg-card dark:shadow-sm px-3 py-3 text-left">
            <span class="flex w-full items-center gap-1.5">${svg(it.k, "size-4 text-primary")}<span class="text-sm font-semibold text-foreground whitespace-nowrap">${it.name}</span><span class="ml-auto text-muted-foreground">${svg("chev", "size-4")}</span></span>
            <span class="w-full text-sm text-muted-foreground break-keep leading-snug">${it.wide ? it.valWide : it.val}</span></button>`).join("");
      } else {
        host.className = "rounded-lg dark:rounded-xl bg-muted/50 dark:bg-card dark:shadow-sm overflow-hidden divide-y divide-border dark:divide-border/40";
        host.innerHTML = items.map((it) => `<button type="button" class="flex w-full min-h-12 items-center gap-3 px-3 py-2.5 text-left">
            ${svg(it.k, "size-4 text-primary")}
            <span class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
              <span class="text-sm font-semibold text-foreground whitespace-nowrap">${it.name}</span>
              <span class="text-sm text-muted-foreground break-keep sm:ml-auto sm:text-right">${it.valWide}</span>
            </span>
            <span class="text-muted-foreground">${svg("chev", "size-4")}</span></button>`).join("");
      }
      xray.replaceWith(host);
      tax?.remove();
      window.scrollTo(0, 0);
    }, { variant, svgSrc: svg.toString().replace(/ICONS\[k\]/, "ICONS[k]"), ICONS });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/mock2-tools-${variant}-${tag}.png` });
  }
  await ctx.close();
  console.log("done", tag);
}
await b.close();
