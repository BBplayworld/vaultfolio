// 보유 현황 맞추기(#91) 공용 타입. 순수 함수 5개(merge/match/diff/apply/undo)가 공유한다.
// 코인은 같은 시그니처의 어댑터를 따로 두는 자리만 남긴다(이번 단계는 주식).
import type { Stock } from "@/types/asset";

export type ScreenStatus = "ok" | "failed" | "truncated" | "limit";

/** 서버 응답(`/api/parse-screenshot`)의 주식 1건 중 맞추기가 쓰는 칸 */
export interface RawScreenItem {
  name: string;
  ticker?: string | null;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency?: Stock["currency"];
  originalCurrency?: "KRW" | "USD" | "JPY";
  category: Stock["category"];
  section: "국내" | "해외" | "기타";
  brokerHint?: string;
  /** 수량 미인식(서버가 1로 채운 값) */
  quantityMissing?: boolean;
  /** 평단 역산 여부 */
  averagePriceEstimated?: boolean;
}

/** 장(스크린샷 1장)의 인식 결과 */
export interface RawScreen {
  index: number;
  status: ScreenStatus;
  items: RawScreenItem[];
}

export type BrokerSource = "hint" | "existing" | "user";

/** 증권사·계좌가 정해진 장 */
export interface ResolvedScreen {
  index: number;
  status: ScreenStatus;
  /** 확정된 증권사(기존 항목의 문자 그대로 또는 목록명). 미확정이면 undefined */
  broker?: string;
  brokerSource?: BrokerSource;
  /** 국내 종목이 들어갈 계좌(domestic·isa·irp·pension). 해외 종목은 항상 foreign */
  account: Stock["category"];
  items: ScreenItem[];
}

export interface ScreenItem {
  screenIndex: number;
  /** 장 안 순서(같은 장 중복 행 구분용) */
  row: number;
  name: string;
  ticker: string;
  category: Stock["category"];
  quantity: number;
  /** 저장 통화 기준(해외를 원화로 읽었으면 환율로 나눈 값) */
  averagePrice: number;
  currentPrice: number;
  currency: Stock["currency"];
  quantityMissing: boolean;
  averagePriceEstimated: boolean;
}

/** 장 사이를 합친 종목 */
export interface MergedItem extends Omit<ScreenItem, "screenIndex"> {
  /** 합쳐진 장 번호들 */
  screens: number[];
  broker?: string;
  /** 두 장 수량이 달랐을 때 읽힌 값들(오름차순). 큰 값이 quantity */
  quantityCandidates?: number[];
  /** 병합 순서대로 매긴 고정 번호(rowId 재료) */
  seq: number;
}

export interface ResyncOptions {
  today: string;
  usdRate: number;
}
