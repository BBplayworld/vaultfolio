import type { RealEstate } from "@/types/asset";

/**
 * real-estate-address.ts
 * 부동산 주소 표기 정본 — 폼·상세 카드·공유 인코딩이 같은 규칙을 쓰도록 한곳에 모은다.
 * 구 입력 필드 dongName·hoName은 addressDetail로 통합됐으므로 읽기 시점에 합쳐 준다(저장분 유실 없음).
 */

// 상세주소(동·호) — 신규 addressDetail 우선, 없으면 구 동/호를 합쳐 반환
export function getAddressDetail(item: Partial<RealEstate>): string {
  return item.addressDetail ?? [item.dongName, item.hoName].filter(Boolean).join(" ");
}

// 화면 표시용 전체 주소 — "도로명주소 상세주소". 한쪽만 있으면 있는 쪽만 반환한다.
export function formatFullAddress(item: Partial<RealEstate>): string {
  return [item.address, getAddressDetail(item)].filter(Boolean).join(" ");
}
