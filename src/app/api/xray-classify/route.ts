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
import { KR_CODE_TO_NAME } from "@/lib/kr-master";

// 코드→약명 역맵 (KRX 전종목 마스터)
const reverseDomesticMap: Record<string, string> = KR_CODE_TO_NAME;

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
    "- sector: 종목이 속한 상위 카테고리 **정확히 1개**. 아래 분류군 중에서만 선택:",
    "    [핵심 테크 (AI, 로봇, 모빌리티)]",
    "    \"AI 및 반도체\"             — 예) NVDA, AVGO, AMD, TSM, ASML, SK하이닉스, 한미반도체 및 NVDL/NVDY 등의 엔비디아 레버리지/커버드콜 ETF",
    "    \"AI 및 소프트웨어\"           — 예) MSFT, AAPL, GOOGL, META, PLTR, CRWD 및 이들의 레버리지/커버드콜/파생 ETF(예: MSFL, APLY, GGLL, METL)",
    "    \"AI 인프라 및 전력\"          — 예) VRT(버티브), ANET, SMCI, EQIX, GE Vernova, ETN(이튼), GEV, HD현대일렉트릭, 효성중공업, LS ELECTRIC, 대한광통신",
    "    \"로봇 및 산업 자동화\"        — 예) 로보틱스, 양족 로봇 제조사, ROK, CGNX, 스마트 팩토리 솔루션",
    "    \"자율주행 및 모빌리티\"       — 예) TSLA(FSD/자율주행 주도), MBLY(모빌아이), 현대차, 기아 및 TSLL/TSLY 등의 테슬라 레버리지/커버드콜 ETF, LG에너지솔루션, 삼성SDI 등 이차전지 및 전기차 부품 제조사",
    "    ",
    "    [전통 및 융합 산업]",
    "    \"금융 및 핀테크\"            — 예) JPM, BAC, MS, GS, BRK.B, PYPL, SQ, NU, Visa, Mastercard, 미래에셋증권, VICI 등 대형 금융지주/보험사/리츠",
    "    \"바이오 및 헬스케어\"          — 예) LLY, NVO, UNH, ELV, CI, TDOC, OGN 및 비만치료제/AI 신약개발/디지털 헬스케어 관련 기업",
    "    \"소비재 및 유통\"            — 예) AMZN, WMT, COST, TGT, SBUX, TJX, NFLX, DIS, SPOT, MO, 코웨이 및 이커머스/유통/미디어 콘텐츠/생활가전/필수소비재 관련 기업 및 파생 ETF(예: AMZU)",
    "    \"인프라 및 물류\"            — 예) CAT, DE, 두산밥캣, FDX, UPS, CHRW, WM, XOM, CVX, COP, 대한항공, SK텔레콤, 현대제철, 삼성중공업, 전통 에너지/건설/물류/통신/철강/조선 관련 기업",
    "    \"방산 및 우주항공\"           — 예) LMT, RTX, GD, NOC, RKLB, NASA, 한화에어로스페이스, LIG넥스원",
    "    \"블록체인 및 디지털자산\"      — 예) COIN, MARA, RIOT, MSTR, BMNR 및 IBIT, ETHU, FBTC 등의 비트코인/이더리움 현물/선물 ETF",
    "    ",
    "    [공통 상품]",
    "    \"ETF/펀드\"                  — 예) SPY, QQQ, VOO, DIA, SOXL, SCHD, MAGS, KODEX/TIGER/KBSTAR 등의 모든 지수/테마/배당 포트폴리오 ETF 및 뮤추얼 펀드 (단, 단일 주식 추종 레버리지 ETF는 제외)",
    "    \"기타\"                      — 위 어디에도 속하지 않는 일반 잡화 및 단순 도소매 등 분류 불가 기업",
    "  중요 특수 규칙:",
    "  - 가상자산/블록체인 인프라 및 채굴 기업(예: BMNR, COIN, MARA, RIOT 등) 및 비트코인/이더리움 현물/선물 ETF(예: IBIT, ETHU, FBTC 등)는 'ETF/펀드'가 아니며 반드시 '블록체인 및 디지털자산'으로 분류해야 합니다. 특히 BMNR, IBIT, ETHU는 '블록체인 및 디지털자산'으로 정확히 매핑해 주세요.",
    "  - 단일 주식을 추종하는 레버리지/커버드콜/옵션 ETF(예: TSLL/TSLY -> Tesla 추종, NVDL/NVDY -> Nvidia 추종, CONL/CONY -> Coinbase 추종, MSFL/MSFO -> Microsoft 추종, APLY -> Apple 추종, AMZY -> Amazon 추종 등)는 'ETF/펀드'가 아닌 **기초 개별 기업의 sector**(예: TSLL은 '자율주행 및 모빌리티', NVDL은 'AI 및 반도체', MSFL/APLY는 'AI 및 소프트웨어', AMZY는 '소비재 및 유통')로 분류해야 합니다.",
    "  - 반면 지수나 여러 기업을 담은 포트폴리오형 인덱스/테마 ETF(예: SPY, QQQ, VOO, MAGS, TIGER 미국나스닥100, KODEX 2차전지산업, ACE 미국S&P500 등)는 개별 기업이 아니므로 반드시 'ETF/펀드' sector로 분류해야 합니다.",
    "  - 복수 사업 영위 종목은 매출·이익 비중이 가장 큰 1개로 배정합니다.",
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
    "  NASDAQ 관련 지수는 반드시 'NASDAQ 100'으로 통일해 주시고, 'NASDAQ'이나 'NASDAQ Composite'는 사용하지 마세요.",
    "  ETF·펀드는 추종(벤치마크) 지수로 매핑: 예) SPY/VOO/IVV→S&P 500, QQQ/QLD/QID→NASDAQ 100, DIA→Dow Jones Industrial Average, IWM→Russell 2000, SCHD/JEPI/JEPQ 등 배당·커버드콜·테마·레버리지 ETF도 기초 지수로. 미국 반도체, AI, 테크 등의 테마 ETF는 NASDAQ 100으로, 미국 배당, TOP10 등 대형 가치주/지수 테마 ETF는 S&P 500으로 매핑해도 좋습니다.",
    "  국내 상장 ETF도 추종(벤치마크) 지수 기준으로 매핑하라: 미국 지수 추종(예: ACE 미국S&P500→S&P 500, KODEX 미국나스닥100→NASDAQ 100, TIGER 미국배당다우존스→Dow Jones Industrial Average)이면 해당 미국 지수, 국내 지수 추종(예: KODEX 코스피·KODEX 200→KOSPI 200, TIGER 코스닥150→KOSDAQ 150)이면 KOSPI/KOSDAQ. 상장 거래소와 추종 지수는 다를 수 있으니 반드시 추종 지수를 우선하라.",
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
  
  const isNumeric = (str: string) => /^\d+$/.test(str);
  const normalized = Array.from(dedup.values()).map((it) => {
    let name = it.name?.trim();
    if (!name || isNumeric(name)) {
      const mapped = reverseDomesticMap[it.ticker];
      if (mapped) name = mapped;
    }
    return { ...it, name };
  });

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
      (SECTOR_ENUM as readonly string[]).includes(c.sector) && // 현재 유효한 섹터인지 검증
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
