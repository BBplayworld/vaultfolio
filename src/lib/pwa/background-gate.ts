import { isInAppGateActive } from "./detect-browser";
import { isPwaLocked } from "./app-lock";

/**
 * 전체화면 게이트(인앱 브라우저 하드 게이트·앱 잠금)가 화면을 덮고 있어
 * **자동 백그라운드 동작을 하면 안 되는 상태**인지.
 *
 * 시세·환율·코인·스냅샷 저장·부동산 실거래 재조회·자동 push 등 사용자가 인지하지 못하는 사이
 * 네트워크를 타거나 localStorage를 쓰는 경로는 전부 이 판정을 거친다.
 *
 * 두 게이트를 호출 지점마다 따로 쓰면 새 effect를 추가할 때 한쪽을 빠뜨린다
 * (실제로 부동산 갱신 effect가 인앱 게이트 가드 없이 돌고 있었다) — 그래서 하나로 묶는다.
 */
export function isBackgroundWorkBlocked(): boolean {
  return isInAppGateActive() || isPwaLocked();
}
