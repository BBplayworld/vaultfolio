// `새` 표시 자리(4.83) — spot → 연결 새 소식 항목 id·방문 키 대응표 1곳(저장 키 0).
// 켜짐: 항목 게시일(KST)부터 30일, 꺼짐: 그 visitKey의 마지막 방문이 게시일 00:00 KST 이후(판정 lib/new-spot.ts).
// 한 화면에 1개만: 상세·주식 = stock-market, 성과 허브 = hub-week > hub-monthly > hub-market(NEW_SPOT_ORDER).
export type NewSpot = "stock-market" | "hub-week" | "hub-monthly" | "hub-market";

export const NEW_SPOTS: Record<NewSpot, { entryId: string; visitKey: string }> = {
  "stock-market": { entryId: "20261111-02", visitKey: "activity:change-market" },
  "hub-week": { entryId: "20261111-03", visitKey: "change-week" },
  "hub-monthly": { entryId: "20261111-04", visitKey: "monthly-log" },
  "hub-market": { entryId: "20261111-02", visitKey: "activity:change-market" },
};

export const HUB_NEW_SPOT_ORDER: readonly NewSpot[] = ["hub-week", "hub-monthly", "hub-market"];
