/**
 * X-Ray 종목 분류 API v2
 *
 * - ticker 배열을 받아 핵심 분야(themes) 다중 태그 + 지수 멤버십 + 시가총액 분류 반환
 * - 서버 캐시(90일 TTL, v2 키) 우선 조회 → 미스만 Gemini 일괄 호출
 * - KR 종목의 marketCapTier·KOSPI/KOSDAQ 기본 지수는 KIS 추출 경로(/api/finance)가 보충
 * - Gemini 호출량은 입력 ticker 수와 무관하게 호출당 1회로 카운트
 */

import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { getCacheStorage, GEMINI_SERVER_DAILY_LIMIT } from "@/lib/cache-storage";
import type { StockClassification } from "@/lib/xray/classification-store";

interface ClassifyItem {
  ticker: string;
  name?: string;
  market?: string;
  category?: string;
}

interface ClassifyRequest {
  items: ClassifyItem[];
}

const REGION_ENUM = ["KR", "US", "JP", "CN", "HK", "Other"] as const;
const CAP_TIER_ENUM = ["large", "mid", "small", "unknown"] as const;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  description: "ticker → classification 매핑 (입력 ticker 모두 포함)",
  properties: {
    classifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ticker: { type: Type.STRING },
          themes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "핵심 사업·기술·산업 분야 정확히 3~4개. 통합 카테고리(예: 정보기술/임의소비재) 금지.",
            minItems: 3,
            maxItems: 4,
          },
          themePrimary: { type: Type.STRING },
          industry: { type: Type.STRING },
          region: { type: Type.STRING, enum: [...REGION_ENUM] },
          marketCapTier: { type: Type.STRING, enum: [...CAP_TIER_ENUM] },
          indices: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["ticker", "themes", "themePrimary", "region"],
      },
    },
  },
  required: ["classifications"],
};

const BATCH_SIZE = 60;

function buildPrompt(items: ClassifyItem[]): string {
  return [
    "다음은 한국·해외 증권 종목 목록입니다. 각 종목의 핵심 확장 분야(themes)를 다중 태그로 분류해 주세요.",
    "",
    "규칙:",
    "- themes: 종목의 핵심 사업·기술·산업 분야 **정확히 3~4개** 다중 태그. 한국어 또는 단순 영문 가능.",
    "  중요도 높은 분야 위주로 선별. 너무 세부적인 분야는 묶어서 표현(예: '메모리/파운드리/시스템반도체' → '반도체').",
    "  좋은 예: 테슬라 → [\"전기차\",\"자율주행\",\"AI/로보틱스\",\"에너지 저장\"]",
    "          삼성전자 → [\"반도체\",\"스마트폰\",\"디스플레이\"]",
    "          JPMorgan → [\"대형은행\",\"투자은행\",\"자산운용\"]",
    "  나쁜 예: [\"정보기술\"], [\"임의소비재\"] (통합 카테고리, 절대 사용 금지)",
    "          [\"메모리\",\"파운드리\",\"시스템반도체\",\"AI 가속기\",\"이미지센서\"] (지나치게 세분 — 묶어서 ~4개로)",
    "- themePrimary: themes 중 가장 대표적인 1개.",
    "- industry: 세부 산업 영문 (선택).",
    "- region: ISO2 국가코드(KR/US/JP/CN/HK/Other).",
    "- marketCapTier: 시가총액 추정 (US/JP 등 해외 기준 large=$10B+, mid=$2-10B, small=<$2B).",
    "  한국 종목은 unknown으로 두면 됩니다 (서버가 KIS 데이터로 덮어쓸 예정).",
    "- indices: 종목이 속한 주요 시장 지수 (예: [\"S&P 500\",\"NASDAQ 100\"], [\"KOSPI 200\"], [\"Nikkei 225\",\"TOPIX\"]).",
    "  미국: S&P 500, NASDAQ 100, Dow Jones Industrial Average, Russell 2000 중 해당 항목.",
    "  일본: Nikkei 225, TOPIX. 한국: KOSPI 200, KOSDAQ 150.",
    "  거래소(NASDAQ/NYSE/KOSPI/KOSDAQ 등 기본 시장)는 서버가 별도로 추가하므로 적지 않아도 됩니다.",
    "- 모든 입력 ticker를 빠짐없이 응답에 포함하세요. 알 수 없는 종목은 best-effort 추정.",
    "",
    "입력:",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

async function callGeminiClassify(
  items: ClassifyItem[],
  apiKey: string,
): Promise<Record<string, StockClassification>> {
  const genAI = new GoogleGenAI({ apiKey });
  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-lite",
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
    contents: [{ role: "user", parts: [{ text: buildPrompt(items) }] }],
  });

  const rawText = result.text?.trim() ?? "";
  let parsed: { classifications?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini 응답 파싱 실패");
  }
  const out: Record<string, StockClassification> = {};
  for (const row of parsed.classifications ?? []) {
    const ticker = (typeof row.ticker === "string" ? row.ticker : "").toUpperCase();
    if (!ticker) continue;
    const themes = Array.isArray(row.themes) ? (row.themes as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
    const indices = Array.isArray(row.indices) ? (row.indices as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
    const cap = typeof row.marketCapTier === "string" && (CAP_TIER_ENUM as readonly string[]).includes(row.marketCapTier)
      ? (row.marketCapTier as StockClassification["marketCapTier"])
      : undefined;
    out[ticker] = {
      themes,
      themePrimary: typeof row.themePrimary === "string" ? row.themePrimary : themes[0],
      industry: typeof row.industry === "string" ? row.industry : undefined,
      region: typeof row.region === "string" ? row.region : undefined,
      marketCapTier: cap,
      indices: indices.length > 0 ? indices : undefined,
    };
  }
  return out;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  let body: ClassifyRequest;
  try {
    body = (await request.json()) as ClassifyRequest;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items.filter((it) => it && typeof it.ticker === "string" && it.ticker.trim().length > 0) : [];
  if (items.length === 0) {
    return NextResponse.json({ classifications: {}, meta: { cached: 0, fetched: 0, remaining: -1 } });
  }
  const dedup = new Map<string, ClassifyItem>();
  for (const it of items) {
    const t = it.ticker.trim().toUpperCase();
    if (!dedup.has(t)) dedup.set(t, { ...it, ticker: t });
  }
  const normalized = Array.from(dedup.values());

  const cache = getCacheStorage();

  // 1. 캐시 조회
  const cached: Record<string, StockClassification> = {};
  const misses: ClassifyItem[] = [];
  for (const it of normalized) {
    const c = await cache.getStockClassification(it.ticker);
    // themes가 비어 있으면 미수집 취급 (v1 잔존 등) — 안전망
    if (c && Array.isArray(c.themes) && c.themes.length > 0) {
      cached[it.ticker] = c;
    } else {
      misses.push(it);
    }
  }

  if (misses.length === 0) {
    return NextResponse.json({
      classifications: cached,
      meta: { cached: normalized.length, fetched: 0, remaining: -1 },
    });
  }

  // 2. 서버 한도 (배치 전체를 1회로 카운트)
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];
  const allowed = await cache.checkGeminiDailyLimit(todayStr);
  if (!allowed) {
    return NextResponse.json(
      {
        classifications: cached,
        meta: { cached: Object.keys(cached).length, fetched: 0, remaining: 0 },
        error: `오늘의 AI 분석 한도(${GEMINI_SERVER_DAILY_LIMIT}회)가 초과되었습니다.`,
      },
      { status: 429 },
    );
  }

  // 3. Gemini 일괄 호출 (배치 분할)
  const fetched: Record<string, StockClassification> = {};
  try {
    for (let i = 0; i < misses.length; i += BATCH_SIZE) {
      const batch = misses.slice(i, i + BATCH_SIZE);
      const result = await callGeminiClassify(batch, apiKey);
      Object.assign(fetched, result);
    }
    // 4. 캐시 저장 + 카운터 1회 증가
    for (const [ticker, value] of Object.entries(fetched)) {
      await cache.setStockClassification(ticker, value);
    }
    await cache.incrementGeminiDailyCount(todayStr);
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[api/xray-classify] error:", message);
    const isOverloaded = message.includes("503") || message.includes("UNAVAILABLE");
    const isQuotaExceeded = message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
    const userMessage = isOverloaded
      ? "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요."
      : isQuotaExceeded
        ? "AI 요청 한도를 초과했습니다."
        : `AI 분류 오류: ${message}`;
    return NextResponse.json(
      {
        classifications: cached,
        meta: { cached: Object.keys(cached).length, fetched: 0, remaining: -1 },
        error: userMessage,
      },
      { status: 500 },
    );
  }

  const remaining = Math.max(0, GEMINI_SERVER_DAILY_LIMIT - (await cache.getGeminiDailyCount(todayStr)));
  return NextResponse.json({
    classifications: { ...cached, ...fetched },
    meta: {
      cached: Object.keys(cached).length,
      fetched: Object.keys(fetched).length,
      remaining,
    },
  });
}
