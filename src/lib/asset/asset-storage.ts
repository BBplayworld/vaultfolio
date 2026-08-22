"use client";

import { z } from "zod";
import { AssetData, assetDataSchema, AssetSnapshots, DailyArchive, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { readDailyArchive, writeDailyArchive, mergeDailyArchives } from "@/lib/asset/snapshot-archive";
import { markBackedUp } from "@/lib/asset/backup-status";
import { transactionSchema } from "@/types/transaction";
import LZString from "lz-string";
import { STORAGE_KEYS, STORAGE_KEY_PREFIXES } from "@/lib/local-storage";
import { getProfitBasis, setProfitBasis, type ProfitBasis } from "@/lib/finance/profit-utils";
import { persistNickname } from "@/hooks/use-nickname";
import { cryptoExchanges } from "@/config/asset-options";

// 구버전 스크린샷 임포트가 저장한 영문 거래소 값("upbit") → 한글 라벨("업비트") 매핑
// (수동 입력·신규 임포트는 한글 라벨을 저장하므로, 옛 영문 값만 정규화하여 통일)
const CRYPTO_EXCHANGE_VALUE_TO_LABEL: Record<string, string> = Object.fromEntries(
  cryptoExchanges.map((ex) => [ex.value, ex.label])
);
export { STORAGE_KEYS, migrateStorageKeys } from "@/lib/local-storage";
export const DEFAULT_EXCHANGE_RATE = 1380;

// 읽기 전용 완화 스키마 — superRefine 없이 ticker 빈 값 허용 (스크린샷 가져오기 경로 대응)
const stockSchemaLoose = z.object({
  id: z.string(),
  category: z.enum(["domestic", "foreign", "irp", "isa", "pension", "unlisted"]),
  name: z.string(),
  ticker: z.string().optional().default(""),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
  currency: z.enum(["KRW", "USD", "JPY"]).default("KRW"),
  purchaseDate: z.string(),
  description: z.string().optional().default(""),
  baseDate: z.string().optional(),
  purchaseExchangeRate: z.number().optional(),
  broker: z.string().optional(),
  inactiveStatus: z.enum(["delisted", "halted"]).optional(),
  inactiveReason: z.string().optional(),
  inactiveCheckedAt: z.string().optional(),
  positionSource: z.enum(["manual", "computed"]).optional(),
  positionEffectiveDate: z.string().optional(),
});

const assetDataSchemaLoose = assetDataSchema.omit({ stocks: true }).extend({
  stocks: z.array(stockSchemaLoose).default([]),
  transactions: z.array(transactionSchema).default([]),
});

// ─── 기본 자산 데이터 ───────────────────────────────────────────────────────
const EMPTY_ASSET_DATA: AssetData = {
  realEstate: [],
  stocks: [],
  crypto: [],
  cash: [],
  loans: [],
  yearlyNetAssets: [],
  transactions: [],
  cashTransactions: [],
  loanTransactions: [],
  cryptoTransactions: [],
  lastUpdated: "",
  nickname: "",
};

export function getAssetData(): AssetData {
  if (typeof window === "undefined") return EMPTY_ASSET_DATA;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.assetData);
    let parsed: any;
    if (!data) {
      parsed = { ...EMPTY_ASSET_DATA };
    } else {
      parsed = JSON.parse(data);
    }

    // 하위 호환 마이그레이션: 기존 secretasset_nickname 단독 키가 존재하고, parsed.nickname이 없거나 비어있는 경우
    const legacyNickname = localStorage.getItem(STORAGE_KEYS.nickname);
    if (legacyNickname && !parsed.nickname) {
      parsed.nickname = legacyNickname;
      try {
        localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(parsed));
        localStorage.removeItem(STORAGE_KEYS.nickname);
      } catch { /* ignore */ }
    }

    // 하위 호환 마이그레이션: 구버전 스크린샷 임포트가 저장한 영문 거래소 값 → 한글 라벨 정규화
    if (Array.isArray(parsed.crypto)) {
      let changed = false;
      for (const c of parsed.crypto) {
        if (c && typeof c.exchange === "string" && c.exchange) {
          const label = CRYPTO_EXCHANGE_VALUE_TO_LABEL[c.exchange];
          if (label && label !== c.exchange) {
            c.exchange = label;
            changed = true;
          }
        }
      }
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(parsed));
        } catch { /* ignore */ }
      }
    }

    return assetDataSchemaLoose.parse(parsed) as AssetData;
  } catch (error) {
    console.error("Failed to load asset data:", error);
    return EMPTY_ASSET_DATA;
  }
}

export function saveAssetData(data: AssetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const validated = assetDataSchemaLoose.parse(data);
    validated.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error("Failed to save asset data:", error);
    return false;
  }
}

// 스냅샷 수집 정본 — 내보내기·동기화·공유가 모두 이 함수를 쓴다(수집 로직 중복 금지).
// 공유 토큰(packV7)은 daily/monthly의 netAsset·financialAsset만 축약 인코딩하므로
// dailyArchive·v2 enrich는 자동으로 빠진다(URL 길이 제약, 의도된 동작).
export function collectSnapshotsFromStorage(): AssetSnapshots {
  try {
    const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
    const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
    const archive = readDailyArchive();
    return {
      daily: rawDaily ? JSON.parse(rawDaily) : [],
      monthly: rawMonthly ? JSON.parse(rawMonthly) : [],
      ...(Object.keys(archive).length > 0 ? { dailyArchive: archive } : {}),
    };
  } catch {
    return { daily: [], monthly: [] };
  }
}

// 내보내기·클라우드 동기화 공용 페이로드 빌더 (assetData + 스냅샷 + 옵션 + 닉네임)
export function buildExportPayload(): Record<string, unknown> {
  const assetData = getAssetData();
  const snapshots = collectSnapshotsFromStorage();
  const hasSnapshots = snapshots.daily.length > 0 || snapshots.monthly.length > 0;
  const profitBasis = getProfitBasis();
  const nickname = assetData.nickname || undefined;
  return { assetData, ...(hasSnapshots ? { snapshots } : {}), profitBasis, ...(nickname ? { nickname } : {}) };
}

// 화면(React state)과 저장소(localStorage)가 갈라진 순간의 항목 건수 지문.
// 시세·baseDate·lastUpdated 같은 파생 필드는 정상적으로도 어긋나므로 **건수만** 본다(오탐 방지).
const itemCountFingerprint = (d: AssetData): string => [
  d.realEstate, d.stocks, d.crypto, d.cash, d.loans,
  d.transactions, d.cashTransactions, d.loanTransactions, d.cryptoTransactions,
].map((arr) => arr?.length ?? 0).join(",");

// 백업은 localStorage(getAssetData)를 뜨지만 화면은 React state를 렌더한다 — 둘은 CRUD마다
// setAssetData+saveAssetData 쌍으로 수동 정합되고, 같은 탭 pull은 storage 이벤트를 발화시키지
// 않아 잠시 갈라질 수 있다. 그 순간 백업을 뜨면 최신 기록이 빠진 파일이 만들어지고, 나중에 그
// 파일로 복원하면 그대로 유실된다(2026-08-06 실사례: 08-05 매수 2건이 빠진 백업).
export function isExportDataStale(currentData: AssetData): boolean {
  return itemCountFingerprint(currentData) !== itemCountFingerprint(getAssetData());
}

// currentData(화면 state)를 넘기면 저장소와 어긋날 때 내보내기를 **중단**하고 false를 반환한다.
// 넘기지 않으면 검사 없이 기존 동작 그대로.
export function exportAssetData(currentData?: AssetData): boolean {
  if (currentData && isExportDataStale(currentData)) return false;
  const payload = buildExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `secretasset-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  // 백업 시각 기록 — 호출처가 늘어도 자동 반영되도록 함수 내부에서 처리.
  // 한계: click() 이후 사용자가 다운로드를 취소해도 감지할 수 없어 "백업함"으로 남는다.
  markBackedUp();
  return true;
}

// 동기화 병합 기준점의 항목 키 — `yearlyNetAssets`만 id가 없어 year를 키로 쓴다.
// collectAssetIds와 mergeById가 **같은 규칙**을 써야 판별이 성립하므로 여기 단일 출처로 둔다.
const yearKey = (year: number) => `year:${year}`;

// 병합 기준점용 전체 항목 키 수집 — push/pull 성공 시 "지금 서버와 맞춰진 항목"으로 기록된다.
export function collectAssetIds(data: AssetData): string[] {
  return [
    ...data.realEstate.map((i) => i.id),
    ...data.stocks.map((i) => i.id),
    ...data.crypto.map((i) => i.id),
    ...data.cash.map((i) => i.id),
    ...data.loans.map((i) => i.id),
    ...data.transactions.map((i) => i.id),
    ...data.cashTransactions.map((i) => i.id),
    ...data.loanTransactions.map((i) => i.id),
    ...data.cryptoTransactions.map((i) => i.id),
    ...data.yearlyNetAssets.map((y) => yearKey(y.year)),
  ];
}

// before(로컬)에만 있는 항목 중 **기준점에 없는 것만** 되살린다.
//  - syncedIds에 없음 = 아직 서버에 올라간 적 없는 신규 추가 → 보존
//  - syncedIds에 있음 = 예전엔 서버에도 있었는데 지금 원격에 없음 = 원격에서 삭제됨 → 존중(제외)
// 기준점 없이 "로컬에 있고 원격에 없으면 무조건 되살림"으로 하면 다른 기기의 삭제가 되살아나
// 다기기 환경에서 삭제가 무력화된다(2026-08 P0).
function mergeById<T extends { id: string }>(before: T[], after: T[], syncedIds: Set<string>): { arr: T[]; changed: boolean } {
  if (before.length === 0) return { arr: after, changed: false };
  const afterIds = new Set(after.map((item) => item.id));
  const missing = before.filter((item) => !afterIds.has(item.id) && !syncedIds.has(item.id));
  return missing.length > 0 ? { arr: [...after, ...missing], changed: true } : { arr: after, changed: false };
}

// 클라우드 pull 직전 로컬(before)에만 있던 **신규** 항목을 원격 데이터(after)에 되살린다.
// 다른 기기가 거의 동시에 push해 내가 막 추가한 자산이 pull로 통째로 덮여 사라지는 것을
// 막는 마지막 방어선(추가 전용 — 같은 항목을 양쪽이 다르게 수정한 충돌은 원격 우선, 범위 밖).
// changed=true면 되살린 항목이 있다는 뜻 — 호출측이 즉시 재-push해 서버에도 반영해야 한다.
export function reconcileAdditiveMerge(before: AssetData, after: AssetData, syncedIds: Set<string>): { data: AssetData; changed: boolean } {
  const realEstate = mergeById(before.realEstate, after.realEstate, syncedIds);
  const stocks = mergeById(before.stocks, after.stocks, syncedIds);
  const crypto = mergeById(before.crypto, after.crypto, syncedIds);
  const cash = mergeById(before.cash, after.cash, syncedIds);
  const loans = mergeById(before.loans, after.loans, syncedIds);
  const transactions = mergeById(before.transactions, after.transactions, syncedIds);
  const cashTransactions = mergeById(before.cashTransactions, after.cashTransactions, syncedIds);
  const loanTransactions = mergeById(before.loanTransactions, after.loanTransactions, syncedIds);
  const cryptoTransactions = mergeById(before.cryptoTransactions, after.cryptoTransactions, syncedIds);

  // yearlyNetAssets는 id가 아니라 year 기준 (기준점 판별도 동일하게 yearKey로)
  let yearlyNetAssets = after.yearlyNetAssets;
  let yearlyChanged = false;
  if (before.yearlyNetAssets.length > 0) {
    const afterYears = new Set(after.yearlyNetAssets.map((y) => y.year));
    const missingYears = before.yearlyNetAssets.filter((y) => !afterYears.has(y.year) && !syncedIds.has(yearKey(y.year)));
    if (missingYears.length > 0) {
      yearlyNetAssets = [...after.yearlyNetAssets, ...missingYears];
      yearlyChanged = true;
    }
  }

  const changed = realEstate.changed || stocks.changed || crypto.changed || cash.changed || loans.changed
    || transactions.changed || cashTransactions.changed || loanTransactions.changed || cryptoTransactions.changed
    || yearlyChanged;
  if (!changed) return { data: after, changed: false };
  return {
    data: {
      ...after,
      realEstate: realEstate.arr, stocks: stocks.arr, crypto: crypto.arr, cash: cash.arr, loans: loans.arr,
      transactions: transactions.arr, cashTransactions: cashTransactions.arr,
      loanTransactions: loanTransactions.arr, cryptoTransactions: cryptoTransactions.arr,
      yearlyNetAssets,
    },
    changed: true,
  };
}

// 파싱된 페이로드를 검증 후 로컬에 복원 (파일 가져오기·클라우드 동기화 공용)
// 검증 실패 시 throw — 기존 데이터는 보존(clearAssetData 전에 검증 완료)
/**
 * @param keepLocalSnapshots 수신 payload에 스냅샷이 없을 때 **로컬 스냅샷을 보존**할지.
 *  - 클라우드 pull(`true`): 스냅샷 없는 기기가 push했다고 해서 내 순자산 이력을 지우면 안 된다.
 *  - 파일 가져오기(`false`): 남의 백업을 얹으면서 내 이력만 남기면 자산과 이력이 뒤섞인다.
 * @param syncedIds 클라우드 pull 한정 — "마지막으로 서버와 맞춰진 항목 키" 기준점. 넘기면 원격이
 *  로컬을 덮어쓰기 직전, 로컬에만 있던 **신규**(기준점에 없는) 항목을 되살린다. 읽기 시점을
 *  clearAssetData 바로 앞으로 최대한 당겨서(중간에 await 없음) 마운트 pull·409 충돌 복구 중
 *  사용자가 막 추가한 자산이 사라지는 창을 최소화한다. 넘기지 않으면(null/undefined) 종전대로
 *  원격이 로컬을 통째로 대체한다 — 파일 가져오기(남의 백업에 내 항목을 섞으면 안 됨)와
 *  connect(다른 금고를 새로 채택)가 이 경로다.
 * @returns remoteIds 병합 **전** 원격 payload의 항목 키 — 호출측이 기준점 갱신에 쓴다. 병합으로
 *  살려둔 로컬 신규분은 아직 서버에 없으므로 기준점에 넣으면 안 된다(넣으면 다음 pull이 그걸
 *  "삭제됨"으로 오판해 방금 지켜낸 자산을 스스로 지운다).
 */
export function applyImportedPayload(
  parsed: unknown,
  { keepLocalSnapshots = false, syncedIds }: { keepLocalSnapshots?: boolean; syncedIds?: Set<string> | null } = {},
): { assetData: AssetData; snapshotRestored: boolean; mergedAdditions: boolean; remoteIds: string[] } {
  const p = (parsed ?? {}) as Record<string, unknown>;
  // 1단계: 메모리에서 파싱·검증 완료 (실패 시 기존 데이터 유지)
  const rawAsset = (p.assetData ?? p) as unknown;
  let validated = assetDataSchema.parse(rawAsset);
  const remoteIds = collectAssetIds(validated); // 병합 전에 캡처 — 기준점 갱신용
  let mergedAdditions = false;
  if (syncedIds) {
    // clearAssetData 직전(아래)까지 다른 await가 없어, 이 읽기와 실제 덮어쓰기 사이의 창이
    // 최소화된다 — 그 사이 사용자가 저장한 편집만 여전히 놓칠 수 있다(범위 밖, 드문 경합).
    const reconciled = reconcileAdditiveMerge(getAssetData(), validated, syncedIds);
    validated = reconciled.data;
    mergedAdditions = reconciled.changed;
  }

  // 2단계: snapshots도 메모리에서 추출
  let dailySnapshot: unknown[] | null = null;
  let monthlySnapshot: unknown[] | null = null;
  let incomingArchive: DailyArchive | null = null;
  if (p.snapshots) {
    const { daily, monthly, dailyArchive } = p.snapshots as AssetSnapshots;
    if (Array.isArray(daily)) dailySnapshot = daily;
    if (Array.isArray(monthly)) monthlySnapshot = monthly;
    if (dailyArchive && typeof dailyArchive === "object") incomingArchive = dailyArchive;
  }
  // 장기 아카이브는 merge 복원(로컬 ∪ 수신) — 구버전 payload가 아카이브 없이 와도 로컬 유실 방지
  const localArchive = readDailyArchive();
  // 일별·월별도 같은 취지로 로컬분을 미리 읽어둔다(pull 한정). buildExportPayload는 스냅샷이 비면
  // 키 자체를 넣지 않으므로(스냅샷 없는 새 기기가 push한 경우), 아래 clearAssetData가 지운 뒤
  // 복원이 스킵되면 받는 쪽 스냅샷이 통째로 사라진다 — "없으면 유지"가 되도록 폴백을 준비한다.
  const localDaily = keepLocalSnapshots ? localStorage.getItem(STORAGE_KEYS.dailySnapshots) : null;
  const localMonthly = keepLocalSnapshots ? localStorage.getItem(STORAGE_KEYS.monthlySnapshots) : null;

  // 3단계: 모든 검증 통과 → 기존 데이터 전체 삭제 (동기 완료)
  clearAssetData();

  // 4단계: 새 데이터 저장
  saveAssetData(validated);
  // 종가 기준 옵션 복원 (clearAssetData 이후이므로 여기서 기록)
  if (p.profitBasis === "kstAccessDay" || p.profitBasis === "sameBusinessDay") {
    setProfitBasis(p.profitBasis as ProfitBasis);
  }
  // 프로필(닉네임) 복원 — clearAssetData가 secretasset_ 키를 모두 지우므로 이후 기록
  if (typeof p.nickname === "string") {
    persistNickname(p.nickname);
    validated.nickname = p.nickname;
  }
  let snapshotRestored = false;
  try {
    // 수신분이 있으면 교체, 없으면(빈 배열 포함) 로컬분을 되돌려 쓴다.
    // `[]`도 truthy이므로 반드시 length로 판정해야 폴백이 우회되지 않는다.
    if (dailySnapshot?.length) localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(dailySnapshot));
    else if (localDaily) localStorage.setItem(STORAGE_KEYS.dailySnapshots, localDaily);
    if (monthlySnapshot?.length) localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(monthlySnapshot));
    else if (localMonthly) localStorage.setItem(STORAGE_KEYS.monthlySnapshots, localMonthly);
    snapshotRestored = !!(dailySnapshot?.length || monthlySnapshot?.length);
  } catch {
    // 스냅샷 복원 실패는 무시
  }
  // 장기 아카이브 복원 — clearAssetData가 지운 로컬분과 수신분 merge
  const mergedArchive = mergeDailyArchives(localArchive, incomingArchive ?? {});
  if (Object.keys(mergedArchive).length > 0) writeDailyArchive(mergedArchive);

  return { assetData: validated, snapshotRestored, mergedAdditions, remoteIds };
}

export function importAssetData(file: File): Promise<{ assetData: AssetData; snapshotRestored: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        resolve(applyImportedPayload(parsed));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// 스크린샷 가져오기 전용: stockSchema superRefine(ticker 필수) 우회 저장
export function saveAssetDataRaw(data: AssetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearAssetData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // 동기화/초기화 시 보존해야 하는 중요 기기 메타데이터 키 목록
    const keepKeys: string[] = [
      STORAGE_KEYS.tutorialStatus,
      STORAGE_KEYS.syncState,
      STORAGE_KEYS.geminiUsage,
      STORAGE_KEYS.collapsibleUsed,
      STORAGE_KEYS.financeApiErrorCount,
      // 백업 메타(마지막 백업 시각·넛지 노출일)는 기기 메타데이터 — 가져오기(applyImportedPayload)가 이 함수를
      // 거치므로 보존하지 않으면 백업 파일을 복원할 때마다 "백업한 적 없음"으로 잘못 판정된다.
      // ("모든 데이터 삭제"는 사용자의 명시적 의도이므로 호출처에서 별도로 지운다)
      STORAGE_KEYS.backup,
      // 세금 안내 배너 닫기 상태도 기기 로컬 메타 — 보존하지 않으면 복원·동기화 pull 때마다 닫은 배너가 되살아난다
      STORAGE_KEYS.taxNotice,
      // 자산 최신화 상태(카테고리별 마지막 갱신일)도 기기 로컬 메타 — backup과 동일 근거로 보존하지
      // 않으면 백업 복원·동기화 pull 때마다 "최신화한 적 없음"으로 되돌아가 넛지가 부당하게 재노출된다
      STORAGE_KEYS.assetRefresh,
    ];

    const keysToRemove = Object.keys(localStorage).filter((k) => {
      if (!k.startsWith("secretasset_")) return false;
      if (keepKeys.includes(k)) return false;
      // 공지 열람 단일 키 보존 (secretasset_notice_seen — 가져오기 후 공지 재노출 방지)
      if (k.startsWith("secretasset_notice_seen")) return false;
      // 앱잠금 비밀번호 해시/활성화 키 보존 (동기화 pull이 잠금 인증을 지우지 않도록)
      if (k.startsWith("secretasset_pwa_auth")) return false;
      return true;
    });

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    return false;
  }
}

// 캐시 프리픽스 일괄 삭제 (사용자 데이터는 보존)
// 신규 캐시 종류 추가 시 STORAGE_KEY_PREFIXES에 등록하고 여기에 분기 추가
export function clearUserCaches(): number {
  if (typeof window === "undefined") return 0;
  let count = 0;
  // profit 관련 prefix 키 일괄 제거
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_KEY_PREFIXES.profit)) {
      localStorage.removeItem(key);
      count++;
    }
  }
  // 환율 관련 캐시 전체 제거
  const exchangeKeys: string[] = [
    STORAGE_KEYS.exchangeRate,
    STORAGE_KEYS.exchangeSyncDate,
    STORAGE_KEYS.exchangeHistory,
  ];
  for (const key of exchangeKeys) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      count++;
    }
  }
  return count;
}

// ─── 공유 토큰 시스템 V7.1 (PIN Support) ──────────────────────────────────

const PIVOT_DATE = Date.UTC(2020, 0, 1); // 2020-01-01 UTC 기준

/**
 * [V7.1 수정 사항]
 * 1. 4자리 PIN 인증 지원: PIN 입력 시 데이터를 XOR 암호화하여 보호
 * 2. PIN 검증 기능: 복호화 후 "OK|" 접두사를 확인하여 비밀번호 일치 여부 판단
 */

const DICT = {
  // officetel·villa는 끝에 가법 추가 — 기존 인덱스(0~4) 불변으로 구 토큰 파싱 호환 (R3)
  re: ["apartment", "house", "land", "commercial", "other", "officetel", "villa"],
  st: ["domestic", "foreign", "irp", "isa", "pension", "unlisted"],
  lo: ["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"],
  ca: ["bank", "cash", "deposit", "savings", "cma"],
  cu: ["KRW", "USD", "JPY"],
  ins: [
    // 1금융권 (시중은행) - financialInstitutions
    "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행", "KDB산업은행", "SC제일은행", "한국씨티은행",
    // 인터넷전문은행
    "카카오뱅크", "토스뱅크", "케이뱅크",
    // 지방은행
    "부산은행", "경남은행", "대구은행", "광주은행", "전북은행", "제주은행", "iM뱅크",
    // 2금융권
    "새마을금고", "신협", "수협", "우체국", "저축은행", "삼성생명", "한화생명", "교보생명",
    // 기타
    "기타",
    // 대형 증권사 - securitiesFirms
    "미래에셋증권", "삼성증권", "한국투자증권", "NH투자증권", "KB증권", "메리츠증권", "신한투자증권", "하나증권", "대신증권", "교보증권",
    // 온라인/기타 증권사
    "키움증권", "유안타증권", "이베스트투자증권", "카카오페이증권", "토스증권",
    // 암호화폐 거래소
    "Upbit", "Bithumb", "Binance", "Coinone", "Korbit", "Bybit", "OKX", "Coinbase", "Kraken", "MEXC", "Gate.io", "Bitget", "KuCoin"
  ]
} as const;

// lz-string URI safe alphabet: 64+1 characters
const URI_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";

const cryptWithPin = (str: string, pin: string, decrypt = false) => {
  if (!pin || pin.length !== 4) return str;
  const pinNumbers = pin.split("").map(Number);
  const len = URI_ALPHABET.length;
  return str.split("").map((c, i) => {
    const idx = URI_ALPHABET.indexOf(c);
    if (idx === -1) return c; // Alphabet 외의 문자는 그대로 유지
    const shift = pinNumbers[i % pinNumbers.length];
    const newIdx = decrypt
      ? (idx - shift + len) % len
      : (idx + shift) % len;
    return URI_ALPHABET[newIdx];
  }).join("");
};

// Zero-Knowledge용 가변 길이 문자열 암호화 (PIN + LocalKey)
const cryptWithKey = (str: string, key: string, decrypt = false) => {
  if (!key) return str;
  const len = URI_ALPHABET.length;
  return str.split("").map((c, i) => {
    const idx = URI_ALPHABET.indexOf(c);
    if (idx === -1) return c;
    const shift = key.charCodeAt(i % key.length);
    const newIdx = decrypt
      ? (idx - shift + len * 256) % len
      : (idx + shift) % len;
    return URI_ALPHABET[newIdx];
  }).join("");
};

// 숫자 패턴 압축 (V7.1 개량형: 소수점 정밀도 유지 및 0 처리)
const pNum = (n: any) => {
  if (typeof n !== "number") return "";
  if (n === 0) return "0";

  if (Number.isInteger(n)) {
    if (n % 1000000 === 0) return (n / 1000000).toString(36) + "M";
    if (n % 1000 === 0) return (n / 1000).toString(36) + "K";
    return n.toString(36);
  }

  // 소수점 압축 (최대 12자리 보존)
  const floatStr = n.toFixed(12).replace(/\.?0+$/, "");
  const dotIdx = floatStr.indexOf(".");
  if (dotIdx > -1) {
    const decimals = floatStr.length - dotIdx - 1;
    const scaled = Math.round(n * Math.pow(10, decimals));
    // decimals(Base36 0-c) + scaled(Base36)
    return "_" + decimals.toString(36) + scaled.toString(36);
  }
  return n.toString(36);
};

const uNum = (v: any) => {
  if (!v) return 0;
  if (v === "0") return 0;
  if (typeof v === "string") {
    if (v.startsWith("_")) {
      const decimals = parseInt(v[1], 36);
      const scaled = parseInt(v.substring(2), 36);
      if (isNaN(decimals) || isNaN(scaled)) return 0;
      return scaled / Math.pow(10, decimals);
    }
    if (v.startsWith("F")) return parseFloat(v.substring(1)); // V6 하위 호환용
    if (v.endsWith("M")) return parseInt(v.slice(0, -1), 36) * 1000000;
    if (v.endsWith("K")) return parseInt(v.slice(0, -1), 36) * 1000;
    const p = parseInt(v, 36);
    return isNaN(p) ? 0 : p;
  }
  return typeof v === "number" ? v : 0;
};

// 날짜 패턴 압축 (경과일수)
const pDate = (d?: string) => {
  if (!d) return "";
  const [y, m, day] = d.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, day);
  const days = Math.round((utcMs - PIVOT_DATE) / 86400000);
  return days.toString(36);
};

const uDate = (v?: string) => {
  if (!v) return "";
  const ms = PIVOT_DATE + parseInt(v, 36) * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 월 패턴 압축 ("YYYY-MM" ↔ 2020-01 기준 경과 월수 base36)
const pMonth = (m: string) => {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  return ((y - 2020) * 12 + (mo - 1)).toString(36);
};
const uMonth = (v: string) => {
  if (!v) return "";
  const total = parseInt(v, 36);
  const year = 2020 + Math.floor(total / 12);
  const month = String((total % 12) + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// 스냅샷 직렬화: daily섹션;monthly섹션 (packV7의 ^ 구분자와 충돌 방지)
const packSnapshots = (s: AssetSnapshots): string => {
  const daily = s.daily
    .map(d => `${pDate(d.date)}|${pNum(d.netAsset)}|${pNum(d.financialAsset)}`)
    .join("~");
  const monthly = s.monthly
    .map(m => `${pMonth(m.month)}|${pNum(m.netAsset)}|${pNum(m.financialAsset)}`)
    .join("~");
  return `${daily};${monthly}`;
};

const unpackSnapshots = (raw: string): AssetSnapshots => {
  // 구 버전 호환: ^ 구분자로 저장된 토큰도 처리
  const sep = raw.includes(";") ? ";" : "^";
  const [dailyRaw, monthlyRaw] = raw.split(sep);
  const daily: DailyAssetSnapshot[] = (dailyRaw ? dailyRaw.split("~") : [])
    .filter(Boolean)
    .map(r => { const f = r.split("|"); return { date: uDate(f[0]), netAsset: uNum(f[1]), financialAsset: uNum(f[2]) }; });
  const monthly: MonthlyAssetSnapshot[] = (monthlyRaw ? monthlyRaw.split("~") : [])
    .filter(Boolean)
    .map(r => { const f = r.split("|"); return { month: uMonth(f[0]), netAsset: uNum(f[1]), financialAsset: uNum(f[2]) }; });
  return { daily, monthly };
};

// 텍스트 정제
const sTxt = (s?: string) => {
  if (!s) return "";
  const clean = s.replace(/\|/g, " ").replace(/~/g, " ").replace(/\^/g, " ");
  const idx = DICT.ins.findIndex(v => clean.includes(v));
  return idx > -1 ? `#${idx}` : clean;
};
const uTxt = (s?: any) => {
  if (typeof s === "string" && s.startsWith("#")) return DICT.ins[parseInt(s.substring(1))] || s;
  return s || "";
};

function packV7(data: AssetData, rates?: { USD: number; JPY: number }, snapshots?: AssetSnapshots, profitBasis?: ProfitBasis, nickname?: string): string {
  const row = (arr: any[]) => {
    while (arr.length > 0 && (arr[arr.length - 1] === "" || arr[arr.length - 1] === 0 || arr[arr.length - 1] === undefined || arr[arr.length - 1] === null)) arr.pop();
    return arr.join("|");
  };
  const section = (items: any[]) => items.map(i => row(i)).join("~");

  const parts = [
    // f[8]~f[13]: 실거래가 연동 검색 키 (S-4.21) — 섹션 끝에 덧붙여 구버전 토큰과 하위호환.
    // marketEstimate*는 파생값이라 미포함(이관 후 접속 시 자동 갱신이 다시 채운다).
    section(data.realEstate.map(i => [DICT.re.indexOf(i.type), sTxt(i.name), sTxt(i.address), pNum(i.purchasePrice), pNum(i.currentValue), pDate(i.purchaseDate), pNum(i.tenantDeposit), sTxt(i.description), sTxt(i.regionCode), sTxt(i.legalDong), sTxt(i.complexName), sTxt(i.addressDetail ?? [i.dongName, i.hoName].filter(Boolean).join(" ")), pNum(i.exclusiveArea), i.areaUnitPreference === "pyeong" ? "p" : ""])),
    section(data.stocks.map(i => [DICT.st.indexOf(i.category), sTxt(i.name), i.name === i.ticker ? "*" : sTxt(i.ticker), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), DICT.cu.indexOf(i.currency || "KRW"), pDate(i.purchaseDate), sTxt(i.description), pNum(i.purchaseExchangeRate ?? 0), sTxt(i.broker), i.inactiveStatus === "delisted" ? "d" : i.inactiveStatus === "halted" ? "h" : ""])),
    section(data.crypto.map(i => [sTxt(i.name), i.name === i.symbol ? "*" : sTxt(i.symbol), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), pDate(i.purchaseDate), sTxt(i.exchange), sTxt(i.description)])),
    section(data.cash?.map(i => [DICT.ca.indexOf(i.type), sTxt(i.name), pNum(i.balance), DICT.cu.indexOf(i.currency || "KRW"), sTxt(i.institution), sTxt(i.description)]) || []),
    section(data.loans?.map(i => {
      const reIdx = i.linkedRealEstateId ? data.realEstate.findIndex(r => r.id === i.linkedRealEstateId) : -1;
      const stIdx = i.linkedStockId ? data.stocks.findIndex(s => s.id === i.linkedStockId) : -1;
      const caIdx = i.linkedCashId ? data.cash?.findIndex(c => c.id === i.linkedCashId) ?? -1 : -1;
      return [DICT.lo.indexOf(i.type as any), sTxt(i.name), pNum(i.balance), Math.round((i.interestRate || 0) * 1000), pDate(i.startDate), pDate(i.endDate), sTxt(i.institution), sTxt(i.description), reIdx >= 0 ? `r${reIdx}` : "", caIdx >= 0 ? `c${caIdx}` : "", stIdx >= 0 ? `s${stIdx}` : ""];
    }) || []),
    section(data.yearlyNetAssets.map(i => [i.year, pNum(i.netAsset), sTxt(i.note)])),
    pDate(data.lastUpdated.split('T')[0]),
    rates ? `${pNum(rates.USD)}|${pNum(rates.JPY)}` : "",
    snapshots ? packSnapshots(snapshots) : "",
    // parts[9]: 종가 기준 옵션 ("k"=kstAccessDay, 그 외/빈값=기본 sameBusinessDay)
    profitBasis === "kstAccessDay" ? "k" : "",
    // parts[10]: 거래 내역
    section(data.transactions?.map(t => {
      const stIdx = data.stocks.findIndex(s => s.id === t.stockId);
      return [
        t.type === "buy" ? "b" : "s",
        sTxt(t.stockName),
        sTxt(t.ticker),
        pNum(t.quantity),
        pNum(t.price),
        DICT.cu.indexOf(t.currency || "KRW"),
        pDate(t.date),
        pNum(t.exchangeRate ?? 0),
        pNum(t.fee ?? 0),
        t.reflected ? "1" : "0",
        sTxt(t.memo),
        stIdx >= 0 ? stIdx.toString() : t.stockId,
      ];
    }) || []),
    // parts[11]: 프로필 닉네임
    sTxt(nickname || ""),
    // parts[12]: 현금 입출금 내역 (S-4.22) — 꼬리 추가라 구버전 토큰과 하위호환. caIdx로 부모 계좌 참조.
    section(data.cashTransactions?.map(t => {
      const caIdx = data.cash?.findIndex(c => c.id === t.cashId) ?? -1;
      return [
        t.type === "deposit" ? "d" : "w",
        pNum(t.amount),
        DICT.cu.indexOf(t.currency || "KRW"),
        pDate(t.date),
        t.recurring ? "1" : "0",
        t.reflected ? "1" : "0",
        sTxt(t.memo),
        caIdx >= 0 ? caIdx.toString() : t.cashId,
      ];
    }) || []),
    // parts[13]: 대출 상환/추가대출 내역 (S-4.24) — 꼬리 추가라 구버전 토큰과 하위호환. loanIdx로 부모 대출 참조.
    // 통화 필드 없음(대출은 항상 KRW) — cashTransactions보다 필드 1개 적다.
    section(data.loanTransactions?.map(t => {
      const loanIdx = data.loans?.findIndex(l => l.id === t.loanId) ?? -1;
      return [
        t.type === "repay" ? "p" : "b",
        pNum(t.amount),
        pDate(t.date),
        t.reflected ? "1" : "0",
        sTxt(t.memo),
        loanIdx >= 0 ? loanIdx.toString() : t.loanId,
      ];
    }) || []),
    // parts[14]: 암호화폐 매수/매도 내역 (S-4.25) — 꼬리 추가라 구버전 토큰과 하위호환. crIdx로 부모 코인 참조.
    // 통화 필드 없음(코인은 항상 KRW) — transactions(주식)보다 필드 3개 적다(currency·exchangeRate·fee 없음).
    section(data.cryptoTransactions?.map(t => {
      const crIdx = data.crypto.findIndex(c => c.id === t.cryptoId);
      return [
        t.type === "buy" ? "b" : "s",
        pNum(t.quantity),
        pNum(t.price),
        pDate(t.date),
        t.reflected ? "1" : "0",
        sTxt(t.memo),
        crIdx >= 0 ? crIdx.toString() : t.cryptoId,
      ];
    }) || []),
  ];

  return parts.join("^");
}

function unpackV7(raw: string): { data: any, rates?: { USD: number, JPY: number }, snapshots?: AssetSnapshots, profitBasis?: ProfitBasis, nickname?: string } {
  const parts = raw.split("^");
  const gid = () => Math.random().toString(36).substring(2, 11);
  const getIdx = (idx: any, list: readonly string[]) => list[parseInt(idx)] || list[0];

  const section = (idx: number) => (parts[idx] ? parts[idx].split("~") : []).filter(r => r !== "");
  const fields = (r: string) => r.split("|");

  // 각 섹션을 먼저 ID 배열과 함께 생성하여 loans에서 인덱스로 역참조
  const reIds: string[] = [];
  const stIds: string[] = [];
  const caIds: string[] = [];
  const loIds: string[] = [];
  const crIds: string[] = [];

  const realEstate = section(0).map(r => {
    const f = fields(r);
    const name = uTxt(f[1]) || "무명";
    const id = gid();
    reIds.push(id);
    // 실거래가 연동 검색 키 — 빈 값이 ""/0으로 저장되면 자동 갱신 판정을 흐리므로 있을 때만 넣는다
    const regionCode = uTxt(f[8]);
    const legalDong = uTxt(f[9]);
    const complexName = uTxt(f[10]);
    const addressDetail = uTxt(f[11]);
    const exclusiveArea = uNum(f[12]);
    return {
      id, type: getIdx(f[0], DICT.re), name, address: uTxt(f[2]), purchasePrice: uNum(f[3]), currentValue: uNum(f[4]),
      purchaseDate: uDate(f[5]), tenantDeposit: uNum(f[6]), description: uTxt(f[7]),
      ...(regionCode ? { regionCode } : {}),
      ...(legalDong ? { legalDong } : {}),
      ...(complexName ? { complexName } : {}),
      ...(addressDetail ? { addressDetail } : {}),
      ...(exclusiveArea > 0 ? { exclusiveArea } : {}),
      ...(f[13] === "p" ? { areaUnitPreference: "pyeong" as const } : {}),
    };
  });
  const stocks = section(1).map(r => {
    const f = fields(r);
    const name = uTxt(f[1]) || "무명";
    const id = gid();
    stIds.push(id);
    const purchaseExchangeRate = uNum(f[9]);
    const broker = uTxt(f[10]);
    const inactiveCode = uTxt(f[11]);
    const inactiveStatus = inactiveCode === "d" ? "delisted" : inactiveCode === "h" ? "halted" : undefined;
    return { id, category: getIdx(f[0], DICT.st), name, ticker: f[2] === "*" ? name : (uTxt(f[2]) || ""), quantity: uNum(f[3]), averagePrice: uNum(f[4]), currentPrice: uNum(f[5]), currency: getIdx(f[6], DICT.cu), purchaseDate: uDate(f[7]), description: uTxt(f[8]), ...(purchaseExchangeRate > 0 ? { purchaseExchangeRate } : {}), ...(broker ? { broker } : {}), ...(inactiveStatus ? { inactiveStatus } : {}) };
  });
  const crypto = section(2).map(r => {
    const f = fields(r);
    const name = uTxt(f[0]) || "무명";
    const id = gid();
    crIds.push(id);
    return { id, name, symbol: f[1] === "*" ? name : (uTxt(f[1]) || "SYMBOL"), quantity: uNum(f[2]), averagePrice: uNum(f[3]), currentPrice: uNum(f[4]), purchaseDate: uDate(f[5]), exchange: uTxt(f[6]), description: uTxt(f[7]) };
  });
  const cash = section(3).map(r => {
    const f = fields(r);
    const id = gid();
    caIds.push(id);
    return { id, type: getIdx(f[0], DICT.ca), name: uTxt(f[1]) || "무명", balance: uNum(f[2]), currency: getIdx(f[3], DICT.cu), institution: uTxt(f[4]), description: uTxt(f[5]) };
  });
  const loans = section(4).map(r => {
    const f = fields(r);
    const reIdx = f[8]?.startsWith("r") ? parseInt(f[8].substring(1)) : -1;
    const caIdx = f[9]?.startsWith("c") ? parseInt(f[9].substring(1)) : -1;
    const stIdx = f[10]?.startsWith("s") ? parseInt(f[10].substring(1)) : -1;
    const id = gid();
    loIds.push(id);
    return {
      id,
      type: getIdx(f[0], DICT.lo),
      name: uTxt(f[1]) || "무명",
      balance: uNum(f[2]),
      interestRate: (parseInt(f[3]) || 0) / 1000,
      startDate: uDate(f[4]),
      endDate: uDate(f[5]),
      institution: uTxt(f[6]),
      description: uTxt(f[7]),
      ...(reIdx >= 0 && reIds[reIdx] ? { linkedRealEstateId: reIds[reIdx] } : {}),
      ...(caIdx >= 0 && caIds[caIdx] ? { linkedCashId: caIds[caIdx] } : {}),
      ...(stIdx >= 0 && stIds[stIdx] ? { linkedStockId: stIds[stIdx] } : {}),
    };
  });

  const transactions = section(10).map(r => {
    const f = fields(r);
    const reflected = f[9] === "1";
    const rawStockId = f[11] || "";
    const isIndex = /^\d+$/.test(rawStockId);
    const stIdx = isIndex ? parseInt(rawStockId, 10) : -1;
    let stockId = (stIdx >= 0 && stIdx < stIds.length) ? stIds[stIdx] : "";

    if (!stockId && rawStockId) {
      // Backward compatibility: match legacy raw stock IDs using ticker or name
      const ticker = uTxt(f[2]) || "";
      const stockName = uTxt(f[1]) || "";
      const matched = stocks.find(s => 
        (ticker && s.ticker === ticker) || 
        (stockName && s.name === stockName)
      );
      stockId = matched ? matched.id : rawStockId;
    }

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: f[0] === "b" ? "buy" as const : "sell" as const,
      stockName: uTxt(f[1]) || "",
      ticker: uTxt(f[2]) || "",
      quantity: uNum(f[3]),
      price: uNum(f[4]),
      currency: getIdx(f[5], DICT.cu),
      date: uDate(f[6]),
      exchangeRate: uNum(f[7]) || undefined,
      fee: uNum(f[8]) || undefined,
      reflected,
      memo: uTxt(f[10]) || undefined,
      stockId,
      createdAt: new Date().toISOString(),
    };
  });

  // 현금 입출금 내역 (S-4.22) — caIdx로 부모 계좌 재연결. 계좌 못 찾으면 제외.
  const cashTransactions = section(12).map(r => {
    const f = fields(r);
    const rawCa = f[7] || "";
    const isIdx = /^\d+$/.test(rawCa);
    const caIdx = isIdx ? parseInt(rawCa, 10) : -1;
    const cashId = (caIdx >= 0 && caIdx < caIds.length) ? caIds[caIdx] : (isIdx ? "" : rawCa);
    return {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cashId,
      type: f[0] === "d" ? "deposit" as const : "withdrawal" as const,
      amount: uNum(f[1]),
      currency: getIdx(f[2], DICT.cu),
      date: uDate(f[3]),
      ...(f[4] === "1" ? { recurring: true } : {}),
      reflected: f[5] === "1",
      memo: uTxt(f[6]) || undefined,
      createdAt: new Date().toISOString(),
    };
  }).filter(t => t.cashId);

  // 대출 상환/추가대출 내역 (S-4.24) — loIdx로 부모 대출 재연결. 대출 못 찾으면 제외.
  const loanTransactions = section(13).map(r => {
    const f = fields(r);
    const rawLo = f[5] || "";
    const isIdx = /^\d+$/.test(rawLo);
    const loIdx = isIdx ? parseInt(rawLo, 10) : -1;
    const loanId = (loIdx >= 0 && loIdx < loIds.length) ? loIds[loIdx] : (isIdx ? "" : rawLo);
    return {
      id: `ltx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      loanId,
      type: f[0] === "p" ? "repay" as const : "borrow" as const,
      amount: uNum(f[1]),
      date: uDate(f[2]),
      reflected: f[3] === "1",
      memo: uTxt(f[4]) || undefined,
      createdAt: new Date().toISOString(),
    };
  }).filter(t => t.loanId);

  // 암호화폐 매수/매도 내역 (S-4.25) — crIdx로 부모 코인 재연결. 코인 못 찾으면 제외.
  const cryptoTransactions = section(14).map(r => {
    const f = fields(r);
    const rawCr = f[6] || "";
    const isIdx = /^\d+$/.test(rawCr);
    const crIdx = isIdx ? parseInt(rawCr, 10) : -1;
    const cryptoId = (crIdx >= 0 && crIdx < crIds.length) ? crIds[crIdx] : (isIdx ? "" : rawCr);
    const coin = crypto.find(c => c.id === cryptoId);
    return {
      id: `crtx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cryptoId,
      symbol: coin?.symbol || "",
      name: coin?.name || "",
      type: f[0] === "b" ? "buy" as const : "sell" as const,
      quantity: uNum(f[1]),
      price: uNum(f[2]),
      date: uDate(f[3]),
      reflected: f[4] === "1",
      memo: uTxt(f[5]) || undefined,
      createdAt: new Date().toISOString(),
    };
  }).filter(t => t.cryptoId);

  const data = {
    realEstate,
    stocks,
    crypto,
    cash,
    loans,
    yearlyNetAssets: section(5).map(r => {
      const f = fields(r);
      return { year: parseInt(f[0]) || new Date().getFullYear(), netAsset: uNum(f[1]), note: uTxt(f[2]) };
    }),
    transactions,
    cashTransactions,
    loanTransactions,
    cryptoTransactions,
    lastUpdated: new Date().toISOString(),
    nickname: parts[11] ? uTxt(parts[11]) || "" : "",
  };

  let rates;
  if (parts[7]) {
    const r = parts[7].split("|");
    rates = { USD: uNum(r[0]), JPY: uNum(r[1]) };
  }

  let snapshots: AssetSnapshots | undefined;
  if (parts[8]) {
    snapshots = unpackSnapshots(parts[8]);
  }

  // parts[9]: 종가 기준 옵션 (없으면 기본 sameBusinessDay)
  const profitBasis: ProfitBasis | undefined = parts[9] === "k" ? "kstAccessDay" : undefined;

  // parts[11]: 프로필 닉네임 (구버전 토큰엔 없음)
  const nickname = parts[11] ? uTxt(parts[11]) || undefined : undefined;

  return { data, rates, snapshots, profitBasis, nickname };
}

export function generateShareToken(data: AssetData, rates?: { USD: number; JPY: number }, pin?: string, localKey?: string, snapshots?: AssetSnapshots, profitBasis?: ProfitBasis, nickname?: string): string {
  try {
    const dsv = "OK|" + packV7(data, rates, snapshots, profitBasis, nickname); // PIN 검증 및 무결성 확인용 접두사
    const compressed = LZString.compressToEncodedURIComponent(dsv);

    if (pin && pin.length === 4) {
      if (localKey) {
        // V7.2 Zero-Knowledge: PIN + localKey 조합으로 초강력 암호화
        const fullKey = pin + localKey;
        return "v72Z" + cryptWithKey(compressed, fullKey);
      }
      // V7.1: 압축된 결과물에 PIN 기반 시프팅 적용
      return "v71P" + cryptWithPin(compressed, pin);
    }
    return "v71N" + compressed;
  } catch (error) {
    return "";
  }
}

export type ParseResult = { data: AssetData, rates?: { USD: number, JPY: number }, snapshots?: AssetSnapshots, profitBasis?: ProfitBasis, nickname?: string } | { pinRequired: true } | null;

export function parseShareToken(token: string, pin?: string, localKey?: string): ParseResult {
  if (!token) return null;
  try {
    // 최신 Zero-Knowledge 버전 (v72Z)
    if (token.startsWith("v72Z")) {
      if (!localKey) return null; // localKey가 없으면 인증키가 누락된 잘못된 접근이므로 즉시 실패
      if (!pin) return { pinRequired: true };

      const fullKey = pin + localKey;
      const compressed = cryptWithKey(token.substring(4), fullKey, true);

      const dsv = LZString.decompressFromEncodedURIComponent(compressed);
      if (!dsv || !dsv.startsWith("OK|")) return null; // PIN/Key 틀림 또는 데이터 손상

      const result = unpackV7(dsv.substring(3));
      if (result.nickname !== undefined && result.data) {
        result.data.nickname = result.nickname;
      }
      return {
        data: assetDataSchema.parse(result.data),
        rates: result.rates,
        snapshots: result.snapshots,
        profitBasis: result.profitBasis,
        nickname: result.nickname,
      };
    }

    // 최신 버전 (v71P, v71N) 처리 (압축 결과에 시프팅 적용)
    if (token.startsWith("v71")) {
      const type = token[3]; // N or P
      let compressed = token.substring(4);

      if (type === "P") {
        if (!pin) return { pinRequired: true };
        compressed = cryptWithPin(compressed, pin, true);
      }

      const dsv = LZString.decompressFromEncodedURIComponent(compressed);
      if (!dsv || !dsv.startsWith("OK|")) return null; // PIN 틀림 또는 데이터 손상

      const result = unpackV7(dsv.substring(3));
      if (result.nickname !== undefined && result.data) {
        result.data.nickname = result.nickname;
      }
      return {
        data: assetDataSchema.parse(result.data),
        rates: result.rates,
        snapshots: result.snapshots,
        profitBasis: result.profitBasis,
        nickname: result.nickname,
      };
    }

    // 하위 호환성 (V7.1:N:, V7.1:P:, V7.0)
    const decompressed = LZString.decompressFromEncodedURIComponent(token);

    if (decompressed && decompressed.startsWith("vlt-fl-v7.1:")) {
      const parts = decompressed.split(":");
      const flag = parts[2];
      let dsv = parts.slice(3).join(":");
      if (flag === "P") {
        if (!pin) return { pinRequired: true };
        const decrypted = xor(dsv, pin);
        if (!decrypted.startsWith("OK|")) return null;
        dsv = decrypted.substring(3);
      }
      const result = unpackV7(dsv);
      if (result.nickname !== undefined && result.data) {
        result.data.nickname = result.nickname;
      }
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
    }

    if (decompressed && decompressed.startsWith("vlt-fl-v7.0:")) {
      const dsv = decompressed.substring("vlt-fl-v7.0:".length);
      const result = unpackV7(dsv);
      if (result.nickname !== undefined && result.data) {
        result.data.nickname = result.nickname;
      }
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
    }

    // V6.x 하위 호환 (Base64 + XOR)
    const fromSafe = (s: string) => s.replace(/\./g, '+').replace(/_/g, '/');
    const SHARED_KEY_V6 = "vlt-fl-v6.2";
    const raw = LZString.decompressFromBase64(fromSafe(token));
    if (raw) {
      const deob = raw.split("").map((char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ SHARED_KEY_V6.charCodeAt(i % SHARED_KEY_V6.length))
      ).join("");
      const result = unpackV7(deob);
      if (result.nickname !== undefined && result.data) {
        result.data.nickname = result.nickname;
      }
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
    }

    return null;
  } catch (error) {
    console.error("Token parsing error:", error);
    return null;
  }
}

const xor = (str: string, key: string) => {
  return str.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join("");
};

