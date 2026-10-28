/**
 * preview/demo-payload.ts
 * preview 전용 데모 진입 처리의 순수 함수(#31). 데모 JSON은 여기서 import하지 않는다(동적 import 전용).
 *  - resolvePreviewAction: 환경·쿼리·자산 유무로 할 일을 결정
 *  - materializeDemo: 월 오프셋 날짜 토큰을 오늘 기준 날짜로 바꾼 applyImportedPayload용 payload 생성
 *  - buildDemoRefreshMeta: 기존 secretasset_asset_refresh 형식의 최신화 메타(#32 블록 7용)
 */

export type PreviewAction = "none" | "demo" | "empty" | "choose";

/**
 * @param isPreview isPreviewEnv() 결과. false면 쿼리와 무관하게 항상 "none"(운영·로컬 무동작)
 * @param search location.search (예: "?demo=1")
 * @param hasAssets 현재 로컬 자산이 1건 이상인지
 * @param choiceDismissed 이 페이지 수명 동안 선택 카드를 이미 닫았는지(버튼 선택·?demo=empty 처리 직후)
 */
export function resolvePreviewAction(
  isPreview: boolean,
  search: string,
  hasAssets: boolean,
  choiceDismissed = false,
): PreviewAction {
  if (!isPreview) return "none";
  const demo = new URLSearchParams(search).get("demo");
  if (demo === "1") return "demo";
  if (demo === "empty") return "empty";
  if (!hasAssets && !choiceDismissed) return "choose";
  return "none";
}

const pad = (n: number) => String(n).padStart(2, "0");

// "YYYY-MM-DD" 기준일에서 월 오프셋 이동 → { y, m(1~12) }
function shiftMonth(today: string, offset: number): { y: number; m: number } {
  const [y, m] = today.split("-").map(Number);
  const idx = y * 12 + (m - 1) + offset;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 날짜 토큰 → 실제 문자열. 토큰이 아니면 그대로.
//  @M<오프셋>D<일> → YYYY-MM-DD (말일·오늘을 넘지 않게 보정)
//  @M<오프셋>      → YYYY-MM
//  @D<일 오프셋>   → YYYY-MM-DD
//  @NOW            → 기준일 ISO 시각
function resolveToken(value: string, today: string): string {
  if (value === "@NOW") return `${today}T00:00:00.000Z`;
  const md = value.match(/^@M(-?\d+)D(\d+)$/);
  if (md) {
    const offset = Number(md[1]);
    const { y, m } = shiftMonth(today, offset);
    let day = Math.min(Number(md[2]), daysInMonth(y, m));
    if (offset >= 0) day = Math.min(day, Number(today.slice(8, 10)));
    return `${y}-${pad(m)}-${pad(day)}`;
  }
  const mo = value.match(/^@M(-?\d+)$/);
  if (mo) {
    const { y, m } = shiftMonth(today, Number(mo[1]));
    return `${y}-${pad(m)}`;
  }
  const d = value.match(/^@D(-?\d+)$/);
  if (d) {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + Number(d[1]));
    return t.toISOString().slice(0, 10);
  }
  return value;
}

function walk(node: unknown, today: string): unknown {
  if (typeof node === "string") return resolveToken(node, today);
  if (Array.isArray(node)) return node.map((v) => walk(v, today));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "_comment") continue;
      out[k] = walk(v, today);
    }
    return out;
  }
  return node;
}

/** 데모 원본(JSON)의 날짜 토큰을 기준일(YYYY-MM-DD, KST) 기준으로 변환한 새 객체. 원본은 변경하지 않는다. */
export function materializeDemo(raw: unknown, today: string): Record<string, unknown> {
  return walk(raw, today) as Record<string, unknown>;
}

/** KST 오늘 날짜(YYYY-MM-DD) — 앱 전반과 같은 기준 */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 데모 주입 직후 기록할 최신화 메타(기존 키·형식, 새 키 없음).
 * 현금·대출은 40일 전(오래됨), 주식·코인은 2일 전(최근) — #32 블록 7 점검용.
 */
export function buildDemoRefreshMeta(now: number = Date.now()): { categories: Record<"stock" | "crypto" | "cash" | "loan", string> } {
  const ago = (days: number) => new Date(now - days * DAY_MS).toISOString();
  return { categories: { stock: ago(2), crypto: ago(2), cash: ago(40), loan: ago(40) } };
}
