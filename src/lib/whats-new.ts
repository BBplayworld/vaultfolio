// 새 소식 판정(#159, 4.82) — 순수 함수 + 읽음 기록 헬퍼. 기록 키는 기존 `secretasset_notice_seen`(모양 그대로, 의미만 "마지막으로 읽은 새 소식 id").
// id 비교는 반드시 숫자(날짜 → 순번). 문자열 비교 금지("-10"이 "-09"보다 커야 하고 순번 없는 옛 id는 seq 0).

import { WHATS_NEW, type WhatsNewEntry } from "@/config/whats-new";
import { readNoticeSeen, markNoticeSeen, type NoticeSeenRecord } from "./local-storage";
import { todayKst } from "./tax-utils";

export const WHATS_NEW_GAP_MS = 7 * 24 * 60 * 60 * 1000; // 팁 노출 간격(7일)
export const WHATS_NEW_UNSEEN_DAYS = 30; // 안 본 항목 대상 기간
export const WHATS_NEW_LIST_DAYS = 60; // 시트 목록 기간
export const WHATS_NEW_LIST_MAX = 20;
export const WHATS_NEW_NEW_MAX = 5; // 시트에서 '새' 표시를 다는 상한
const SEEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 기록 만료(구버전 호환, 쓰는 시점 + 90일)

export interface ParsedEntryId {
  date: number; // YYYYMMDD
  seq: number; // 순번 없는 옛 id(YYYYMMDD)는 0
}

export function parseEntryId(id: unknown): ParsedEntryId | null {
  if (typeof id !== "string") return null;
  const [day, seqPart, ...rest] = id.split("-");
  if (rest.length > 0 || !/^\d{8}$/.test(day) || (seqPart !== undefined && !/^\d{2}$/.test(seqPart))) return null;
  const [y, mo, d] = [Number(day.slice(0, 4)), Number(day.slice(4, 6)), Number(day.slice(6, 8))];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { date: y * 10000 + mo * 100 + d, seq: seqPart ? Number(seqPart) : 0 };
}

/** 날짜 → 순번 순으로 숫자 비교(a<b면 음수). 해석 불가 id는 가장 오래된 것으로 취급 */
export function compareIds(a: string, b: string): number {
  const pa = parseEntryId(a);
  const pb = parseEntryId(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  return pa.date - pb.date || pa.seq - pb.seq;
}

// 날짜 숫자(YYYYMMDD) → UTC 일수(일수 차이 계산용 — 시각 의존 제거)
function dayIndex(date: number): number {
  return Math.floor(Date.UTC(Math.floor(date / 10000), Math.floor((date % 10000) / 100) - 1, date % 100) / 86_400_000);
}

function todayIndex(today: string): number {
  return dayIndex(Number(today.replaceAll("-", "")));
}

function ageDays(entry: WhatsNewEntry, today: string): number {
  const p = parseEntryId(entry.id);
  return p ? todayIndex(today) - dayIndex(p.date) : Infinity;
}

/** 읽음 기록 읽기 — 만료·깨진 값·해석 불가 id는 "기록 없음" */
export function readSeen(): NoticeSeenRecord | null {
  const r = readNoticeSeen();
  return r && parseEntryId(r.id) ? r : null;
}

/** 안 본 항목: id > 기록 id이고 게시일이 오늘(KST) 기준 30일 이내. 기록 없으면 최근 30일 전부 */
export function unseenEntries(entries: WhatsNewEntry[], record: NoticeSeenRecord | null, today: string = todayKst()): WhatsNewEntry[] {
  return entries.filter((e) => ageDays(e, today) <= WHATS_NEW_UNSEEN_DAYS && (!record || compareIds(e.id, record.id) > 0));
}

/** 시트 목록: 게시일 60일 이내, 위에서 20개 */
export function sheetEntries(entries: WhatsNewEntry[], today: string = todayKst()): WhatsNewEntry[] {
  return entries.filter((e) => ageDays(e, today) <= WHATS_NEW_LIST_DAYS).slice(0, WHATS_NEW_LIST_MAX);
}

/** 홈 팁 판정: 안 본 항목이 있고, 기록 없음 또는 seenAt에서 7일 이상 지났을 때 */
export function whatsNewTip(
  record: NoticeSeenRecord | null,
  { now = Date.now(), today = todayKst(), entries = WHATS_NEW }: { now?: number; today?: string; entries?: WhatsNewEntry[] } = {},
): { count: number; title: string } | null {
  const unseen = unseenEntries(entries, record, today);
  if (unseen.length === 0) return null;
  if (record && now - record.seenAt < WHATS_NEW_GAP_MS) return null;
  return { count: unseen.length, title: unseen[0].title };
}

export function latestEntryId(entries: WhatsNewEntry[] = WHATS_NEW): string | null {
  return entries.length > 0 ? entries[0].id : null;
}

/** 읽음 처리 — 기록을 목록 최신 id로, seenAt을 지금으로. 목록이 비면 쓰지 않는다 */
export function markWhatsNewSeen(entries: WhatsNewEntry[] = WHATS_NEW): void {
  const id = latestEntryId(entries);
  if (id) markNoticeSeen(id, Date.now() + SEEN_TTL_MS);
}

/** 첫 실행 조용한 기록 조건: 불러오기 완료 + 자산 없음 + 기록 없음 + 목록 있음 + 체험·잠금 아님 */
export function shouldSilentFirstRun({
  isDataLoaded,
  hasAssets,
  hasRecord,
  eligible,
  hasEntries,
}: {
  isDataLoaded: boolean;
  hasAssets: boolean;
  hasRecord: boolean;
  eligible: boolean; // 체험·앱 잠금 아님
  hasEntries: boolean;
}): boolean {
  return isDataLoaded && !hasAssets && !hasRecord && eligible && hasEntries;
}

/** 열기 직전 안 본 항목 id 집합(위에서 5개까지 '새' 표시) — 읽음 기록 전에 호출 */
export function newBadgeIds(entries: WhatsNewEntry[] = WHATS_NEW, record: NoticeSeenRecord | null = readSeen(), today: string = todayKst()): Set<string> {
  return new Set(unseenEntries(entries, record, today).slice(0, WHATS_NEW_NEW_MAX).map((e) => e.id));
}
