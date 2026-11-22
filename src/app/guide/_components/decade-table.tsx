// 가이드 `index-returns-by-year` 고유 표: 연대 × 지수의 `오른 해/등락을 알 수 있는 해`. 연간 등락의 개수만 센 파생값이라 지수 수준값은 SSR에 나가지 않는다.
import { buildIndexView, INDEX_KEYS, INDEX_META } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";

/** 연대별 `오른 해/전체 해`(전해보다 연말 지수가 오른 해 / 그 연대에서 연간 등락이 있는 해). 해가 없으면 null */
export function decadeCounts(): { decade: number; cells: ({ up: number; n: number } | null)[] }[] {
  const views = INDEX_KEYS.map((k) => buildIndexView(marketHistory, k));
  const first = Math.min(...views.map((v) => v.start + 1)), last = Math.max(...views.map((v) => v.last));
  const rows = [];
  for (let d = Math.floor(first / 10) * 10; d <= Math.floor(last / 10) * 10; d += 10) {
    const cells = views.map((v) => {
      let up = 0, n = 0;
      for (let y = Math.max(d, v.start + 1); y <= Math.min(d + 9, v.last); y++) { const r = v.ret[y - v.start]; if (r == null) continue; n++; if (r > 0) up++; }
      return n ? { up, n } : null;
    });
    rows.push({ decade: d, cells });
  }
  return rows;
}

export function DecadeTable() {
  const rows = decadeCounts();
  return (
    <div>
      <table data-testid="guide-unique-table" className="w-full border-separate border-spacing-0 text-xs tabular-nums">
        <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">연대별로 전해보다 연말 지수가 오른 해 수 / 연간 등락을 알 수 있는 해 수예요</caption>
        <thead>
          <tr>
            <th scope="col" className="h-10 text-left font-semibold text-muted-foreground">연대</th>
            {INDEX_KEYS.map((k) => <th key={k} scope="col" className="h-10 text-right font-semibold text-muted-foreground break-keep">{INDEX_META[k].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.decade}>
              <th scope="row" className="h-10 border-t border-border text-left font-semibold">{String(r.decade).slice(2)}년대</th>
              {r.cells.map((c, i) => <td key={i} className="h-10 border-t border-border text-right">{c ? `${c.up}/${c.n}` : "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-xs text-muted-foreground text-pretty break-keep">60년대는 1961년, 2020년대는 2025년까지예요. 지수마다 자료가 시작한 해가 달라 빈 칸이 있어요.</p>
    </div>
  );
}
