import { z } from "zod";

// 거래 내역 스키마
export const transactionSchema = z.object({
  id: z.string(), // tx_{timestamp}
  stockId: z.string(), // Stock.id 참조
  ticker: z.string(), // 정규화된 티커
  stockName: z.string(), // 거래 시점 종목명
  type: z.enum(["buy", "sell"]),
  quantity: z.number().min(0),
  price: z.number().min(0), // 체결 단가
  currency: z.enum(["KRW", "USD", "JPY"]),
  exchangeRate: z.number().optional(), // 체결 시 환율
  date: z.string(), // YYYY-MM-DD
  fee: z.number().optional(), // 수수료
  reflected: z.boolean(), // Position에 반영됨 여부
  reflectedAt: z.string().optional(), // 반영 시각
  reflectionId: z.string().optional(), // 멱등성 보장 ID
  memo: z.string().optional(),
  createdAt: z.string(),
});

export type Transaction = z.infer<typeof transactionSchema>;

// 포지션 스냅샷 — 재계산 기준점
export interface PositionSnapshot {
  stockId: string;
  quantity: number;
  avgPrice: number;
  avgExchangeRate: number;
  source: "manual" | "computed"; // 직접 입력 / 거래 계산
  effectiveDate: string; // 이 스냅샷의 기준 시점
  lockedByManual: boolean; // 직접 입력으로 고정됐는지
}

// 재계산 미리보기
export interface PositionPreview {
  quantity: number;
  avgPrice: number;
  avgExchangeRate: number;
}

// 검증 결과
export type GuardLevel = "pass" | "confirm" | "restrict";

export interface GuardResult {
  level: GuardLevel;
  reason?: "manual_override" | "backdated" | "oversell" | "already_reflected";
  preview?: PositionPreview;
  maxQty?: number;
}
