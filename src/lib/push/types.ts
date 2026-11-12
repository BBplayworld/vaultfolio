// 시장 알림(#179) 공용 타입 — 서버 저장 레코드는 endpoint·keys·카탈로그 ID·조건뿐(보유 정보 0).
export type PushCond = "daily" | "pm2";
export type PushMarket = "kr" | "us";

export interface PushSubRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string[];
  cond: PushCond;
  updatedAt: string; // YYYY-MM-DD(일 단위)
}

// 서버 저장 형태 — endpoint·keys는 AES-256-GCM 블롭, 나머지는 카탈로그 ID·조건·날짜(일 단위)뿐
export interface PushStoredSub {
  blob: string;
  topics: string[];
  cond: PushCond;
  createdAt: string;
  updatedAt: string;
}

// OS 알림 페이로드 — 3필드만(시장·제목·본문)
export interface PushPayload {
  m: PushMarket | "test";
  t: string;
  b: string;
}
