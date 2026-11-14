// 성적표 "가계 통계와 나란히" 블록(#201, 5.102) — 공개 가계 통계의 순자산 분위 경계 금액 목록에서 내 구간만 중립 색으로 강조.
// 계산은 buildNetworthBenchmark(순수). 누르는 것·화면 상태·저장·전송·계측 없음. 내 순자산 금액은 적지 않는다.
// 통계 상수가 비어 있거나 검증에 실패하면 null(원문 확보 전에는 화면에 나오지 않는다).

import { ChartNoAxesColumn, ChevronDown } from "lucide-react";
import { BenchmarkMore } from "./benchmark-more";
import { HOUSEHOLD_NETWORTH_STATS, type HouseholdNetworthStats } from "@/config/household-networth-stats";
import { buildNetworthBenchmark, type MyAssetBasis } from "@/lib/report/networth-benchmark";
import { SECTION, SectionHeader } from "../../layout/ui/report-section";

// asset-report-view.tsx의 로컬 상수 CAPTION·SCOPE_MAIN과 같은 값(성적표에서 가져오면 순환 import — 값만 맞춘다)
const CAPTION = "text-sm text-muted-foreground leading-relaxed";
const SCOPE_MAIN = "shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-foreground/10 text-foreground";
// 5축 카드와 같은 진입 모션
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300";
const NOWRAP = "whitespace-nowrap";

export const BENCHMARK_TITLE = "가계 통계와 나란히";
export const BENCHMARK_GRADE_NOTE = "등급 점수에는 반영되지 않아요.";
export const BENCHMARK_TOP_NOTE = "통계 표에서 가장 높은 구간이라 이 위로는 더 나뉘지 않아요.";
export const BENCHMARK_HIDDEN_NOTE = "부동산을 등록하지 않아 내 구간은 표시하지 않았어요. 통계의 순자산은 가구의 자산에서 부채를 뺀 값이에요.";

export const COMP_NOTES = [
  "비중은 자산 합계 대비예요. 자동차·귀금속 같은 기타 실물자산 줄은 뺐어요.",
  "전·월세보증금(세입자가 낸 돈)은 따로 등록하는 항목이 없어요. 현금으로 등록했다면 예금·주식 등에 들어가 있어요.",
] as const;
// 비중 열: 좁은 폭에선 머리가 어절에서 2줄로 꺾여 평균 열과 8px 이상 떨어지고, sm 이상에선 1줄 + 왼쪽 여백
const COMP_PCT_COL = "w-12 pl-2 sm:w-16";
// 열 머리 — 좁은 폭에서 어절 단위 2줄(nowrap 금지: 5.102 qa D1 '가구 평균가구 비중' 붙음), 열 사이 pl-2 간격
const HEAD_NUM = "text-right align-bottom leading-tight break-keep tabular-nums";
const NUM = "text-right whitespace-nowrap tabular-nums";

// 구성 핵심 줄 — 행 머리 + 항목 단위로만 줄바꿈
function BriefLine({ id, head, text }: { id: string; head: string; text: string[] }) {
  return (
    <p data-testid={`benchmark-comp-brief-${id}`} className="flex min-h-8 items-baseline gap-x-3">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{head}</span>
      <span className="flex flex-wrap gap-x-1.5 text-sm tabular-nums text-foreground">
        {text.map((t, i) => <span key={t} className={NOWRAP}>{i > 0 ? "· " : ""}{t}</span>)}
      </span>
    </p>
  );
}

export function NetworthBenchmarkBlock({ netAsset, realEstateCount, stats = HOUSEHOLD_NETWORTH_STATS, mine }: {
  netAsset: number; realEstateCount: number; stats?: HouseholdNetworthStats; mine?: MyAssetBasis;
}) {
  const v = buildNetworthBenchmark({ netAsset, realEstateCount, stats, mine });
  if (!v) return null;
  const c = v.counts;
  const comp = v.composition;
  const mineRow = v.mineIndex === null ? null : v.rows[v.mineIndex];
  const last = v.rows.length - 1;
  // 마커: 칸 중앙, 양 끝 칸은 가장자리에 붙임
  const markerPos = v.mineIndex === 0 ? "" : v.mineIndex === last ? "right-0 items-end" : "-translate-x-1/2";
  const markerStyle = v.mineIndex === null || v.mineIndex === 0 || v.mineIndex === last ? undefined : { left: `${((v.mineIndex + 0.5) / v.rows.length) * 100}%` };
  const meterLabel = c ? `가구 100곳 중 ${c.nText}이 이 구간${c.mText === null ? "이에요." : `, ${c.mText}이 이보다 높은 구간이에요.`}` : undefined;
  const brief = comp ? {
    household: comp.rows.slice(0, 3).map((r) => `${r.label} ${r.sharePct}%`),
    mine: comp.showMine ? comp.rows.slice(0, 3).filter((r) => typeof r.minePct === "number").map((r) => `${r.label} ${r.minePct}%`) : null,
  } : null;
  const briefHead = v.mineIndex === null ? "전체 가구" : "비슷한 가구";
  return (
    <section data-testid="benchmark-block" aria-label={BENCHMARK_TITLE} className={`${SECTION} ${ENTER}`}>
      <div>
        <SectionHeader icon={ChartNoAxesColumn} tone="brand" title={BENCHMARK_TITLE} titleTestId="benchmark-title" />
        <p data-testid="benchmark-grade-note" className={`${CAPTION} mt-1 text-pretty break-keep`}>{BENCHMARK_GRADE_NOTE}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-x-8">
        <div className="space-y-1">
          {c && (
            <p data-testid="benchmark-sentence" className="text-base font-semibold text-foreground text-pretty break-keep tabular-nums">
              가구 <span className={NOWRAP}>100곳 중</span> <span className={NOWRAP}>{c.nText}이</span>{" "}
              {c.mText === null ? "이 구간이에요." : <>이 구간, <span className={NOWRAP}>{c.mText}이</span> 이보다 높은 구간이에요.</>}
            </p>
          )}
          {c?.isTop && <p data-testid="benchmark-top-note" className={`${CAPTION} text-pretty break-keep`}>{BENCHMARK_TOP_NOTE}</p>}
          {v.hidden && <p data-testid="benchmark-hidden-note" className={`${CAPTION} text-pretty break-keep`}>{BENCHMARK_HIDDEN_NOTE}</p>}
          {mineRow && <p data-testid="benchmark-range" className="text-sm text-muted-foreground tabular-nums">내 구간 {mineRow.label}</p>}
          {mineRow && (
            <div className="pt-3">
              <div className="relative h-6" data-testid="benchmark-marker" aria-hidden>
                <span className={`absolute top-0 flex flex-col items-center ${markerPos}`} style={markerStyle}>
                  <span className={SCOPE_MAIN}>내 구간</span>
                  <ChevronDown aria-hidden className="size-3 text-foreground" />
                </span>
              </div>
              <div data-testid="benchmark-meter" role="img" aria-label={meterLabel} className="mt-1 flex gap-0.5">
                {v.rows.map((row, i) => (
                  <span key={i} aria-hidden data-testid={`benchmark-meter-cell-${i}`} data-mine={row.mine ? "true" : undefined} className={`h-3 flex-1 rounded-sm ${row.mine ? "bg-foreground" : "bg-foreground/20"}`} />
                ))}
              </div>
              <p aria-hidden className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                <span className={NOWRAP}>{v.rows[0].label}</span>
                <span className={NOWRAP}>{v.rows[v.rows.length - 1].label}</span>
              </p>
            </div>
          )}
        </div>
        {brief && (
          <div data-testid="benchmark-comp-brief" className="space-y-1 md:self-center">
            <BriefLine id="household" head={briefHead} text={brief.household} />
            {brief.mine && <BriefLine id="mine" head="나" text={brief.mine} />}
          </div>
        )}
      </div>

      <BenchmarkMore>
        <div className="space-y-4 pt-3 md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0">
          <div>
            <p aria-hidden data-testid="benchmark-column" className="mb-1 text-xs text-muted-foreground">{v.columnLabel}</p>
            <ul data-testid="benchmark-bars" aria-label={v.columnLabel}>
              {v.rows.map((row, i) => (
                <li
                  key={i}
                  data-testid={`benchmark-row-${i}`}
                  data-mine={row.mine ? "true" : undefined}
                  aria-current={row.mine ? "true" : undefined}
                  className={`-mx-2 px-2 flex flex-wrap items-center gap-x-2 rounded-md ${row.mine ? "py-1.5 bg-muted/40" : "py-1"}`}
                >
                  <span className={`text-sm tabular-nums ${row.mine ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {row.label.split("~").map((part, j) => <span key={j} className={NOWRAP}>{j > 0 ? `~${part}` : part}</span>)}
                  </span>
                  {row.mine && <span data-testid="benchmark-mine-chip" className={SCOPE_MAIN}>내 구간</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            {comp && (
              <div data-testid="benchmark-comp" className="mt-3 pt-3 border-t border-border/50">
                <p data-testid="benchmark-comp-title" className="text-sm font-semibold text-foreground text-pretty break-keep">{comp.title}</p>
                <p data-testid="benchmark-comp-basis" className="mt-0.5 text-xs text-muted-foreground tabular-nums text-pretty break-keep">{comp.basis}</p>
                <table data-testid="benchmark-comp-table" className="mt-2 w-full text-sm tabular-nums">
                  <caption className="sr-only">{comp.title}</caption>
                  <thead>
                    <tr className="border-b border-border/50 text-xs text-muted-foreground">
                      <th scope="col" className="sr-only">항목</th>
                      <th scope="col" className={`w-[5.25rem] font-normal ${HEAD_NUM}`}>가구 평균</th>
                      <th scope="col" className={`${COMP_PCT_COL} font-normal ${HEAD_NUM}`}>가구 비중</th>
                      {comp.showMine && <th scope="col" className={`${COMP_PCT_COL} font-normal ${HEAD_NUM}`}>내 비중</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {comp.rows.map((r, i) => (
                      <tr key={r.label} data-testid={`benchmark-comp-row-${i}`} className={`h-9 ${i === 3 ? "border-t border-border/50" : ""}`}>
                        <th scope="row" className="text-left font-normal text-foreground">{r.label.split(" ").map((w, j) => <span key={j} className={NOWRAP}>{j > 0 ? " " : ""}{w}</span>)}</th>
                        <td className={`text-foreground ${NUM}`}>{r.avgText}</td>
                        <td data-testid={`benchmark-comp-share-${i}`} className={`text-foreground ${NUM}`}>{r.sharePct}%</td>
                        {comp.showMine && (
                          r.minePct === null
                            ? <td data-testid={`benchmark-comp-mine-${i}`} aria-label="앱에 없는 항목" className={`text-muted-foreground ${NUM}`}>—</td>
                            : <td data-testid={`benchmark-comp-mine-${i}`} className={`font-semibold text-foreground ${NUM}`}>{r.minePct}%</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 space-y-1">
                  {COMP_NOTES.map((n, i) => <p key={i} data-testid={`benchmark-comp-note-${i}`} className="text-xs text-muted-foreground text-pretty break-keep">{n}</p>)}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1 md:col-span-2">
            <p data-testid="benchmark-label" className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground tabular-nums">
              {v.labelParts.map((part) => <span key={part} className={NOWRAP}>{part}</span>)}
            </p>
            <p data-testid="benchmark-source" className="flex flex-wrap gap-x-1 text-xs text-muted-foreground/70">
              {v.sourceParts.map((part) => <span key={part} className={NOWRAP}>{part}</span>)}
            </p>
          </div>
        </div>
      </BenchmarkMore>
    </section>
  );
}
