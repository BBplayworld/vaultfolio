import { GUIDES, type GuideDoc } from "../guide-copy";
import { GuideActions } from "../guide-actions";
import Link from "next/link";
import { DecadeTable, GUIDE_TABLE_DISCLAIMER, HikeTable, RecessionTable } from "./decade-table";
import { InvestView } from "@/app/(main)/_components/views/invest/invest-view";

/** 공개 가이드 `/guide/market-history`(#263): 본문 = 앱 투자 탭 컴포넌트 1벌. 기본 지수 S&P 500 고정(내 자산 판정 0), 가이드 전용 블록 0.
 *  SSR HTML에는 머리 3줄·목록 행 같은 파생값만 나가고, 지수 수준값을 쓰는 그림·표는 마운트 뒤에 그린다(InvestView variant="guide"). */
export function MarketHistoryArticle({ doc }: { doc: GuideDoc }) {
  const Table = doc.slug === "index-returns-by-year" ? DecadeTable : doc.slug === "rate-hike-years" ? HikeTable : doc.slug === "recession-years" ? RecessionTable : null;
  return (
    <>
      <div>
        <h1 data-testid="guide-title" className="text-xl md:text-2xl font-bold leading-snug text-balance break-keep">
          {doc.h1}
        </h1>
        <p data-testid="guide-summary" className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
          {doc.summary}
        </p>
      </div>
      {Table && <Table />}
      {(doc.slug === "rate-hike-years" || doc.slug === "recession-years") && <p data-testid="guide-table-disclaimer" className="-mt-2 text-xs text-muted-foreground text-pretty break-keep">{GUIDE_TABLE_DISCLAIMER}</p>}
      <InvestView variant="guide" defaultIndex="spx" />
      <GuideActions primary={doc.primary} secondary={doc.secondary} />
      {doc.slug === "market-history" && (
        <p data-testid="guide-related" className="text-sm text-muted-foreground">
          관련 글 ·{" "}
          <Link href="/guide/rate-hike-years" className="inline-flex min-h-10 items-center font-medium text-foreground underline underline-offset-2">{GUIDES["rate-hike-years"].linkLabel}</Link>
          {" "}·{" "}
          <Link href="/guide/recession-years" className="inline-flex min-h-10 items-center font-medium text-foreground underline underline-offset-2">{GUIDES["recession-years"].linkLabel}</Link>
        </p>
      )}
    </>
  );
}
