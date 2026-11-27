// `새` 표시 자리(4.83) — spot → 연결 새 소식 항목 id·방문 키 대응표 1곳(저장 키 0).
// 켜짐: 항목 게시일(KST)부터 30일, 꺼짐: 그 visitKey의 마지막 방문이 게시일 00:00 KST 이후(판정 lib/new-spot.ts).
// 한 화면에 1개만: 성과 허브 = hub-week > hub-monthly > hub-market(NEW_SPOT_ORDER). 상세·주식 stock-market은 5.170 시장 타일 제거로 쓰는 곳이 없어 5.171에서 정의 제거.
export type NewSpot = "hub-week" | "hub-monthly" | "hub-market";

export const NEW_SPOTS: Record<NewSpot, { entryId: string; visitKey: string }> = {
  "hub-week": { entryId: "20261111-03", visitKey: "change-week" },
  "hub-monthly": { entryId: "20261111-04", visitKey: "monthly-log" },
  "hub-market": { entryId: "20261111-02", visitKey: "activity:change-market" },
};

export const HUB_NEW_SPOT_ORDER: readonly NewSpot[] = ["hub-week", "hub-monthly", "hub-market"];
