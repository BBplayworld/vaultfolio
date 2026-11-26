// 5.164 #328 화면 합계 전용 호출(기기 → /api/parse-screenshot, assetType=stock-total).
// 요청에 싣는 것은 사용자가 방금 올린 이미지와 모드 값뿐이다(앱 합계·보유 목록·증권사 0).
// 한 번만 보내고 다시 보내지 않으며, 제한 시간(8초)에 끊는다. 결과는 메모리에만 있고 저장하지 않는다.
// 기기 일 30회(use-gemini-usage)·장 상태·인식 GA는 건드리지 않는다 — 호출한 쪽이 state()를 읽는 순간에만 쓰인다.
import { parseScreenTotalResponse, SCREEN_TOTAL_MODE, SCREEN_TOTAL_TIMEOUT_MS, type ScreenTotalFetch } from "./reconcile";

export interface ScreenTotalCall {
  /** 지금 이 순간의 상태 — pending(미도착) / failed(실패·429·시간 초과·취소) / done(200, 값 또는 null) */
  state(): ScreenTotalFetch;
  /** 취소(대화상자 닫기·초기화·판정 뒤). 아직 못 받았으면 failed로 남고 늦은 응답은 버린다 */
  cancel(): void;
}

export function startScreenTotalCall(image: File, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): ScreenTotalCall {
  const ctrl = new AbortController();
  let current: ScreenTotalFetch = { status: "pending" };
  const settle = (next: ScreenTotalFetch) => {
    if (current.status === "pending") current = next; // 한 번 정해진 뒤에는 바뀌지 않는다
  };
  const timer = setTimeout(() => {
    settle({ status: "failed" });
    ctrl.abort();
  }, opts.timeoutMs ?? SCREEN_TOTAL_TIMEOUT_MS);
  const form = new FormData();
  form.append("image", image);
  form.append("assetType", SCREEN_TOTAL_MODE);
  (opts.fetchImpl ?? fetch)("/api/parse-screenshot", { method: "POST", body: form, signal: ctrl.signal })
    .then(async (res) => settle(res.ok ? { status: "done", total: parseScreenTotalResponse(await res.json()) } : { status: "failed" }))
    .catch(() => settle({ status: "failed" }))
    .finally(() => clearTimeout(timer));
  return {
    state: () => current,
    cancel: () => {
      settle({ status: "failed" });
      clearTimeout(timer);
      ctrl.abort();
    },
  };
}
