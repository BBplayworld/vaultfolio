import { GUIDES, GUIDE_RELATED, type GuideDoc } from "../guide-copy";
import { GuideActions } from "../guide-actions";
import Link from "next/link";
import { DecadeTable, GUIDE_TABLE_DISCLAIMER, HikeTable, KospiYearTable, RecessionTable, RecoveryTable } from "./decade-table";
import { KOSPI_DEF, LIST_NOTE_2, LIST_SUB_SENTENCE } from "@/lib/invest/text";
import { InvestView } from "@/app/(main)/_components/views/invest/invest-view";

/** 공개 가이드 `/guide/market-history`(#263): 본문 = 앱 투자 탭 컴포넌트 1벌. 기본 지수 S&P 500 고정(내 자산 판정 0), 가이드 전용 블록 0.
 *  SSR HTML에는 머리 3줄·목록 행 같은 파생값만 나가고, 지수 수준값을 쓰는 그림·표는 마운트 뒤에 그린다(InvestView variant="guide"). */
export function MarketHistoryArticle({ doc }: { doc: GuideDoc }) {
  const Table = doc.slug === "index-returns-by-year" ? DecadeTable : doc.slug === "rate-hike-years" ? HikeTable : doc.slug === "recession-years" ? RecessionTable : doc.slug === "recovery-years" ? RecoveryTable : doc.slug === "kospi-by-year" ? KospiYearTable : null;
  // 제목 아래 정의 1줄(5.141): G1 = 크게 빠진 때 정의(LIST_SUB 한 문장), G3 = −15% 이하 해 정의 + 같은 시기 기록 고지
  const def = doc.slug === "recovery-years" ? LIST_SUB_SENTENCE : doc.slug === "kospi-by-year" ? `${KOSPI_DEF} ${LIST_NOTE_2}` : null;
  const related = GUIDE_RELATED[doc.slug] ?? [];
  return (
    <>
      <div>
        <h1 data-testid="guide-title" className="text-xl md:text-2xl font-bold leading-snug text-balance break-keep">
          {doc.h1}
        </h1>
        <p data-testid="guide-summary" className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
          {doc.summary}
        </p>
        {def && <p data-testid="guide-definition" className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{def}</p>}
      </div>
      {Table && <Table />}
      {["rate-hike-years", "recession-years", "recovery-years", "kospi-by-year"].includes(doc.slug) && <p data-testid="guide-table-disclaimer" className="-mt-2 text-xs text-muted-foreground text-pretty break-keep">{GUIDE_TABLE_DISCLAIMER}</p>}
      <InvestView variant="guide" defaultIndex={doc.slug === "kospi-by-year" ? "kospi" : "spx"} />
      <GuideActions primary={doc.primary} secondary={doc.secondary} />
      {related.length > 0 && (
        // 점은 항목 앞 왼쪽 여백에 두고 바깥 상자가 잘라, 줄 머리에 걸린 점은 보이지 않는다(줄 머리·끝 `·` 0)
        <div data-testid="guide-related" className="overflow-hidden text-sm text-muted-foreground">
          <div className="-ml-3 flex flex-wrap items-center">
            <span className="ml-3 whitespace-nowrap">관련 글</span>
            {related.map((s) => (
              <span key={s} className="relative ml-3 before:absolute before:-left-2 before:top-1/2 before:-translate-y-1/2 before:content-['·']">
                <Link href={`/guide/${s}`} className="inline-flex min-h-10 items-center rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 break-keep">{GUIDES[s].linkLabel}</Link>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
