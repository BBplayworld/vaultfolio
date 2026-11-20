import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://www.secretasset.xyz";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await c.newPage(); let gtm = []; p.on("response", (r) => { if (/googletagmanager/.test(r.url())) gtm.push(r.status() + " " + (r.headers()["content-type"] || "")); });
await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1500);
await p.goto(U + "/?trial=1"); await p.waitForTimeout(6000);
console.log(new Date().toISOString(), JSON.stringify(await p.evaluate(() => ({ dis: Object.entries(window).filter(([k]) => k.startsWith("ga-disable-")).map(([k, v]) => v), gtag: typeof window.gtag, dl: (window.dataLayer || []).length }))), "gtm 응답", JSON.stringify(gtm.slice(0, 2)));
await b.close();
