/**
 * /api/ticker-search
 * 종목명·종목코드로 티커 후보를 검색한다 (주식 입력 폼 자동완성 전용).
 * 정적 마스터 데이터만 사용 — 외부 API·캐시 없음.
 *
 *   GET /api/ticker-search?q=<검색어>&market=kr|us&limit=15
 *   → { results: { ticker: string; name: string; market?: string }[] }
 */

import { NextResponse } from "next/server";
import { KR_SEARCH_ENTRIES } from "@/lib/finance/kr-master";
import { US_SEARCH_ENTRIES, US_TICKER_TO_NAME } from "@/lib/finance/us-master";
import { FOREIGN_STOCK_MAP } from "@/app/api/parse-screenshot/ticker-map";

// 마스터·ticker-map과 동일한 정규화 규칙 (괄호·공백·기호 제거, 소문자)
function norm(s: string): string {
  return s.replace(/[()（）\s\-·&…]/g, "").replace(/\.+$/, "").toLowerCase();
}

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

interface SearchResult {
  ticker: string;
  name: string;
  market?: string;
}

// 랭킹: 낮을수록 상위. 코드/티커 완전일치 > 이름 startsWith > 이름(연속) includes > 다중토큰 AND
// haystacks: 정규화된 이름 후보들(이름/전체이름/별칭). tokens: 공백 분리된 정규화 토큰들.
function rankOf(
  haystacks: string[],
  normQ: string,
  tokens: string[],
  codeOrTicker: string,
  upperQ: string,
): number | null {
  if (codeOrTicker.toUpperCase() === upperQ) return 0;
  if (codeOrTicker.toUpperCase().startsWith(upperQ)) return 1;
  if (haystacks.some((h) => h === normQ)) return 2;
  if (haystacks.some((h) => h.startsWith(normQ))) return 3;
  if (haystacks.some((h) => h.includes(normQ))) return 4;
  // 다중 토큰: 순서·비연속 무관하게 모든 토큰이 한 후보에 포함되면 매칭 (최하위)
  if (tokens.length > 1 && haystacks.some((h) => tokens.every((t) => h.includes(t)))) return 5;
  return null;
}

function searchKr(tokens: string[], normQ: string, upperQ: string, limit: number): SearchResult[] {
  const scored: { r: SearchResult; rank: number }[] = [];
  for (const e of KR_SEARCH_ENTRIES) {
    const rank = rankOf([norm(e.name), norm(e.fullName)], normQ, tokens, e.code, upperQ);
    if (rank != null) scored.push({ r: { ticker: e.code, name: e.name, market: e.market }, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.r.name.length - b.r.name.length);
  return scored.slice(0, limit).map((s) => s.r);
}

function searchUs(tokens: string[], normQ: string, upperQ: string, limit: number): SearchResult[] {
  const scored: { r: SearchResult; rank: number }[] = [];
  const seen = new Set<string>();
  // 1) 영문 마스터 (영문명·티커)
  for (const e of US_SEARCH_ENTRIES) {
    const rank = rankOf([norm(e.name)], normQ, tokens, e.ticker, upperQ);
    if (rank != null && !seen.has(e.ticker)) {
      seen.add(e.ticker);
      scored.push({ r: { ticker: e.ticker, name: e.name, market: e.exchange }, rank });
    }
  }
  // 2) 한글/영문 별칭 맵 (FOREIGN_STOCK_MAP: 별칭 → 티커)
  for (const [alias, ticker] of Object.entries(FOREIGN_STOCK_MAP)) {
    if (seen.has(ticker)) continue;
    const rank = rankOf([norm(alias)], normQ, tokens, ticker, upperQ);
    if (rank != null) {
      seen.add(ticker);
      scored.push({ r: { ticker, name: US_TICKER_TO_NAME[ticker] ?? alias }, rank });
    }
  }
  scored.sort((a, b) => a.rank - b.rank || a.r.name.length - b.r.name.length);
  return scored.slice(0, limit).map((s) => s.r);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get("q") ?? "").trim();
  const market = searchParams.get("market");
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT));

  if (!rawQ || (market !== "kr" && market !== "us")) {
    return NextResponse.json({ results: [] });
  }
  const normQ = norm(rawQ);
  if (!normQ) return NextResponse.json({ results: [] });
  const tokens = rawQ.trim().split(/\s+/).map(norm).filter(Boolean);
  const upperQ = rawQ.toUpperCase();

  const results = market === "kr"
    ? searchKr(tokens, normQ, upperQ, limit)
    : searchUs(tokens, normQ, upperQ, limit);
  return NextResponse.json({ results });
}
