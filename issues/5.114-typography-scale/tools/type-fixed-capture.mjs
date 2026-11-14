import { execSync } from "node:child_process"; import { createRequire } from "node:module"; import path from "node:path"; import fs from "node:fs"; import crypto from "node:crypto";
const g = execSync("npm root -g",{encoding:"utf8"}).trim();
const { chromium } = createRequire(path.join(g,"noop.js"))("playwright");
const [,, CSS, LIB] = process.argv;
const css = fs.readFileSync(CSS,"utf8"), lib = fs.readFileSync(LIB,"utf8");
const card = (id, cls) => `<div class="${cls}" style="position:fixed;left:-9999px;top:0;width:680px"><div id="${id}" style="background:#fff;color:#000;padding:16px">
<p class="text-2xs">메타 11</p><p class="text-xs">칩 12</p><p class="text-sm">본문 14 삼성전자 4,550,000원</p><p class="text-base">섹션 16</p><p class="text-lg">제목</p><p class="text-xl font-bold">20</p><p class="text-2xl font-bold">551,303,200원</p><p class="text-sm leading-relaxed">여러 줄 설명 문장</p></div></div>`;
const html = `<!doctype html><html><head><meta charset="utf8"><style>${css}</style></head><body>${card("fixed","type-fixed")}${card("free","")}<p id="live" class="text-sm">본문</p><div class="type-fixed"><p id="livefx" class="text-sm">본문</p></div></body></html>`;
const b = await chromium.launch(); const out = {};
for (const w of [390, 767, 768, 1279, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.setContent(html); await p.addScriptTag({ content: lib });
  out[w] = await p.evaluate(async () => {
    const fs = (id) => getComputedStyle(document.getElementById(id));
    const r = { live: fs("live").fontSize + "/" + fs("live").lineHeight, livefx: fs("livefx").fontSize + "/" + fs("livefx").lineHeight,
      enumCustom: Array.from(getComputedStyle(document.documentElement)).filter(n => n.startsWith("--text")).length };
    for (const id of ["fixed", "free"]) { const el = document.getElementById(id); r[id + "H"] = el.offsetHeight; r[id] = await htmlToImage.toPng(el, { pixelRatio: 2 }); }
    return r;
  });
  for (const id of ["fixed","free"]) out[w][id] = crypto.createHash("md5").update(out[w][id]).digest("hex").slice(0,10);
  await p.close();
}
await b.close(); console.log(JSON.stringify(out, null, 1));
