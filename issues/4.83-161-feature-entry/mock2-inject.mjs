// v2 진입점 재설계 목업 — 운영 ?trial=1 실제 화면 DOM에 제안 구조를 주입해 캡처(코드 수정 아님)
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/noop.js")("playwright");
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const BASE = "https://www.secretasset.xyz";
const OUT = process.env.OUT || "m2";
const widths = (process.env.W || "375").split(",").map(Number);
const themes = (process.env.T || "light,dark").split(",");
const b = await chromium.launch({ proxy });

const CHEV = (cls = "size-5") => `<svg class="${cls} shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
// 스파크라인(목업 데이터) — 선 = 1년 등락 손익색, 점선 = 내 평단(foreground/40, 종목 한 장과 같은 표현)
const SPARK = (w, h, up = true) => {
  const ys = [0.78, 0.7, 0.74, 0.6, 0.66, 0.52, 0.56, 0.44, 0.5, 0.36, 0.4, 0.28, 0.33, 0.2, 0.24, 0.12];
  const pts = ys.map((y, i) => `${(i / (ys.length - 1)) * (w - 2) + 1},${(up ? y : 1 - y) * (h - 4) + 2}`).join(" ");
  const avg = Math.round(h * 0.62);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" class="shrink-0 overflow-visible"><line x1="0" x2="${w}" y1="${avg}" y2="${avg}" stroke="currentColor" class="text-foreground/40" stroke-width="1.25" stroke-dasharray="3 3"/><polyline points="${pts}" fill="none" stroke="currentColor" class="${up ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
};

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
  const S = (n) => p.screenshot({ path: `${OUT}/mock2-${n}-${tag}.png` });
  const reload = async (hash) => { await go("#home", 1500); await go(hash, 3500); };

  // ── 상세·주식 상단: S-A(요약 카드 하단 트레이 행) ──
  await go("#detail/stocks", 4000);
  const idx = await p.evaluate(() => {
    const wrap = document.querySelector('[data-testid="stock-market-entry-wrap"]');
    const vals = [...(wrap?.querySelectorAll("span.whitespace-nowrap") ?? [])].map((s) => s.textContent.trim()).filter((t) => /%/.test(t));
    return vals;
  });
  const idxHtml = (idx.length ? idx : ["코스피 -7.8%", "S&P 500 -2.2%"]).map((t) => {
    const m = t.match(/^(.*?)\s*([+\-−]?[\d.]+%)$/);
    const name = m ? m[1] : t, v = m ? m[2].replace("-", "−") : "";
    return `<span class="whitespace-nowrap">${name} <span class="font-semibold text-foreground tabular-nums">${v}</span></span>`;
  }).join('<span aria-hidden class="mx-1.5 text-muted-foreground/60">·</span>');
  const applySA = (idxHtml, CHEV) => {
    const wrap = document.querySelector('[data-testid="stock-market-entry-wrap"]');
    const box = wrap.parentElement;
    wrap.style.display = "none";
    const dark = document.documentElement.classList.contains("dark");
    const tray = document.createElement("button");
    tray.type = "button";
    tray.className = "flex w-full items-center gap-3 text-left";
    Object.assign(tray.style, {
      margin: "16px -16px -16px", width: "calc(100% + 32px)", padding: "10px 12px 10px 16px", minHeight: "56px",
      borderRadius: "0 0 inherit inherit",
      borderBottomLeftRadius: getComputedStyle(box).borderBottomLeftRadius, borderBottomRightRadius: getComputedStyle(box).borderBottomRightRadius,
      background: dark ? "color-mix(in oklab, var(--muted) 45%, transparent)" : "color-mix(in oklab, var(--card) 60%, transparent)",
    });
    tray.innerHTML = `<span class="min-w-0 flex-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <span class="text-sm font-semibold text-foreground whitespace-nowrap">시장과 비교</span>
        <span class="text-sm text-muted-foreground break-keep"><span class="max-[359px]:hidden">최근 </span>1주 ${idxHtml}</span>
      </span>
      <span class="text-muted-foreground">${CHEV()}</span>`;
    box.appendChild(tray);
  };
  await p.evaluate(({ idxHtml, CHEV: c, fn }) => { const CHEV = eval(c); eval(fn)(idxHtml, CHEV); }, { idxHtml, CHEV: CHEV.toString(), fn: applySA.toString() });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 0));
  await S("stocks-top-A");

  // ── S-B: 요약 카드 아래 2분할 타일(시장과 비교 | X-Ray), 기존 X-Ray 스트립 흡수 ──
  await reload("#detail/stocks");
  await p.evaluate(({ idxHtml, CHEV: c }) => {
    const CHEV = eval(c);
    const wrap = document.querySelector('[data-testid="stock-market-entry-wrap"]');
    wrap.style.display = "none";
    const xray = [...document.querySelectorAll("button")].find((b) => /X-RAY/i.test(b.textContent));
    const xsum = xray?.querySelector("span.truncate")?.textContent ?? "";
    const tile = (label, body) => `<button type="button" class="min-w-0 flex flex-col items-start gap-1 rounded-lg dark:rounded-xl bg-muted/50 dark:bg-card dark:shadow-sm px-3 py-2.5 text-left" style="min-height:64px">
        <span class="flex w-full items-center justify-between gap-1"><span class="text-sm font-semibold text-foreground whitespace-nowrap">${label}</span><span class="text-muted-foreground">${CHEV("size-4")}</span></span>
        <span class="w-full text-sm text-muted-foreground break-keep leading-snug">${body}</span></button>`;
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-2 gap-2";
    const first = idxHtml.split('<span aria-hidden')[0];
    grid.innerHTML = tile("시장과 비교", `1주 ${first}`) + tile("X-Ray 분석", xsum);
    xray.replaceWith(grid);
  }, { idxHtml, CHEV: CHEV.toString() });
  await p.waitForTimeout(300);
  await S("stocks-top-B");

  // ── 종목 한 장: 펼침 상단 이름 띠 → 행 전체 탭(R-A 스파크라인 / R-C 글자만) ──
  const applyR = async (variant) => {
    await reload("#detail/stocks");
    const ok = await p.evaluate(({ variant, CHEV: c, SPARK: s }) => {
      const CHEV = eval(c), SPARK = eval(s);
      const old = document.querySelector('[data-testid="stock-page-entry"]');
      if (!old) return false;
      const strip = old.closest("div.flex.items-start");
      const left = strip.firstElementChild; // 이름·티커·배지
      const w = window.innerWidth;
      const sw = w >= 1024 ? 160 : w >= 640 ? 120 : w < 360 ? 72 : 96;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = strip.className.replace("items-start", "items-center") + " w-full text-left hover:bg-muted/60";
      btn.style.minHeight = "56px";
      const sub = variant === "A"
        ? `<span class="text-sm text-muted-foreground tabular-nums whitespace-nowrap">1년 가격 흐름 <span class="font-semibold text-rose-600 dark:text-rose-400">+90.6%</span></span>`
        : `<span class="text-sm text-muted-foreground whitespace-nowrap">1년·5년 가격 흐름과 내 평단</span>`;
      const leftHtml = `<span class="min-w-0 flex-1 flex flex-col gap-0.5"><span class="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">${left.innerHTML}</span>${sub}</span>`;
      const right = variant === "A" ? `<span class="text-foreground">${SPARK(sw, 32, true)}</span>` : `<span class="text-sm font-semibold text-indigo-600 dark:text-indigo-300 whitespace-nowrap">가격 흐름</span>`;
      btn.innerHTML = `${leftHtml}${right}<span class="text-muted-foreground">${CHEV()}</span>`;
      btn.style.gap = "12px";
      strip.replaceWith(btn);
      const r = btn.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top - 230);
      return true;
    }, { variant, CHEV: CHEV.toString(), SPARK: SPARK.toString() });
    await p.waitForTimeout(400);
    if (ok) await S(`stock-card-${variant}`);
  };
  await applyR("A");
  await applyR("C");

  // ── R-B: 펼침 안 미니 차트 타일 ──
  await reload("#detail/stocks");
  await p.evaluate(({ CHEV: c, SPARK: s }) => {
    const CHEV = eval(c), SPARK = eval(s);
    const old = document.querySelector('[data-testid="stock-page-entry"]');
    if (!old) return;
    const strip = old.closest("div.flex.items-start");
    old.remove();
    const w = Math.min(window.innerWidth, 1280);
    const tw = Math.max(120, (w >= 640 ? 360 : w - 24 - 32 - 24));
    const wrap = document.createElement("div");
    wrap.className = "px-3 dark:px-4";
    wrap.style.padding = "4px 12px 12px";
    wrap.innerHTML = `<button type="button" class="flex w-full sm:w-auto items-center gap-3 rounded-lg bg-muted/50 dark:bg-popover px-3 py-2.5 text-left">
        <span class="flex flex-col gap-1 min-w-0">
          <span class="flex items-baseline gap-2"><span class="text-sm font-semibold text-foreground whitespace-nowrap">1년 가격 흐름</span><span class="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">+90.6%</span></span>
          <span class="text-foreground">${SPARK(Math.min(tw - 60, 300), 40, true)}</span>
          <span class="text-[11px] text-muted-foreground">점선 = 내 평단</span>
        </span>
        <span class="ml-auto text-muted-foreground">${CHEV()}</span></button>`;
    strip.after(wrap);
    const r = wrap.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - 260);
  }, { CHEV: CHEV.toString(), SPARK: SPARK.toString() });
  await p.waitForTimeout(400);
  await S("stock-card-B");

  // ── 성과 허브: H-A 카드 안 행 목록(숫자 + ›) / H-B 3칸 통계 타일 ──
  await go("#activity/change", 3000);
  const months = await p.evaluate(() => document.querySelectorAll('[data-testid^="monthly-log-row-"]').length);
  await p.click('[data-testid="change-period-week"]'); await p.waitForTimeout(1500);
  const week = await p.evaluate(() => document.querySelector('[data-testid="week-title"]')?.closest("div")?.parentElement?.querySelector("p.font-bold, p[class*='font-bold']")?.textContent?.trim() ?? "");
  const hub = async (variant) => {
    await go("#home", 1500);
    await go("#activity", 3000);
    await p.evaluate(({ variant, months, week, idxHtml, CHEV: c }) => {
      const CHEV = eval(c);
      const holder = document.querySelector('[data-testid="hub-card-change"]');
      const card = holder.firstElementChild;
      const weekTxt = week || "−8,836,800원";
      const neg = /[−-]/.test(weekTxt);
      const tone = neg ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400";
      const firstIdx = idxHtml.split('<span aria-hidden')[0];
      if (variant === "A") {
        const list = document.createElement("div");
        list.className = "divide-y divide-border dark:divide-border/40 border-t border-border dark:border-border/40";
        list.style.margin = "12px -4px -8px 32px";
        const row = (label, val) => `<button type="button" class="flex w-full min-h-11 items-center gap-2 py-2 text-left"><span class="text-sm font-medium text-foreground whitespace-nowrap">${label}</span><span class="ml-auto text-sm text-muted-foreground tabular-nums whitespace-nowrap text-right">${val}</span><span class="text-muted-foreground">${CHEV("size-4")}</span></button>`;
        list.innerHTML = row("최근 7일", `<span class="font-semibold ${tone}">${weekTxt}</span>`) + row("월별 기록", `${months || 2}개월`) + row("시장과 비교", `1주 ${firstIdx}`);
        card.appendChild(list);
      } else {
        const g = document.createElement("div");
        g.className = "grid grid-cols-3 gap-2";
        g.style.marginTop = "12px";
        const t = (label, val) => `<button type="button" class="min-w-0 flex flex-col items-start gap-1 rounded-lg bg-muted/50 dark:bg-muted/40 px-2.5 py-2 text-left"><span class="flex w-full items-center justify-between text-[11px] font-medium text-muted-foreground">${label}${CHEV("size-3.5")}</span><span class="text-sm font-semibold tabular-nums text-foreground truncate w-full">${val}</span></button>`;
        const short = weekTxt.replace(/,\d{3}원$/, "").replace(/(\d+),(\d{3})/, (m, a, b2) => `${a}${b2.slice(0, 0)}`);
        g.innerHTML = t("최근 7일", `<span class="${tone}">${neg ? "−" : "+"}883만</span>`) + t("월별 기록", `${months || 2}개월`) + t("시장 1주", firstIdx.replace(/<[^>]+>/g, "").replace("코스피 ", "코스피 "));
        card.appendChild(g);
      }
    }, { variant, months, week, idxHtml, CHEV: CHEV.toString() });
    await p.waitForTimeout(300);
    await S(`hub-${variant}`);
  };
  await hub("A");
  await hub("B");
  await ctx.close();
  console.log("done", tag, "idx", idx, "months", months, "week", week);
}
await b.close();
