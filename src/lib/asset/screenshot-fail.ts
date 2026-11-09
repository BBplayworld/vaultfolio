// 스크린샷 인식 실패 박스 문구(#99) — 서버 원문은 화면에 쓰지 않고 목록 매핑만 쓴다.
// 서버 문구가 바뀌면 기본값 '읽지 못했어요'로 떨어질 뿐 깨지지 않는다.

export type ScreenshotFailKind = "empty" | "error" | "network";
export type ScreenshotFailAsset = "stock" | "crypto" | "cash" | "loan";

export const SCREENSHOT_FAIL_DEFAULT = "읽지 못했어요";
export const SCREENSHOT_FAIL_NETWORK = "네트워크 오류로 읽지 못했어요";

const EMPTY_TITLES: Record<ScreenshotFailAsset, string> = {
  stock: "인식된 종목이 없어요",
  crypto: "인식된 코인이 없어요",
  cash: "인식된 계좌·예금이 없어요",
  loan: "인식된 대출이 없어요",
};

export const emptyFailTitle = (asset: ScreenshotFailAsset): string => EMPTY_TITLES[asset];

/** /api/parse-screenshot·api-guard 오류 응답(status, error 문구) → 박스 제목 */
export function mapParseErrorTitle(status: number, message?: unknown): string {
  const msg = typeof message === "string" ? message : "";
  if (status === 413) return "10MB 이하 사진만 읽을 수 있어요";
  if (status === 429) return "요청이 많아 지금은 읽지 못했어요";
  if (status === 400 && msg.includes("형식")) return "JPG·PNG·WEBP·HEIC 사진만 읽을 수 있어요";
  if (status === 400 && msg.includes("10MB")) return "10MB 이하 사진만 읽을 수 있어요";
  if (status === 500 && (msg.includes("혼잡") || msg.includes("한도"))) return "요청이 많아 지금은 읽지 못했어요";
  return SCREENSHOT_FAIL_DEFAULT;
}

export interface ScreenshotFail {
  kind: ScreenshotFailKind;
  title: string;
  /** 재실패 시 박스 재마운트용(role=alert 재안내) */
  seq: number;
}

let seq = 0;
export const makeScreenshotFail = (kind: ScreenshotFailKind, title: string): ScreenshotFail => ({ kind, title, seq: ++seq });
