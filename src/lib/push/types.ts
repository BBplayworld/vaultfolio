// 알림(#179) 공용 타입 — 서버 저장 레코드는 endpoint·keys·알림 종류 ID뿐(보유 정보 0).
export type PushKind = "settle" | "tax";

export interface PushSubRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string[];
  updatedAt: string; // YYYY-MM-DD(일 단위)
}

// 서버 저장 형태 — endpoint·keys는 AES-256-GCM 블롭, 나머지는 알림 종류 ID·날짜(일 단위)뿐
export interface PushStoredSub {
  blob: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
}

// OS 알림 페이로드 — 3필드만(종류·제목·본문). 종류는 알림 누름 도착 화면·tag 결정용
export interface PushPayload {
  m: PushKind | "test";
  t: string;
  b: string;
}
