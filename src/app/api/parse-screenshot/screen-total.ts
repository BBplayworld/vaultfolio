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

/**
 * 화면에 적힌 금액 글자를 숫자로 바꾼다(5.164 qa D-1). 모델이 숫자를 직접 쓰면 자릿수가 틀어질 수 있어(5,500,000 → 550000000)
 * 모델에게는 화면 글자 그대로("5,500,000원")를 받고 변환은 여기서만 한다. 규칙에 맞지 않으면 null(= 총액 없음, 줄 숨김).
 * - 통화 표시(원·₩·$·KRW·USD)와 공백은 떼어 낸다. 부호(+·-·▲·▼)나 %가 있으면 합계가 아니라 손익·수익률이므로 null.
 * - 쉼표는 세 자리 묶음일 때만 인정한다("5,500,00"·"55,00,000"은 잘못 옮긴 글자로 보고 null). 쉼표 없는 숫자도 인정.
 * - 한글 단위: `N억`·`N만`·나머지 순서로 더한다("1억 2,345만 6,789원" = 123,456,789, "550만원" = 5,500,000, "1.2억" = 120,000,000).
 *   억·만 아래 칸은 각각 1억·1만 미만이어야 한다. `천`·`백` 등 다른 단위 글자는 null.
 * - 소수점은 그대로 둔다(달러 "12,345.67"). 결과는 소수 둘째 자리까지.
 */
export function parseScreenAmount(text: unknown): number | null {
  if (typeof text !== "string") return null;
  let t = text.replace(/\s/g, "");
  if (!t || t.length > 40) return null;
  if (/[+\-−–▲▼△▽%]/.test(t)) return null;
  t = t.replace(/^(₩|￦|\$|KRW|USD)/i, "").replace(/(원|KRW|USD|달러)$/i, "");
  const num = (x: string): number | null => (/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(x) ? Number(x.replace(/,/g, "")) : null);
  const m = /^(?:([\d,.]+)억)?(?:([\d,.]+)만)?([\d,.]+)?$/.exec(t);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  const eok = m[1] === undefined ? 0 : num(m[1]);
  const man = m[2] === undefined ? 0 : num(m[2]);
  const rest = m[3] === undefined ? 0 : num(m[3]);
  if (eok === null || man === null || rest === null) return null;
  const unit = m[1] !== undefined || m[2] !== undefined;
  if (unit) {
    // 단위 표기에서는 아래 칸이 윗 단위를 넘을 수 없고, 소수는 맨 끝 단위 칸에만 올 수 있다
    if (m[1] !== undefined && man >= 10_000) return null;
    if (rest >= 10_000) return null;
    if (m[1] !== undefined && !Number.isInteger(eok) && (m[2] !== undefined || m[3] !== undefined)) return null;
    if (m[2] !== undefined && !Number.isInteger(man) && m[3] !== undefined) return null;
  }
  const value = Math.round((eok * 100_000_000 + man * 10_000 + rest) * 100) / 100;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** 금액 글자와 통화가 서로 어긋나면(원·만·억 ↔ USD, $ ↔ KRW) 믿지 않는다 */
function currencyConflicts(text: string, currency: unknown): boolean {
  if (currency === "USD") return /[원₩￦만억]|KRW/i.test(text);
  if (currency === "KRW") return /\$|USD|달러/i.test(text);
  return false;
}

/** 모델 응답 3필드(금액 글자·라벨·통화) → 응답 값. 하나라도 어긋나면 null */
export function readScreenTotalFields(text: unknown, label: unknown, currency: unknown): ScreenTotal | null {
  if (typeof text !== "string" || currencyConflicts(text, currency)) return null;
  return sanitizeScreenTotal(parseScreenAmount(text), label, currency);
}

export const SCREEN_TOTAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    screenTotalText: { type: Type.STRING },
    screenTotalLabel: { type: Type.STRING },
    screenTotalCurrency: { type: Type.STRING, enum: ["KRW", "USD"] },
  },
  required: ["screenTotalText", "screenTotalLabel", "screenTotalCurrency"],
};

export const buildScreenTotalPrompt = () => `증권 앱 보유종목 화면에서 "보유 주식 평가금액 합계" 한 가지만 읽어라. 종목 행은 읽지 않는다.

읽는 조건: 화면에 합계 라벨(예 "총 평가금액"·"총평가금액"·"평가금액 합계"·"주식 평가금액")로 명시된 금액이 숫자로 보일 때만 읽는다. 없거나 불확실하면 읽지 않는다.

필드:
screenTotalText=그 라벨에 딸린 금액을 화면에 적힌 글자 그대로 옮긴 문자열(쉼표·소수점·단위 포함. 예: 화면에 "5,500,000원"이면 "5,500,000원", "1억 2,345만원"이면 "1억 2,345만원", "$12,345.67"이면 "$12,345.67"). 숫자를 계산·환산·반올림하지 말고, 자릿수와 쉼표 위치를 바꾸지 말고, 0을 더하거나 빼지 말 것.
screenTotalLabel=그 금액 바로 옆·위의 라벨 글자 그대로(고쳐 쓰거나 줄이지 말 것)
screenTotalCurrency=그 금액의 통화(원이면 KRW·달러면 USD)

합계 라벨이 화면에 없으면 screenTotalText="", screenTotalLabel="", screenTotalCurrency="KRW"로 답한다.

금지:
- 종목 값을 더해 계산하지 말 것. 화면에 보이는 글자만 옮긴다.
- "총 평가손익"·"평가손익"·"수익률"·"매입금액"·"총 매입금액"·"예수금"·"주문가능금액"은 합계가 아니다. 이런 라벨만 보이면 screenTotalText="".
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
        maxOutputTokens: 256,
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
  return NextResponse.json({ screenTotal: readScreenTotalFields(o.screenTotalText, o.screenTotalLabel, o.screenTotalCurrency) });
}
