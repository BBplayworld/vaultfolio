// 가이드 `index-returns-by-year` 고유 표: 연대 × 지수의 `오른 해/등락을 알 수 있는 해`. 연간 등락의 개수만 센 파생값이라 지수 수준값은 SSR에 나가지 않는다.
import { buildIndexView, INDEX_KEYS, INDEX_META } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { hikeYearRows, recessionYearRows, type GuideRow } from "@/lib/invest/guide-tables";

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

/** 첫 열 라벨: 마지막 두 어절(`있던 해`)은 줄 끝에 한 글자만 남지 않게 묶는다(C25) */
function RowLabel({ text }: { text: string }) {
  const w = text.split(" ");
  if (w.length < 3) return <>{text}</>;
  return <>{w.slice(0, -2).join(" ")} <span className="whitespace-nowrap">{w.slice(-2).join(" ")}</span></>;
}

/** 가이드 고유 표 공용 틀(4열: 구분 | 지수 3). 셀은 `오른 해/전체 해` 개수만, 없으면 — */
export function GuideCountTable({ caption, head, rows }: { caption: string; head: string; rows: { label: string; cells: ({ up: number; n: number } | null)[] }[] }) {
  return (
    <table data-testid="guide-unique-table" className="w-full border-separate border-spacing-0 text-xs tabular-nums">
      <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="h-10 w-[5.5rem] text-left font-semibold text-muted-foreground break-keep">{head}</th>
          {INDEX_KEYS.map((k) => <th key={k} scope="col" className="h-10 text-right font-semibold text-muted-foreground break-keep">{INDEX_META[k].label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="h-auto min-h-10 w-[5.5rem] border-t border-border py-1 text-left font-semibold break-keep"><RowLabel text={r.label} /></th>
            {r.cells.map((c, i) => <td key={i} className="h-10 border-t border-border text-right">{c ? `${c.up}/${c.n}` : "—"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ymText = (m: string) => `${+m.slice(0, 4)}년 ${+m.slice(5)}월`;
const NOTE = "mt-1.5 text-xs text-muted-foreground text-pretty break-keep";

/** 2편 고유 표: 인상 국면이 걸친 해 / 그 밖의 해 */
export function HikeTable() {
  const { rows, phases, span } = hikeYearRows(marketHistory);
  const list = phases.map((p) => (p.from === p.to ? ymText(p.from) : `${ymText(p.from)}~${p.from.slice(0, 4) === p.to.slice(0, 4) ? `${+p.to.slice(5)}월` : ymText(p.to)}`)).join(" · ");
  return (
    <div>
      <GuideCountTable head="구분" caption={`${span[0]}~${span[1]}년, 연말 지수가 전해 말보다 오른 해 수 / 해당하는 해 수예요`} rows={rows} />
      <p data-testid="guide-table-note" className={NOTE}>{`인상 국면: ${list}(미 연준 공개시장 표). 코스피 열도 미국 연준 기준이에요.`}</p>
    </div>
  );
}

/** 3편 고유 표: 침체 달이 있던 해 / 없던 해, 침체 중 오른 해는 숨기지 않고 연도로 적는다 */
export function RecessionTable() {
  const { rows, spxUpInRecession } = recessionYearRows(marketHistory);
  return (
    <div>
      <GuideCountTable head="구분" caption="미국 경기침체 기준, 연말 지수가 전해 말보다 오른 해 수 / 해당하는 해 수예요(지수마다 자료가 시작한 해가 달라요)" rows={rows} />
      <p data-testid="guide-table-note" className={NOTE}>{`침체 달이 있던 해 중 S&P 500이 오른 해: ${spxUpInRecession.join("·")}년. 1970년은 +0.1%로 거의 그대로였어요.`}</p>
      <p className={NOTE}>코스피 열도 미국 경기침체(NBER) 기준이에요.</p>
    </div>
  );
}

export const GUIDE_TABLE_DISCLAIMER = "연간 등락은 투자 탭과 같은 자료(위키백과 CC BY-SA 4.0·Damodaran)로 시크릿에셋이 계산했고, 가공한 표는 같은 조건(CC BY-SA 4.0)으로 공개해요. S&P 500은 S&P Dow Jones Indices, Nasdaq-100은 Nasdaq, Inc., KOSPI는 한국거래소의 상표이며, 시크릿에셋은 이 기관들과 제휴 관계가 아니에요. 과거 시장 사실이며 투자 권유가 아니에요.";

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
