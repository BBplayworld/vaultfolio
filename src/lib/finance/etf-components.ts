// ETF 구성종목(KIS FHKST121600C0) 응답 정규화 — 순수 함수(서버·테스트 공용).
// 입력은 ETF 공개 코드뿐, 응답은 모든 사용자에게 같은 공개 정보다.

import { KR_ETF_CODES } from "@/lib/finance/kr-master";

export interface EtfComponentRow {
  /** KIS 구성종목 코드(국내 단축코드·영숫자 신규코드 포함, 외국 종목은 빈 값·내부 코드일 수 있어 원문 유지) */
  code: string;
  name: string;
  /** 비중(%) — 원문 숫자 */
  weight: number;
}

export interface EtfComponents {
  code: string;
  /** 구성종목 수 — KIS output1 선언값(없으면 null) */
  count: number | null;
  /** 정규화 후 행 수 */
  rows: number;
  /** 비중 합(%) */
  weightSum: number;
  /** 기준일 YYYY-MM-DD — 응답에서 찾지 못하면 null */
  asOf: string | null;
  components: EtfComponentRow[];
  /** 선언 구성 수와 행 수가 같거나 선언이 없을 때만 true — false면 캐시 금지 */
  complete: boolean;
}

// 6자리 숫자 + 신규 영숫자 단축코드(예: 0091P0) — 시세 조회와 같은 대문자 정규화 뒤 비교
const ETF_CODE_RE = /^[0-9][0-9A-Z]{5}$/;

/** 입력 검증 — 형식 + 국내 ETF 마스터 포함. 통과하면 정규화된 코드, 아니면 null */
export function parseEtfCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!ETF_CODE_RE.test(code)) return null;
  return KR_ETF_CODES.has(code) ? code : null;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

const toDate = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const DATE_KEYS = ["stck_bsop_date", "bsop_date", "bas_dt", "stck_bsop_dt"];

function findDate(...objs: unknown[]): string | null {
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    const rec = o as Record<string, unknown>;
    for (const k of DATE_KEYS) {
      const d = toDate(rec[k]);
      if (d) return d;
    }
  }
  return null;
}

/** KIS 응답(output1·output2) → 정규화. output2가 배열이 아니거나 비면 null(실패 취급) */
export function normalizeEtfComponents(code: string, output1: unknown, output2: unknown): EtfComponents | null {
  if (!Array.isArray(output2) || output2.length === 0) return null;
  const components: EtfComponentRow[] = [];
  for (const r of output2) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const weight = toNum(rec.etf_cnfg_issu_rlim);
    if (weight === null || weight < 0) continue;
    components.push({
      code: String(rec.stck_shrn_iscd ?? "").trim().toUpperCase(),
      name: String(rec.hts_kor_isnm ?? "").trim(),
      weight,
    });
  }
  if (components.length === 0) return null;
  const o1 = Array.isArray(output1) ? output1[0] : output1;
  const declared = o1 && typeof o1 === "object" ? toNum((o1 as Record<string, unknown>).etf_cnfg_issu_cnt) : null;
  const count = declared !== null && declared > 0 ? Math.round(declared) : null;
  const weightSum = Math.round(components.reduce((s, c) => s + c.weight, 0) * 100) / 100;
  return {
    code,
    count,
    rows: components.length,
    weightSum,
    asOf: findDate(o1, output2[0]),
    components,
    complete: count === null || count === components.length,
  };
}
