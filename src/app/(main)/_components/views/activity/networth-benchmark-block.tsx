// 성적표 "가계 통계와 나란히" 블록(#201, 5.102) — 공개 가계 통계의 순자산 구간 분포 위에 내 구간을 중립 색으로 강조.
// 계산은 buildNetworthBenchmark(순수). 누르는 것·화면 상태·저장·전송·계측 없음. 내 순자산 금액은 적지 않는다.
// 통계 상수가 비어 있거나 검증에 실패하면 null(원문 확보 전에는 화면에 나오지 않는다).

import { ChartNoAxesColumn } from "lucide-react";
import { HOUSEHOLD_NETWORTH_STATS, type HouseholdNetworthStats } from "@/config/household-networth-stats";
import { buildNetworthBenchmark } from "@/lib/report/networth-benchmark";
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

export function NetworthBenchmarkBlock({ netAsset, realEstateCount, stats = HOUSEHOLD_NETWORTH_STATS }: {
  netAsset: number; realEstateCount: number; stats?: HouseholdNetworthStats;
}) {
  const v = buildNetworthBenchmark({ netAsset, realEstateCount, stats });
  if (!v) return null;
  const c = v.counts;
  return (
    <section data-testid="benchmark-block" aria-label={BENCHMARK_TITLE} className={`${SECTION} ${ENTER}`}>
      <div>
        <SectionHeader icon={ChartNoAxesColumn} tone="brand" title={BENCHMARK_TITLE} titleTestId="benchmark-title" />
        <p data-testid="benchmark-grade-note" className={`${CAPTION} mt-1 text-pretty break-keep`}>{BENCHMARK_GRADE_NOTE}</p>
      </div>

      <div className="space-y-1">
        {c && (
          <p data-testid="benchmark-sentence" className="text-sm font-medium text-foreground text-pretty break-keep tabular-nums">
            가구 <span className={NOWRAP}>100곳 중</span> <span className={NOWRAP}>{c.nText}이</span>{" "}
            {c.mText === null ? "이 구간이에요." : <>이 구간, <span className={NOWRAP}>{c.mText}이</span> 이보다 높은 구간이에요.</>}
          </p>
        )}
        {c?.isTop && <p data-testid="benchmark-top-note" className={`${CAPTION} text-pretty break-keep`}>{BENCHMARK_TOP_NOTE}</p>}
        {v.hidden && <p data-testid="benchmark-hidden-note" className={`${CAPTION} text-pretty break-keep`}>{BENCHMARK_HIDDEN_NOTE}</p>}
        <p data-testid="benchmark-label" className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground tabular-nums">
          {v.labelParts.map((part) => <span key={part} className={NOWRAP}>{part}</span>)}
        </p>
      </div>

      <div className="sm:max-w-xl">
        <div aria-hidden className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>순자산 구간</span>
          <span>가구 비중</span>
        </div>
        <ul data-testid="benchmark-bars" aria-label="순자산 구간별 가구 비중">
          {v.rows.map((row, i) => (
            <li
              key={i}
              data-testid={`benchmark-row-${i}`}
              data-mine={row.mine ? "true" : undefined}
              aria-current={row.mine ? "true" : undefined}
              className={`-mx-2 px-2 grid grid-cols-[4.5rem_1fr_3rem] items-center gap-x-2 rounded-md ${row.mine ? "py-1.5 bg-muted/40" : "py-1"}`}
            >
              <div className="min-w-0">
                <span className={`block text-sm tabular-nums ${NOWRAP} ${row.mine ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
                {row.mine && <span data-testid="benchmark-mine-chip" className={`${SCOPE_MAIN} mt-0.5 inline-block`}>내 구간</span>}
              </div>
              <div aria-hidden className="min-w-0">
                <div
                  data-testid={`benchmark-bar-${i}`}
                  className={`h-2.5 rounded-full ${row.mine ? "bg-foreground" : "bg-foreground/25"}`}
                  style={{ width: `${row.widthPct}%`, minWidth: row.widthPct > 0 ? 4 : 0 }}
                />
              </div>
              <span
                data-testid={`benchmark-value-${i}`}
                className={`text-sm text-right tabular-nums ${NOWRAP} ${row.mine ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {row.valueText}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p data-testid="benchmark-source" className="flex flex-wrap gap-x-1 text-xs text-muted-foreground/70">
        {v.sourceParts.map((part) => <span key={part} className={NOWRAP}>{part}</span>)}
      </p>
    </section>
  );
}
