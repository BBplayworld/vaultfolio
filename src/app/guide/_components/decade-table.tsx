// 가이드 `index-returns-by-year` 고유 표: 연대 × 지수의 `오른 해/등락을 알 수 있는 해`. 연간 등락의 개수만 센 파생값이라 지수 수준값은 SSR에 나가지 않는다.
import { buildIndexView, INDEX_KEYS, INDEX_META } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { hikeYearRows, kospiDropYears, monthlyBuyingRows, MONTHLY_INDEXES, recessionYearRows, recoveryRows, spreadYearRows, type GuideRow, type SpreadCount } from "@/lib/invest/guide-tables";
import { monthsLabel } from "@/lib/invest/pattern";
import { CALC_DIV, CALC_FOOT, CALC_PAST, fmtPct } from "@/lib/invest/text";
import { EventName } from "@/app/(main)/_components/views/invest/nowrap";

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

/** 5.141 G1: 크게 빠진 때 13번 — 지수 그룹 행 3개 + 4열(320 가로 스크롤 0). 열 `고점에서 전고점까지`는 아직이면 `아직이에요` */
export function RecoveryTable() {
  const rows = recoveryRows(marketHistory);
  return (
    <div>
      <table data-testid="guide-unique-table" className="w-full table-fixed border-separate border-spacing-0 text-xs tabular-nums">
        <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">연말 기준 15% 넘게 빠진 때마다, 고점에서 바닥까지와 고점에서 전고점까지 걸린 햇수예요</caption>
        <colgroup><col className="w-[38%]" /><col className="w-[16%]" /><col className="w-[20%]" /><col className="w-[26%]" /></colgroup>
        <thead>
          <tr>
            {["하락", "낙폭", "고점에서 바닥까지", "고점에서 전고점까지"].map((h, i) => <th key={h} scope="col" className={`h-auto min-h-10 py-1 align-bottom font-semibold text-muted-foreground break-keep ${i ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr>
        </thead>
        {INDEX_KEYS.map((k) => (
          <tbody key={k}>
            <tr><th scope="rowgroup" colSpan={4} className="h-9 border-t border-border pt-2 text-left text-xs font-semibold">{INDEX_META[k].label}</th></tr>
            {rows.filter((r) => r.index === k).map((r) => (
              <tr key={`${k}-${r.py}`}>
                <th scope="row" className="min-h-10 py-1 text-left font-medium break-keep"><span className="block text-foreground">{r.name}</span><span className="block font-normal text-muted-foreground">{r.py}~{r.ty}년</span></th>
                <td className="text-right">{fmtPct(r.dd)}</td>
                <td className="text-right">{r.toBottom}년</td>
                <td className="text-right">{r.toPrev == null ? "아직이에요" : `${r.toPrev}년`}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** 5.141 G3: 코스피 연간 등락 −15% 이하 해 — 같은 해 이슈(최대 2건 + `외 n건`). 같은 시기 기록일 뿐 원인을 말하지 않는다 */
export function KospiYearTable() {
  const { rows } = kospiDropYears(marketHistory);
  return (
    <div>
      <table data-testid="guide-unique-table" className="w-full table-fixed border-separate border-spacing-0 text-xs tabular-nums">
        <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">코스피 연간 등락이 −15% 이하였던 해와 같은 해 경제 이슈예요</caption>
        <colgroup><col className="w-12" /><col className="w-16" /><col /></colgroup>
        <thead>
          <tr>
            {["해", "연간 등락", "같은 해 이슈"].map((h, i) => <th key={h} scope="col" className={`h-10 font-semibold text-muted-foreground break-keep ${i === 1 ? "text-right" : "text-left"} ${i === 2 ? "pl-3" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.y}>
              <th scope="row" className="min-h-10 border-t border-border py-1.5 text-left align-top font-semibold">{r.y}</th>
              <td className="border-t border-border py-1.5 text-right align-top">{fmtPct(r.ret)}</td>
              <td className="border-t border-border py-1.5 pl-3 text-left align-top text-pretty break-keep">
                {r.issues.length ? <>{r.issues.slice(0, 2).map((n) => <span key={n} className="block"><EventName name={n} /></span>)}{r.issues.length > 2 && <span className="block text-muted-foreground">외 {r.issues.length - 2}건</span>}</> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 5.142 G2: 시작 해 5개 × 두 지수. 두 값 열은 같은 굵기·같은 색(우열 강조 0), 값은 배수만(지수 수준값 0) */
export function MonthlyBuyingTable() {
  const { rows } = monthlyBuyingRows(marketHistory);
  return (
    <table data-testid="guide-unique-table" className="w-full table-fixed border-separate border-spacing-0 text-xs tabular-nums">
      <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">같은 총액을 시작 해 말에 한 번에 넣은 경우와 매달 나눠 넣은 경우의 넣은 돈 대비 배수예요</caption>
      <colgroup><col className="w-[26%]" /><col className="w-[14%]" /><col className="w-[30%]" /><col className="w-[30%]" /></colgroup>
      <thead>
        <tr>
          {["시작(연도 말)", "기간", "한 번에 넣기", "매달 나눠 넣기"].map((h, i) => <th key={h} scope="col" className={`h-auto min-h-10 py-1 align-bottom font-semibold text-muted-foreground break-keep ${i ? "text-right" : "text-left"}`}>{h}</th>)}
        </tr>
      </thead>
      {MONTHLY_INDEXES.map((k) => (
        <tbody key={k}>
          <tr><th scope="rowgroup" colSpan={4} className="h-9 border-t border-border pt-2 text-left text-xs font-semibold">{INDEX_META[k].label}</th></tr>
          {rows.filter((r) => r.index === k).map((r) => (
            <tr key={`${k}-${r.start}`}>
              <th scope="row" className="h-10 text-left font-medium text-foreground">{r.start}년</th>
              <td className="text-right font-medium text-foreground">{r.years}년</td>
              <td className="text-right font-medium text-foreground">{r.lump}배</td>
              <td className="text-right font-medium text-foreground">{r.dca}배</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

/** 5.142 G2 각주 1~4(정본, spec 5절). 4번은 G1·G3 표 고지와 같은 문장 */
export function MonthlyBuyingFootnotes() {
  const { last, holds } = monthlyBuyingRows(marketHistory);
  const P = "mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty break-keep";
  return (
    <div data-testid="guide-footnotes" className="-mt-2">
      <p className={P}>{`넣은 돈 대비 배수는 ${last}년 말 평가액을 넣은 총액으로 나눈 값이에요.`}</p>
      <p className={P}>{`매달 나눠 넣기는 늦게 넣은 돈일수록 짧게 들어가 있어요. 기간 5·10·15·20·25년에 넣은 돈이 들어가 있던 기간은 평균 ${holds.join("·")}년이에요.`}</p>
      <p className={P}>{`${CALC_PAST} ${CALC_FOOT} ${CALC_DIV}`}</p>
      <p className={P}>{GUIDE_TABLE_DISCLAIMER}</p>
    </div>
  );
}

/** 5.143 G4 요약 표 + 해별 표. 두 행은 같은 굵기·같은 색(우열 강조 0), 비율 %는 없고 `n해 중 k해`만. 해별 표의 등락은 격자와 같은 fmtPct·손익 색 */
const up = (r: number | null) => (r == null ? "" : r > 0 ? "text-red-600 dark:text-red-400" : r < 0 ? "text-blue-600 dark:text-blue-400" : "");
const cnt = (n: number, k: number) => <span className="whitespace-nowrap">{n}해 중 {k}해</span>;
export function SpreadYearsTables() {
  const { has, none, years } = spreadYearRows(marketHistory);
  const rows: { id: string; label: string; c: SpreadCount }[] = [{ id: "has", label: "금리차 마이너스인 달이 있던 해", c: has }, { id: "none", label: "없던 해", c: none }];
  return (
    <div className="space-y-5">
      <table data-testid="g4-summary-table" className="w-full table-fixed border-separate border-spacing-0 text-xs tabular-nums">
        <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">S&P 500 연말 지수가 전해 말보다 오른 해 수 / 해당하는 해 수예요</caption>
        <colgroup><col className="w-[36%]" /><col className="w-[32%]" /><col className="w-[32%]" /></colgroup>
        <thead>
          <tr>{["구분", "그해 오른 해", "다음 해 오른 해"].map((h, i) => <th key={h} scope="col" className={`h-auto min-h-10 py-1 align-bottom font-semibold text-muted-foreground break-keep ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid={`g4-row-${r.id}`}>
              <th scope="row" className="h-auto min-h-10 border-t border-border/60 py-1 text-left font-medium text-foreground break-keep"><RowLabel text={r.label} /></th>
              <td className="border-t border-border/60 text-right font-medium text-foreground">{cnt(r.c.n, r.c.up)}</td>
              <td className="border-t border-border/60 text-right font-medium text-foreground">{cnt(r.c.nNext, r.c.upNext)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table data-testid="g4-year-table" className="w-full table-fixed border-separate border-spacing-0 text-xs tabular-nums">
        <caption className="mb-1.5 text-left text-xs text-muted-foreground text-pretty break-keep">금리차가 마이너스인 달이 있던 해마다, 그달과 그해·다음 해 S&P 500 연말 등락이에요</caption>
        <colgroup><col className="w-[16%]" /><col className="w-[28%]" /><col className="w-[28%]" /><col className="w-[28%]" /></colgroup>
        <thead>
          <tr>{["해", "마이너스인 달", "그해", "다음 해"].map((h, i) => <th key={h} scope="col" className={`h-10 font-semibold text-muted-foreground break-keep ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {years.map((r) => (
            <tr key={r.y}>
              <th scope="row" className="h-10 border-t border-border/60 text-left font-semibold">{r.y}</th>
              <td className="border-t border-border/60 text-left whitespace-nowrap">{monthsLabel(r.months)}</td>
              <td className={`border-t border-border/60 text-right ${up(r.ret)}`}>{r.ret == null ? "—" : fmtPct(r.ret)}</td>
              <td className={`border-t border-border/60 text-right ${up(r.next)}`}>{r.next == null ? "—" : fmtPct(r.next)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 5.143 G4 각주 1(정본: 이어진 해 중복 안내). 인과 서술 0 */
export const SPREAD_FOOTNOTE_1 = "금리차가 마이너스인 해가 이어지면, 앞 해의 다음 해 값과 뒤 해의 그해 값이 같아요. 해마다 따로 센 값이 아니에요.";
export function SpreadYearsFootnotes() {
  const P = "mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty break-keep";
  return (
    <div data-testid="guide-footnotes" className="-mt-2">
      <p className={P}>{SPREAD_FOOTNOTE_1}</p>
      <p className={P}>{CALC_PAST}</p>
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
