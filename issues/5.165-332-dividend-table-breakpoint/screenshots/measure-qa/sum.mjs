import fs from "fs";
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f)); console.log("==", f.split("/").pop());
  for (const [w, v] of Object.entries(d)) {
    const rows = v.tables.flatMap((t) => t.rows);
    const min = (a) => Math.min(...a), max = (a) => Math.max(...a);
    console.log(w, "hs", v.hScroll, "err", v.errs, "cols", v.tables.map((t) => t.cols.split(" ").length + ":" + t.cols).join(" / "), "headH", v.tables.map((t) => t.headH).join(","), "headGap", v.tables.map((t) => t.headMinGap).join(","));
    console.log("   colW", JSON.stringify(rows[0].colW), "perToPaid", rows.map((r) => r.gap.perToPaid).join(","), "paidToTotal", rows.map((r) => r.gap.paidToTotal).join(","), "totalVsInner", rows.map((r) => r.totalVsInner).join(","));
    console.log("   lines per", rows.map((r) => r.lines.per.join("/")).join(" "), "paid", rows.map((r) => r.lines.paid.join("/")).join(" "), "total", rows.map((r) => r.lines.total.join("/")).join(" "), "nameClip", rows.map((r) => +r.nameClipped).join(""), "nameLines", rows.map((r) => r.nameLines).join(""), "chipRows", rows.map((r) => r.chips.rows).join("/"), "chipOver", max(rows.map((r) => r.chips.rightOver)), "rowH", rows.map((r) => r.rowH).join("/"), "rowOv", max(rows.map((r) => r.rowOverflow)), "krwY", rows.map((r) => r.krwY[0] - r.krwY[1]).join(","), "textW", JSON.stringify(rows.map(r=>r.textW.per+"/"+r.textW.paid+"/"+r.textW.total)));
  }
}
