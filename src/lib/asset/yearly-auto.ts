// 연 탭 '작년 말' 값이 앱 자동 기록인지 알리는 캡션·고치기 폼 기본값(#99 p2-2). 순수 함수, 저장 호출 없음.
import type { MonthlyAssetSnapshot, YearlyNetAsset } from "@/types/asset";

export interface YearlyAutoCaption {
  year: number;
  /** 확신할 때만 "M/D", 아니면 null(날짜 없는 문구) */
  date: string | null;
}

/** Hero 비교 기준(prev)의 note가 "자동"일 때만. 날짜 = 그해 마지막 월 스냅샷의 date + netAsset이 연 값과 같을 때 */
export function yearlyAutoCaption(prev: YearlyNetAsset | null, monthly: MonthlyAssetSnapshot[]): YearlyAutoCaption | null {
  if (!prev || prev.note !== "자동") return null;
  const inYear = monthly.filter((s) => s.month.startsWith(`${prev.year}-`)).sort((a, b) => a.month.localeCompare(b.month));
  const last = inYear[inYear.length - 1];
  if (!last?.date || last.netAsset !== prev.netAsset) return { year: prev.year, date: null };
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(last.date);
  return { year: prev.year, date: m ? `${Number(m[1])}/${Number(m[2])}` : null };
}

export function yearlyAutoCaptionText(c: YearlyAutoCaption): string {
  return c.date ? `${c.year}년 말 값은 ${c.date} 기록이에요` : `${c.year}년 말 값은 자동으로 기록된 값이에요`;
}

/** 수정 폼 기본값 — 지난 연도 '자동' 항목은 메모를 빈 칸으로 시작(저장 = 확정). 올해 항목·수동 항목은 그대로 */
export function yearlyEditDefaults(editData: YearlyNetAsset, currentYear: number): YearlyNetAsset {
  return editData.note === "자동" && editData.year < currentYear ? { ...editData, note: "" } : editData;
}
