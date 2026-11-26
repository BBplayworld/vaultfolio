// 5.164 #328 맞추기 결과 대조 — 화면에 글자로 적힌 합계만 읽는 전용 호출(assetType=stock-total).
// 행 인식 호출(route.ts의 주식 프롬프트·스키마·설정)과 완전히 분리돼 있다. 요청은 이미지 + 모드 값뿐이다.
// 서버는 읽은 값을 저장·캐시·로그하지 않고 응답에만 실어 돌려준다(기기 메모리에서만 쓴다). 풀 카운터는 횟수만 센다.
import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { reserveGeminiCalls, STOCK_TOTAL_POOL } from "@/server/api-guard";
import { isTinyImage } from "./image-size";

export const STOCK_TOTAL_MODE = "stock-total";

export interface ScreenTotal {
  value: number;
  /** 화면에 적힌 합계 라벨 글자(예: "총 평가금액") — 예수금 포함 여부를 기기에서 판단하는 데 쓴다 */
  label: string;
  currency: "KRW" | "USD";
}

const CURRENCIES = ["KRW", "USD"] as const;
const MAX_LABEL = 30;

/** 모델이 준 합계 필드를 검증한다. 숫자 아님·0 이하·라벨 없음·통화 불명이면 null(= 총액 없음) */
export function sanitizeScreenTotal(value: unknown, label: unknown, currency: unknown): ScreenTotal | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (typeof label !== "string") return null;
  const trimmed = label.trim().slice(0, MAX_LABEL);
  if (!trimmed) return null;
  if (!(CURRENCIES as readonly string[]).includes(currency as string)) return null;
  return { value, label: trimmed, currency: currency as ScreenTotal["currency"] };
}

export const SCREEN_TOTAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    screenTotal: { type: Type.NUMBER },
    screenTotalLabel: { type: Type.STRING },
    screenTotalCurrency: { type: Type.STRING, enum: ["KRW", "USD"] },
  },
  required: ["screenTotal", "screenTotalLabel", "screenTotalCurrency"],
};

export const buildScreenTotalPrompt = () => `증권 앱 보유종목 화면에서 "보유 주식 평가금액 합계" 한 가지만 읽어라. 종목 행은 읽지 않는다.

읽는 조건: 합계를 뜻하는 라벨(예: "총 평가금액"·"총평가금액"·"평가금액 합계"·"주식 평가금액")이 화면에 글자로 적혀 있고, 그 라벨 옆이나 바로 아래에 금액이 숫자로 적혀 있을 때만 읽는다.

필드:
screenTotal=그 라벨에 딸린 금액(쉼표·단위를 뺀 숫자만), screenTotalLabel=화면에 적힌 라벨 글자 그대로(고쳐 쓰거나 줄이지 말 것), screenTotalCurrency=그 금액의 통화(원이면 KRW·달러면 USD)

합계 라벨이 화면에 없으면 screenTotal=0, screenTotalLabel="", screenTotalCurrency="KRW"로 답한다.

금지:
- 종목 행의 금액을 더하거나 계산해서 합계를 만들지 말 것. 화면에 적힌 숫자만 옮긴다.
- "총 평가손익"·"평가손익"·"수익률"·"매입금액"·"총 매입금액"·"예수금"·"주문가능금액"은 합계가 아니다. 이런 라벨만 보이면 screenTotal=0.
- 종목 한 줄의 평가금액을 합계로 답하지 말 것.`;

const noTotal = () => NextResponse.json({ screenTotal: null });

/**
 * 화면 합계 전용 응답. 200 `{ screenTotal: { value, label, currency } | null }`, 풀·전역 한도 초과는 429, 호출 실패는 500.
 * 입구 가드(guardRequest·크기·형식·시그니처)는 route.ts가 이미 통과시킨 뒤 부른다.
 */
export async function respondScreenTotal(request: Request, apiKey: string, image: ArrayBuffer, mimeType: string): Promise<NextResponse> {
  // 너무 작은 이미지는 호출·차감 없이 '총액 없음'
  if (isTinyImage(new Uint8Array(image), mimeType)) return noTotal();

  // 전용 풀(일 60) + 시간당·일 전역 한도 — 행 인식과 같은 원자 예약. 전역 한도는 올리지 않는다
  const denied = await reserveGeminiCalls(request, 1, "오늘 합계 확인 이용이 많아 마감됐어요.", STOCK_TOTAL_POOL);
  if (denied) return denied;

  let rawText: string;
  try {
    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0,
        maxOutputTokens: 128,
        responseMimeType: "application/json",
        responseSchema: SCREEN_TOTAL_SCHEMA,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: buildScreenTotalPrompt() },
            { inlineData: { mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/heic", data: Buffer.from(image).toString("base64") } },
          ],
        },
      ],
    });
    if (String(result.candidates?.[0]?.finishReason) === "MAX_TOKENS") return noTotal();
    rawText = result.text?.trim() ?? "";
  } catch (e) {
    // 호출 오류 메시지만 남긴다(응답 본문·읽은 값은 여기까지 오지 않는다)
    console.error("[api/parse-screenshot] stock-total error: ", e instanceof Error ? e.message : "알 수 없는 오류");
    return NextResponse.json({ screenTotal: null, error: "합계를 확인하지 못했어요." }, { status: 500 });
  }

  // 읽을 수 없는 응답은 '총액 없음'으로 본다(로그 없음)
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return noTotal();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return noTotal();
  const o = parsed as Record<string, unknown>;
  return NextResponse.json({ screenTotal: sanitizeScreenTotal(o.screenTotal, o.screenTotalLabel, o.screenTotalCurrency) });
}
