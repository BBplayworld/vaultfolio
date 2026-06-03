import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { lookupTicker, DOMESTIC_ETF_MAP, DOMESTIC_STOCK_MAP } from "./ticker-map";
import { getCacheStorage, GEMINI_SERVER_DAILY_LIMIT } from "@/lib/cache-storage";

// 국내 ETF만 "종목명→티커" 형식으로 압축 (모듈 로드 시 1회 실행)
const DOMESTIC_ETF_TABLE = Object.entries(DOMESTIC_ETF_MAP)
  .map(([name, ticker]) => `${name}→${ticker}`)
  .join(",");

// 국내 종목 티커 Set — section이 "해외"여도 이 안에 있으면 domestic으로 강제
const DOMESTIC_TICKERS = new Set([
  ...Object.values(DOMESTIC_ETF_MAP),
  ...Object.values(DOMESTIC_STOCK_MAP),
]);

type ParseAssetType = "stock" | "crypto" | "cash" | "loan";

// ─────────────────────────────────────────────────────────
// 주식 스키마 / 프롬프트 / 후처리
// ─────────────────────────────────────────────────────────

const STOCK_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      ticker: { type: Type.STRING },
      quantity: { type: Type.NUMBER },
      quantityMissing: { type: Type.BOOLEAN },
      currentPrice: { type: Type.NUMBER },
      averagePrice: { type: Type.NUMBER },
      currentValue: { type: Type.NUMBER },
      profitAmount: { type: Type.NUMBER },
      profitRate: { type: Type.NUMBER },
      section: { type: Type.STRING, enum: ["국내", "해외", "기타"] },
      currency: { type: Type.STRING, enum: ["KRW", "USD", "JPY"] },
      brokerHint: { type: Type.STRING },
    },
    required: ["name", "quantity", "quantityMissing", "profitRate", "section"],
  },
};

const buildStockPrompt = () => `증권 앱 보유종목 화면에서 종목별 정보를 추출하라.

필드:
name=종목명(그대로), ticker=티커(화면에 보이면 최우선 추출·없으면 [국내 ETF 티커] 목록의 종목명과 일치할때만 해당 티커 추출·SPY 등 해외주식에 국내ETF 티커를 임의 매핑 절대 금지·해외주식은 해외 티커 추론·모르면 ""), quantity=보유수량(숫자만), quantityMissing=수량이 화면에 없어서 1로 설정했으면 true·실제 수량이 있으면 false, currentPrice=현재가(화면에 숫자로 명시된 경우만·없으면 0), averagePrice=평균단가(화면에 숫자로 명시된 경우만·없으면 0), currentValue=총평가금액(종목명 우측에 위치한 가장 큰 금액 숫자·단위 제외하고 숫자만·없으면 0), profitAmount=평가손익 금액(부호포함·수익률 옆의 금액 숫자·단위 제외·없으면 0), profitRate=손익률(부호포함 숫자·없으면 0), section=국내|해외|기타, currency=통화(KRW|USD|JPY), brokerHint=화면에서 증권사명이 텍스트로 보이면 그대로 추출(예:"토스증권"·"미래에셋"·"키움")·없으면 ""

[국내 ETF 티커]
${DOMESTIC_ETF_TABLE}

무시: 계좌번호·총평가금액·광고배너

예시 레이아웃 (토스증권/도미노):
- 왼쪽: 브랜드(TIGER 등), 종목명, 수량이 2~3줄
- 오른쪽: 평가금액(큰 숫자), 평가손익+수익률(작은 숫자)
- 증권사 앱마다 레이아웃이 다를 수 있으므로 레이아웃보다 종목명·티커 기준으로 판단할 것

section 판단 규칙:
- 화면에 "해외주식" "국내주식" 탭·헤더·레이블이 명시된 경우 최우선 적용
- 종목명에 "인베스코(Invesco)", "뱅가드(Vanguard)", "iShares", "SPDR" 등 해외 운용사명이 포함되거나 QQQ·SPY·VOO 등 해외 ETF 약칭이 포함된 경우 section=해외
- 국내 ETF 브랜드(TIGER·KODEX·ACE·HANARO·SOL·RISE 등)와 혼동 금지

추출 규칙: 종목명 줄과 수량 줄 우측에 있는 숫자들을 각각 currentValue와 profitAmount로 정확히 매핑할 것. 한 행에 데이터가 흩어져 있어도 하나의 종목으로 합쳐서 추출.`;

interface GeminiStock {
  name: string;
  ticker?: string | null;
  quantity: number;
  quantityMissing: boolean;
  currentPrice?: number;
  averagePrice?: number;
  currentValue?: number;
  profitAmount?: number;
  profitRate: number;
  section: "국내" | "해외" | "기타";
  currency?: string;
  brokerHint?: string;
}

function processStockResults(raw: GeminiStock[], today: string) {
  const filtered = raw.filter((s) => {
    if (!s.name) return false;
    const hasCurrentValue = (s.currentValue ?? 0) > 0;
    const hasCurrentPrice = (s.currentPrice ?? 0) > 0;
    const hasProfitAmount = (s.profitAmount ?? 0) !== 0;
    const hasProfitRate = (s.profitRate ?? 0) !== 0;
    // 평가금액, 현재가, 수익금, 수익률 중 하나라도 있으면 처리 가능
    return hasCurrentValue || hasCurrentPrice || hasProfitAmount || hasProfitRate;
  });

  let prevCategory: "domestic" | "foreign" = "domestic";

  return filtered.map((s, idx) => {
    const rawTicker = s.ticker && s.ticker !== "null" ? s.ticker : null;
    let ticker = rawTicker || "";
    // ticker-map에 종목명이 등록된 경우 AI 반환값보다 map을 우선 (AI 오인식 교정)
    const mapTicker = lookupTicker(s.name);
    if (mapTicker && !(s.section === "해외" && /^\d{6}$/.test(mapTicker))) {
      ticker = mapTicker;
    } else if (!ticker) {
      // map에 없고 AI도 없으면 빈 티커 유지
    }

    // 유명 국내 ETF 브랜드로 시작하는지 검사 (예: TIGER 미국테크TOP10 IND)
    const isDomesticBrand = /^(TIGER|KODEX|ACE|KINDEX|HANARO|SOL|RISE|KBSTAR|ARIRANG|TIMEFOLIO|BIG|PLUS|KOSEF)(?:\s|[가-힣])/i.test(s.name);
    // 한글 없이 영문, 숫자, 기호 등으로만 구성된 순수 영문 이름인지 검사
    const isPureEnglish = /^[a-zA-Z0-9.\s&'-]+$/.test(s.name.trim());

    // AI가 티커 필드에 한글 종목명이나 이상한 긴 문자열을 넣은 경우 초기화
    if (/[가-힣]/.test(ticker) || ticker.length > 15) {
      ticker = lookupTicker(s.name) || "";
    }

    // 국내 ETF 브랜드인데 티커가 6자리 숫자가 아닌 경우(AI가 영문 문자열 등 환각을 넣은 경우) 재검색
    if (isDomesticBrand && !/^\d{6}$/.test(ticker)) {
      ticker = lookupTicker(s.name) || "";
    }

    // AI가 "SPY" 등 해외주식에 대해 의미상 유사한 국내 ETF 티커(예: 360750)를 환각으로 부여하는 것 방지
    if (isPureEnglish && !isDomesticBrand && /^\d{6}$/.test(ticker)) {
      ticker = lookupTicker(s.name) || "";
    }

    // 국내 브랜드가 아닌데 6자리 국내 코드를 AI가 반환한 경우 → lookupTicker로 재확인하여 해외 티커면 교체
    if (!isDomesticBrand && /^\d{6}$/.test(ticker)) {
      const lookedUp = lookupTicker(s.name);
      if (lookedUp && !/^\d{6}$/.test(lookedUp)) {
        ticker = lookedUp;
      }
    }

    // 티커 미확인인데 이름이 순수 영문(또는 영문+숫자 혼합, 마침표 포함)인 경우 티커로 간주
    if (!ticker && /^[a-zA-Z0-9.]+$/.test(s.name.replace(/\s/g, "")) && s.name.length <= 8) {
      ticker = s.name.replace(/\s/g, "").toUpperCase();
    }

    const isDomesticTicker = ticker ? DOMESTIC_TICKERS.has(ticker) : false;
    // 6자리 숫자가 아닌 영문 티커 → 해외주식 (section이 "국내"여도 우선 적용)
    const isForeignTickerByShape = !!ticker && !/^\d{6}$/.test(ticker) && /^[A-Z0-9.]+$/.test(ticker);

    let category: "domestic" | "foreign" | "irp";
    if (s.section === "기타") {
      category = "irp";
    } else if (isDomesticTicker || isDomesticBrand) {
      category = "domestic";
      prevCategory = "domestic";
    } else if (isForeignTickerByShape || isPureEnglish || s.section === "해외") {
      category = "foreign";
      prevCategory = "foreign";
    } else if (s.section === "국내") {
      category = "domestic";
      prevCategory = "domestic";
    } else {
      category = prevCategory;
    }

    let quantity: number;
    let currentPrice: number;
    if (!s.quantityMissing && s.quantity > 0) {
      quantity = Math.round(s.quantity * 1000000) / 1000000;
      // 현재가 우선, 없으면 평가금액÷수량, 없으면 수익금으로 역산
      if ((s.currentPrice ?? 0) > 0) {
        currentPrice = Math.round((s.currentPrice!) * 100) / 100;
      } else if ((s.currentValue ?? 0) > 0) {
        currentPrice = Math.round((s.currentValue! / quantity) * 100) / 100;
      } else if ((s.profitAmount ?? 0) !== 0 && s.profitRate !== 0) {
        // 수익금 = 현재가치 × (profitRate/100) → 현재가치 역산
        const currentTotalValue = (s.profitAmount! / (s.profitRate / 100)) + s.profitAmount!;
        currentPrice = Math.round((currentTotalValue / quantity) * 100) / 100;
      } else {
        currentPrice = 0;
      }
    } else {
      quantity = 1;
      currentPrice = (s.currentPrice ?? 0) > 0 ? s.currentPrice! : (s.currentValue ?? 0);
    }

    const divisor = 1 + s.profitRate / 100;
    const averagePrice = (s.averagePrice ?? 0) > 0
      ? Math.round(s.averagePrice! * 100) / 100
      : divisor > 0 ? Math.round((currentPrice / divisor) * 100) / 100 : currentPrice;

    // AI 원본 currency 보존 (환산 분기용)
    // 국내 티커가 아닌 종목(해외주식)인데 가격 >= 5000이면 원화 표시 앱으로 간주
    // category가 잘못 domestic으로 분류된 경우도 커버하기 위해 category 대신 isDomesticTicker 기준 사용
    const isForeignTicker = !isDomesticTicker && !!ticker;
    const priceSeemKRW = (category === "foreign" || isForeignTicker) && currentPrice >= 5000;
    const aiCurrencyIsKRW = s.currency === "KRW" || priceSeemKRW;
    const originalCurrency: "KRW" | "USD" | "JPY" = (s.currency === "JPY") ? "JPY"
      : aiCurrencyIsKRW ? "KRW"
        : (s.currency === "USD") ? "USD"
          : priceSeemKRW ? "KRW" : "USD";

    const currency = (originalCurrency === "USD" || originalCurrency === "JPY")
      ? originalCurrency
      : category === "foreign" ? "USD" : "KRW";

    return {
      id: `stock_import_${Date.now()}_${idx}`,
      name: s.name,
      ticker,
      quantity,
      currentPrice,
      averagePrice,
      currency: currency as "KRW" | "USD" | "JPY",
      originalCurrency,
      category,
      purchaseDate: today,
      description: "",
      section: category === "foreign" ? "해외" as const : category === "irp" ? "기타" as const : "국내" as const,
      brokerHint: s.brokerHint || "",
    };
  });
}

// ─────────────────────────────────────────────────────────
// 암호화폐 스키마 / 프롬프트 / 후처리
// ─────────────────────────────────────────────────────────

const CRYPTO_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      symbol: { type: Type.STRING },
      quantity: { type: Type.NUMBER },
      averagePrice: { type: Type.NUMBER },
      currentPrice: { type: Type.NUMBER },
      exchange: { type: Type.STRING },
    },
    required: ["name", "symbol", "quantity", "currentPrice"],
  },
};

const buildCryptoPrompt = () => `암호화폐 거래소 앱 보유 화면에서 코인 정보를 추출하라.

필드:
name=코인명(한글 또는 영문), symbol=심볼(BTC/ETH/XRP 등 대문자), quantity=보유수량(소수점 포함), averagePrice=평균단가(원화·없으면 0), currentPrice=현재가(원화), exchange=거래소명(업비트/빗썸/바이낸스 등·없으면 "")

무시: 총평가금액·입금주소·이벤트 배너·미보유 코인`;

interface GeminiCrypto {
  name: string;
  symbol: string;
  quantity: number;
  averagePrice?: number;
  currentPrice: number;
  exchange?: string;
}

function processCryptoResults(raw: GeminiCrypto[], today: string) {
  return raw
    .filter((s) => s.name && s.symbol && s.currentPrice > 0)
    .map((s, idx) => {
      const currentPrice = Math.round(s.currentPrice * 100) / 100;
      const averagePrice = s.averagePrice && s.averagePrice > 0
        ? Math.round(s.averagePrice * 100) / 100
        : currentPrice;
      const quantity = Math.round(s.quantity * 1e8) / 1e8;
      return {
        id: `crypto_import_${Date.now()}_${idx}`,
        name: s.name,
        symbol: s.symbol.toUpperCase(),
        quantity,
        averagePrice,
        currentPrice,
        averagePriceMissing: !s.averagePrice || s.averagePrice === 0,
        exchange: s.exchange || "",
        purchaseDate: today,
        description: "",
      };
    });
}

// ─────────────────────────────────────────────────────────
// 현금성 자산 스키마 / 프롬프트 / 후처리
// ─────────────────────────────────────────────────────────

const CASH_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      type: { type: Type.STRING, enum: ["bank", "cma", "cash", "deposit", "savings"] },
      balance: { type: Type.NUMBER },
      institution: { type: Type.STRING },
    },
    required: ["name", "type", "balance"],
  },
};

const buildCashPrompt = () => `은행·증권 앱 계좌 화면에서 계좌·예금 정보를 추출하라.

필드:
name=계좌명 또는 상품명, type=bank(입출금·보통예금)|deposit(정기예금)|savings(적금)|cma(CMA·MMF)|cash(현금), balance=잔액(원화 정수), institution=금융기관명(없으면 "")

무시: 대출 항목·카드 한도·포인트·투자상품`;

interface GeminiCash {
  name: string;
  type: "bank" | "cma" | "cash" | "deposit" | "savings";
  balance: number;
  institution?: string;
}

function processCashResults(raw: GeminiCash[], today: string) {
  void today;
  return raw
    .filter((s) => s.name && s.balance > 0)
    .map((s, idx) => ({
      id: `cash_import_${Date.now()}_${idx}`,
      name: s.name,
      type: s.type,
      balance: Math.round(s.balance),
      currency: "KRW" as const,
      institution: s.institution || "",
      description: "",
    }));
}

// ─────────────────────────────────────────────────────────
// 대출 스키마 / 프롬프트 / 후처리
// ─────────────────────────────────────────────────────────

const LOAN_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      type: { type: Type.STRING, enum: ["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"] },
      balance: { type: Type.NUMBER },
      interestRate: { type: Type.NUMBER },
      institution: { type: Type.STRING },
      startDate: { type: Type.STRING },
    },
    required: ["name", "type", "balance", "interestRate"],
  },
};

const buildLoanPrompt = () => `대출 계좌 화면에서 대출 정보를 추출하라.

필드:
name=대출명, type=credit(신용대출)|minus(마이너스통장)|mortgage-home(주택담보)|mortgage-stock(주식담보)|mortgage-insurance(보험담보)|mortgage-deposit(예금담보)|mortgage-other(기타담보), balance=현재잔액(원화 정수), interestRate=금리(숫자만·예:3.5), institution=금융기관명(없으면 ""), startDate=대출실행일(YYYY-MM-DD·모르면 "")

무시: 예금·적금 항목·카드·포인트`;

interface GeminiLoan {
  name: string;
  type: "credit" | "minus" | "mortgage-home" | "mortgage-stock" | "mortgage-insurance" | "mortgage-deposit" | "mortgage-other";
  balance: number;
  interestRate: number;
  institution?: string;
  startDate?: string;
}

function processLoanResults(raw: GeminiLoan[], today: string) {
  return raw
    .filter((s) => s.name && s.balance > 0)
    .map((s, idx) => ({
      id: `loan_import_${Date.now()}_${idx}`,
      name: s.name,
      type: s.type,
      balance: Math.round(s.balance),
      interestRate: s.interestRate ?? 0,
      institution: s.institution || "",
      startDate: s.startDate || today,
      startDateMissing: !s.startDate,
      description: "",
    }));
}

// ─────────────────────────────────────────────────────────
// API 핸들러
// ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  // KST 기준 오늘 날짜
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];

  // 서버 전역 하루 한도 체크
  const cache = getCacheStorage();
  const allowed = await cache.checkGeminiDailyLimit(todayStr);
  if (!allowed) {
    return NextResponse.json(
      { error: `오늘의 AI 분석 한도(${GEMINI_SERVER_DAILY_LIMIT}회)가 초과되었습니다. 내일 다시 시도해주세요.` },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 400 });
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile) {
    return NextResponse.json({ error: "이미지 파일이 없습니다." }, { status: 400 });
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "이미지 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(imageFile.type)) {
    return NextResponse.json({ error: "JPG, PNG, WEBP, HEIC 형식만 지원합니다." }, { status: 400 });
  }

  // assetType 파라미터 (기본값: stock)
  const assetTypeRaw = formData.get("assetType");
  const assetType: ParseAssetType =
    assetTypeRaw === "crypto" ? "crypto"
      : assetTypeRaw === "cash" ? "cash"
        : assetTypeRaw === "loan" ? "loan"
          : "stock";

  // 이미지 → base64 변환 (처리 후 메모리에서 소멸, 저장 없음)
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // 타입별 프롬프트·스키마 선택
  const promptText =
    assetType === "crypto" ? buildCryptoPrompt()
      : assetType === "cash" ? buildCashPrompt()
        : assetType === "loan" ? buildLoanPrompt()
          : buildStockPrompt();

  const responseSchema =
    assetType === "crypto" ? CRYPTO_SCHEMA
      : assetType === "cash" ? CASH_SCHEMA
        : assetType === "loan" ? LOAN_SCHEMA
          : STOCK_SCHEMA;

  try {
    const genAI = new GoogleGenAI({ apiKey });

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/heic",
                data: base64,
              },
            },
          ],
        },
      ],
    });

    const rawText = result.text?.trim() ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geminiRaw: any[];
    try {
      geminiRaw = JSON.parse(rawText);
      if (!Array.isArray(geminiRaw)) throw new Error("배열이 아닌 응답");
    } catch {
      return NextResponse.json(
        { error: "파싱 결과를 읽을 수 없습니다. 다른 스크린샷으로 시도해보세요.", rawText },
        { status: 422 }
      );
    }

    // Gemini 호출 성공 후 카운트 증가 (실패 시 카운트 제외)
    await cache.incrementGeminiDailyCount(todayStr);

    // 타입별 후처리
    if (assetType === "crypto") {
      const cryptos = processCryptoResults(geminiRaw as GeminiCrypto[], todayStr);
      return NextResponse.json({ cryptos, rawText });
    }
    if (assetType === "cash") {
      const cashes = processCashResults(geminiRaw as GeminiCash[], todayStr);
      return NextResponse.json({ cashes, rawText });
    }
    if (assetType === "loan") {
      const loans = processLoanResults(geminiRaw as GeminiLoan[], todayStr);
      return NextResponse.json({ loans, rawText });
    }

    // stock (기본)
    const stocks = processStockResults(geminiRaw as GeminiStock[], todayStr);
    return NextResponse.json({ stocks, rawText });

  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[api/parse-screenshot] error: ", message);

    const isOverloaded = message.includes("503") || message.includes("UNAVAILABLE") || message.includes("high demand");
    const isQuotaExceeded = message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota");
    const userMessage = isOverloaded
      ? "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요."
      : isQuotaExceeded
        ? "AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
        : `AI 인식 오류: ${message}`;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
