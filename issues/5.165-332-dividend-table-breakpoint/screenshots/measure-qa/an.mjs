import fs from "fs"; import crypto from "crypto";
const S = process.argv[2], v = process.argv[3];
const br = JSON.parse(fs.readFileSync(`${S}/out/scr-br-${v}.json`)), mn = JSON.parse(fs.readFileSync(`${S}/out/scr-main-${v}.json`));
const sha = (t, n, w) => { try { return crypto.createHash("sha1").update(fs.readFileSync(`${S}/shots17/${t}-${v}-${n}-${w}.png`)).digest("hex").slice(0, 8); } catch { return "none"; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const screens = Object.keys(br[359]).filter((k) => br[359][k] && br[359][k].items);
console.log("screen | n | br358=br359 | main359=main360(구 동작) | br360=main360 sig | 픽셀 br=main 320/358/360/375/1280 | br359≠main359 픽셀 | hScroll br(320..1280) | 359에서 바뀐 요소");
for (const n of screens) {
  const g = (d, w) => d[w]?.[n]?.items ?? null;
  const px = [320, 358, 360, 375, 1280].map((w) => (sha("br", n, w) === sha("main", n, w) && sha("br", n, w) !== "none" ? "=" : "≠")).join("");
  const changed = (g(br, 359) || []).filter((x, i) => x !== (g(mn, 359) || [])[i]).map((x) => x.split(" => ")[0]);
  console.log([n, br[359][n].n, eq(g(br, 358), g(br, 359)), eq(g(mn, 359), g(mn, 360)), eq(g(br, 360), g(mn, 360)), px, sha("br", n, 359) !== sha("main", n, 359), [320, 358, 359, 360, 375, 1280].map((w) => br[w][n].hScroll).join(""), [...new Set(changed)].join(" ; ").slice(0, 260)].join(" | "));
}
for (const w of [320, 358, 359, 360, 375, 1280]) console.log(w, "nav", br[w].cashNav, br[w].cryptoNav, br[w].loanNav, "errs br/main", br[w].errs, mn[w].errs, "trial", br[w].trial, "picker", JSON.stringify(br[w].picker?.grid ?? null), "main", JSON.stringify(mn[w].picker?.grid ?? null), br[w].picker?.ok, "posts", br[w].picker?.posts?.length);
console.log("\n주식 행 우측 열 / 증권사 행");
for (const w of [320, 358, 359, 360, 375, 1280]) for (const [t, d] of [["br", br], ["main", mn]]) { const s = d[w].stocks; console.log(w, t, "right", [...new Set(s.rights.map((r) => r.mw + ":" + r.ratio + "%"))].join(","), "| brokers", s.brokers.map((b) => `wrap${+b.wrapped} gap${b.rightGap} over${b.overRow} scr${b.rowScroll} h${b.rowH} btn${b.btn}`).join(" / "), "| icons", s.icons); }
console.log("\n가이드 읽기 줄 높이");
for (const nm of ["guide", "guidek"]) for (const w of [320, 358, 359, 360, 375, 1280]) for (const [t, d] of [["br", br], ["main", mn]]) { const gd = d[w][nm]; if (!gd) continue; const u = (k) => [...new Set(gd.hs.map((h) => h[k] ? h[k][0] + "/" + h[k][1] + "/ov" + h[k][3] : "-"))].join(","); console.log(nm, w, t, "readout", u("invest-readout"), "grid", u("invest-readout-grid"), "recovery", [...new Set(gd.hs.map((h) => h["invest-drop-recovery"]?.[2]))].join(","), "three a1", gd.three ? [...new Set(gd.three.hs.map((h) => h["a1-selected"] ? h["a1-selected"][0] + "/" + h["a1-selected"][1] : "-"))].join(",") : "-", "errs", gd.errs, "hs", gd.hScroll, gd.three?.hScroll); }
