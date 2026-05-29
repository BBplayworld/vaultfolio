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
import { SECTOR_ENUM, type StockClassification } from "@/lib/xray/classification-store";

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
const CAP_TIER_ENUM = ["large", "mid", "small", "etf", "unknown"] as const;

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
          sector: {
            type: Type.STRING,
            enum: [...SECTOR_ENUM],
            description: "종목이 속한 상위 카테고리 1개 (한 종목 = 단일 sector).",
          },
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
          indices: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "종목이 속한 주요 지수 최소 1개. 개별주는 소속 지수, ETF·펀드는 추종(벤치마크) 지수로 매핑(예 SPY/VOO/IVV→S&P 500, QQQ/QLD→NASDAQ 100, DIA→Dow Jones). 모르면 시장 대표 지수 1개라도. 거래소는 서버가 추가.",
            minItems: 1,
          },
        },
        required: ["ticker", "sector", "themes", "themePrimary", "region", "indices"],
      },
    },
  },
  required: ["classifications"],
};

const BATCH_SIZE = 20; // 대량 종목 시 응답 토큰 한도 초과 방지 (이전 60에서 축소)

function buildPrompt(items: ClassifyItem[]): string {
  return [
    "다음은 한국·해외 증권 종목 목록입니다. 각 종목의 상위 카테고리(sector)와 핵심 확장 분야(themes)를 분류해 주세요.",
    "",
    "규칙:",
    "- sector: 종목이 속한 상위 카테고리 **정확히 1개**. 아래 14개 분류군 중에서만 선택:",
    "    \"AI/반도체\"       — 예) NVDA, AVGO, AMD, TSM, ASML",
    "    \"클라우드/SaaS\"    — 예) MSFT, ORCL, CRM, ADBE, NOW",
    "    \"인터넷/플랫폼\"    — 예) GOOGL, META, AMZN(커머스 부문 포함)",
    "    \"소비자 전자\"      — 예) AAPL, SONY",
    "    \"미래 모빌리티\"    — 예) TSLA, RIVN, BYD",
    "    \"미디어/엔터\"     — 예) NFLX, DIS, SPOT",
    "    \"금융\"           — 예) JPM, BAC, V, MA, BRK.B",
    "    \"헬스케어/바이오\"  — 예) LLY, UNH, JNJ, ABBV, TMO, PFE",
    "    \"소비재\"         — 예) WMT, COST, HD, PG, KO, PEP, MCD",
    "    \"에너지\"         — 예) XOM, CVX, COP",
    "    \"산업재\"         — 예) BA, CAT, GE, HON, UPS",
    "    \"통신·유틸리티\"   — 예) T, VZ, NEE, DUK",
    "    \"부동산\"         — 예) PLD, AMT, EQIX (REIT)",
    "    \"기타\"           — 위 어디에도 명확히 속하지 않는 경우만",
    "  좋은 예: TSLA → \"미래 모빌리티\" (AI/반도체 아님), AAPL → \"소비자 전자\",",
    "          AMZN → \"인터넷/플랫폼\" (AWS 비중 크지만 매출 기준 커머스가 주력).",
    "  중요: 한 종목은 단 하나의 sector에만 배정. 복수 사업 영위 종목은 매출·이익 비중이 가장 큰 1개로.",
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
    "- marketCapTier: 시가총액 규모. 모든 종목에 대해 추정하세요.",
    "    해외(US/JP 등): large=$10B+, mid=$2-10B, small=<$2B.",
    "    한국: large=시총 ₩10조+, mid=₩1~10조, small=<₩1조. (예: 삼성전자·SK하이닉스·현대차 등 대형주는 large)",
    "    ETF·펀드·리츠형 상품(단일 기업 시총 없음)은 etf로 분류. 예) SPY, VOO, QLD, SOXL, NVDL, TECL, TIGER/KODEX 류.",
    "    unknown은 정말 식별 불가능한 경우에만 사용하세요.",
    "- indices: 종목이 속한 주요 시장 지수를 **최소 1개 이상** (예: [\"S&P 500\",\"NASDAQ 100\"], [\"KOSPI 200\"], [\"Nikkei 225\",\"TOPIX\"]).",
    "  개별주: 미국 S&P 500/NASDAQ 100/Dow Jones Industrial Average/Russell 2000, 일본 Nikkei 225/TOPIX, 한국 KOSPI 200/KOSDAQ 150 중 해당 항목.",
    "  ETF·펀드는 추종(벤치마크) 지수로 매핑: 예) SPY/VOO/IVV→S&P 500, QQQ/QLD/QID→NASDAQ 100, DIA→Dow Jones Industrial Average, IWM→Russell 2000, SCHD/JEPI/JEPQ 등 배당·커버드콜·테마·레버리지 ETF도 기초 지수로. KODEX/TIGER 국내 ETF는 KOSPI 200 등 추종 지수.",
    "  모르면 시장 대표 지수 1개라도 반드시 채우세요. 거래소(NASDAQ/NYSE/KOSPI/KOSDAQ 등 기본 시장)는 서버가 별도로 추가합니다.",
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
      maxOutputTokens: 8192,
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
    const sector = typeof row.sector === "string" && (SECTOR_ENUM as readonly string[]).includes(row.sector)
      ? (row.sector as StockClassification["sector"])
      : undefined;
    out[ticker] = {
      sector,
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

// 한 배치가 파싱 실패하면 절반으로 쪼개 재시도. 최소 단위(<=2)까지 실패하면 해당 ticker만 스킵.
// 다른 5xx/quota 류 오류는 상위로 전파 (전체 중단 판단을 호출부에 맡김).
async function classifyWithSplit(
  items: ClassifyItem[],
  apiKey: string,
): Promise<{ ok: Record<string, StockClassification>; failed: string[] }> {
  try {
    const ok = await callGeminiClassify(items, apiKey);
    return { ok, failed: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 응답 잘림(파싱 실패)일 때만 분할 재시도. 그 외 오류는 그대로 throw.
    const isParseFailure = msg.includes("파싱 실패");
    if (!isParseFailure) throw e;
    if (items.length <= 2) {
      console.warn("[xray-classify] split give-up, skip tickers:", items.map((i) => i.ticker).join(","));
      return { ok: {}, failed: items.map((i) => i.ticker) };
    }
    const mid = Math.floor(items.length / 2);
    const a = await classifyWithSplit(items.slice(0, mid), apiKey);
    const b = await classifyWithSplit(items.slice(mid), apiKey);
    return { ok: { ...a.ok, ...b.ok }, failed: [...a.failed, ...b.failed] };
  }
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
    // themes·sector·indices 모두 있어야 유효. indices 누락(특히 ETF) 항목은 1회 재분류 — 지수 축 보강
    if (
      c &&
      Array.isArray(c.themes) &&
      c.themes.length > 0 &&
      typeof c.sector === "string" &&
      c.sector.length > 0 &&
      Array.isArray(c.indices) &&
      c.indices.length > 0
    ) {
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

  // 3. Gemini 일괄 호출 — NDJSON 스트리밍. 배치마다 진행률(chunk) 전송 → 클라가 % 표시.
  //    한 배치 파싱 실패는 분할 재시도(classifyWithSplit), 그래도 실패 시 해당 종목만 스킵.
  const total = misses.length;
  const cachedCount = Object.keys(cached).length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const partialFailed: string[] = [];
      let fetchedCount = 0;
      // 시작: 캐시 분류 즉시 전달
      write({ type: "meta", total, cached: cachedCount, classifications: cached });
      try {
        let done = 0;
        for (let i = 0; i < misses.length; i += BATCH_SIZE) {
          const batch = misses.slice(i, i + BATCH_SIZE);
          const { ok, failed } = await classifyWithSplit(batch, apiKey);
          // 저장 후 재조회 — KIS region·indices가 합쳐진 병합값을 클라에 전달(미스 종목의 KIS 지수 유실 방지)
          const merged: Record<string, StockClassification> = {};
          for (const [ticker, value] of Object.entries(ok)) {
            await cache.setStockClassification(ticker, value);
            merged[ticker] = (await cache.getStockClassification(ticker)) ?? value;
          }
          partialFailed.push(...failed);
          fetchedCount += Object.keys(ok).length;
          done = Math.min(done + batch.length, total);
          write({ type: "chunk", done, total, classifications: merged, failed });
        }
        await cache.incrementGeminiDailyCount(todayStr);
        const remaining = Math.max(0, GEMINI_SERVER_DAILY_LIMIT - (await cache.getGeminiDailyCount(todayStr)));
        write({
          type: "done",
          meta: {
            cached: cachedCount,
            fetched: fetchedCount,
            remaining,
            partialFailedCount: partialFailed.length,
            partialFailedTickers: partialFailed,
          },
        });
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
        write({ type: "error", error: userMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
