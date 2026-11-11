// 진입점 개선안 목업 — 운영 ?trial=1 실제 화면 DOM에 제안 요소를 주입해 캡처(코드 수정 아님)
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/noop.js")("playwright");
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const BASE = "https://www.secretasset.xyz";
const OUT = process.env.OUT || "m";
const widths = (process.env.W || "375").split(",").map(Number);
const themes = (process.env.T || "light,dark").split(",");
const b = await chromium.launch({ proxy });

const ICON = {
  chart: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  chev: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
};
// 기존 새 소식 시트 '새' chip 클래스 그대로(whats-new-item-new)
const NEW_CHIP = '<span data-mock="new" class="inline-flex rounded bg-orange-500/10 px-1.5 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-400 align-middle leading-none" style="margin-left:6px">새</span>';

for (const theme of themes) for (const w of widths) {
  const mobile = w < 640;
  const ctx = await b.newContext({ viewport: { width: w, height: mobile ? 812 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const p = await ctx.newPage();
  const tag = `${w}-${theme}`;
  await p.goto(`${BASE}/?trial=1`, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  const go = async (hash, ms = 2500) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };
  const S = (n, full = false) => p.screenshot({ path: `${OUT}/${n}-${tag}.png`, fullPage: full });

  // M5 홈 Hero 원인 펼침 + `최근 7일 원인 보기 ›`
  await p.evaluate(({ ICON, NEW_CHIP }) => {
    const btn = document.querySelector('button[aria-label="변동 원인 보기"]');
    btn?.click();
  }, { ICON, NEW_CHIP });
  await p.waitForTimeout(600);
  await p.evaluate(({ ICON }) => {
    const ul = document.querySelector('button[aria-label="변동 원인 보기"]')?.closest("div.mt-1")?.querySelector("ul");
    const host = ul?.parentElement;
    if (!host) return;
    const a = document.createElement("button");
    a.type = "button";
    a.className = "inline-flex min-h-10 items-center gap-0.5 text-sm font-semibold text-indigo-600 dark:text-indigo-300";
    a.style.marginTop = "-4px";
    a.innerHTML = `최근 7일 원인 보기${ICON.chev.replace('width="16" height="16"', 'width="14" height="14"')}`;
    host.appendChild(a);
  }, { ICON });
  await S("m5-home-cause");

  // M1·M2 상세·주식
  await go("#detail/stocks", 3500);
  await p.evaluate(({ ICON, NEW_CHIP }) => {
    // M2 내 종목과 비교 → 링크 줄만 brand(indigo) + semibold
    const e1 = document.querySelector('[data-testid="stock-market-entry"]');
    if (e1) {
      const spans = e1.querySelectorAll(":scope > span");
      const link = spans[spans.length - 1];
      link.className = "inline-flex items-center gap-0.5 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-300";
      link.querySelector("svg")?.setAttribute("class", "size-4");
    }
    // M1 종목 보기 작은 링크 → 이름 줄 아래 전체 폭 버튼(+새)
    const old = document.querySelector('[data-testid="stock-page-entry"]');
    if (old) {
      const row = old.closest("div.flex.items-start");
      old.remove();
      const btnWrap = document.createElement("div");
      btnWrap.className = "px-3 dark:px-4";
      btnWrap.style.paddingBottom = "10px";
      btnWrap.style.marginTop = "-2px";
      btnWrap.innerHTML = `<button type="button" class="flex w-full min-h-10 items-center gap-2 rounded-lg bg-brand/10 dark:bg-brand/15 px-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300 sm:w-auto sm:pr-2.5">${ICON.chart}<span class="break-keep">가격 흐름·평단 보기</span>${NEW_CHIP}<span style="margin-left:auto;display:inline-flex">${ICON.chev}</span></button>`;
      row.after(btnWrap);
    }
  }, { ICON, NEW_CHIP });
  await p.waitForTimeout(300);
  await S("m2-stocks-top");
  await p.evaluate(() => { const r = document.querySelector('[data-mock="new"]')?.getBoundingClientRect(); if (r) window.scrollTo(0, window.scrollY + r.top - 260); });
  await p.waitForTimeout(400);
  await S("m1-stock-card");

  // M3 성과 허브 — 자산 변화 카드 바로 가기 칩 3개(첫 미방문 1개만 새)
  await go("#activity");
  await p.evaluate(({ NEW_CHIP }) => {
    const card = document.querySelector('[data-testid="hub-card-change"] > div');
    if (!card) return;
    const row = document.createElement("div");
    row.className = "flex flex-wrap gap-2 border-t border-border dark:border-border/40";
    row.style.marginTop = "12px"; row.style.paddingTop = "12px";
    const chip = (label, isNew) => `<button type="button" class="inline-flex h-8 items-center rounded-full bg-brand/10 dark:bg-brand/15 px-3 text-sm font-medium text-indigo-600 dark:text-indigo-300 whitespace-nowrap">${label}${isNew ? NEW_CHIP : ""}</button>`;
    row.innerHTML = chip("최근 7일", true) + chip("월별 기록", false) + chip("시장과 비교", false);
    card.appendChild(row);
  }, { NEW_CHIP });
  await p.waitForTimeout(300);
  await S("m3-perf-hub");

  // M4a 자산 변화 기간 선택 '주' 칸 + 새
  await go("#activity/change");
  await p.evaluate(({ NEW_CHIP }) => {
    const wk = document.querySelector('[data-testid="change-period-week"]');
    if (wk) wk.insertAdjacentHTML("beforeend", NEW_CHIP);
  }, { NEW_CHIP });
  await S("m4a-period-week");
  // M4b 월별 기록 제목 + 새
  await p.evaluate(({ NEW_CHIP }) => {
    document.querySelectorAll('[data-mock="new"]').forEach((e) => e.remove());
    const t = document.querySelector('[data-testid="monthly-log-title"]');
    if (t) { t.insertAdjacentHTML("afterend", NEW_CHIP); t.scrollIntoView({ block: "center" }); }
  }, { NEW_CHIP });
  await p.waitForTimeout(500);
  await S("m4b-monthly-log");
  await ctx.close();
  console.log("done", tag);
}
await b.close();
