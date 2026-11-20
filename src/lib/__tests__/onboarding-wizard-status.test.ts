import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readOnboardingWizardStatus,
  markCategoryStatus,
  markWizardDismissed,
  getResumeCategory,
  WIZARD_CATEGORIES,
} from "../onboarding-wizard-status";
import { STORAGE_KEYS } from "../local-storage";

describe("onboarding-wizard-status", () => {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).localStorage = shim;
  });

  it("초기 상태는 4개 카테고리 전부 pending, dismissed=false", () => {
    const status = readOnboardingWizardStatus();
    for (const c of WIZARD_CATEGORIES) expect(status.categories[c]).toBe("pending");
    expect(status.dismissed).toBe(false);
  });

  it("AC6: 재개 지점은 pending인 첫 카테고리 — 순서(주식→코인→현금→대출) 보장", () => {
    markCategoryStatus("stock", "done");
    markCategoryStatus("crypto", "skipped");
    const status = readOnboardingWizardStatus();
    expect(getResumeCategory(status)).toBe("cash");
  });

  it("모든 카테고리가 처리되면 재개 지점은 null(완료/전체 건너뛰기 화면으로)", () => {
    for (const c of WIZARD_CATEGORIES) markCategoryStatus(c, "done");
    expect(getResumeCategory(readOnboardingWizardStatus())).toBeNull();
  });

  it("markWizardDismissed는 dismissed 플래그만 세우고 카테고리 상태는 보존한다", () => {
    markCategoryStatus("stock", "done");
    const status = markWizardDismissed();
    expect(status.dismissed).toBe(true);
    expect(status.categories.stock).toBe("done");
  });

  it("secretasset_ 접두 STORAGE_KEYS를 쓴다(tutorialStatus와 별도 키)", () => {
    markCategoryStatus("stock", "done");
    expect(store.has(STORAGE_KEYS.onboardingWizardStatus)).toBe(true);
    expect(STORAGE_KEYS.onboardingWizardStatus).not.toBe(STORAGE_KEYS.tutorialStatus);
  });
});

import { createStepCompleter } from "../onboarding-wizard-status";

describe("createStepCompleter (#99 doneRef 가드)", () => {
  it("스크린샷 저장 1회(onSaved + 건수 증가 동시) → 완료 1회만", () => {
    const done = vi.fn();
    const c = createStepCompleter(0, done);
    c.saved();
    c.observe(3);
    c.observe(3);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("건수 증가가 먼저 와도 뒤의 onSaved는 무시", () => {
    const done = vi.fn();
    const c = createStepCompleter(2, done);
    c.observe(3);
    c.saved();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("재개 시 이미 1건 이상이면 저장 전 자동 진행 0, 취소(변화 없음)면 머문다", () => {
    const done = vi.fn();
    const c = createStepCompleter(2, done);
    c.observe(2);
    c.observe(2);
    expect(done).not.toHaveBeenCalled();
  });
});

import { resolveWizardStart, getNextCategory } from "../onboarding-wizard-status";

describe("체험 복귀 시작 단계(#249 AC-16)", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
  });

  it("시작값이 pending이면 그 단계, 없으면 현행 재개(새 기기 = 주식)", () => {
    const s = readOnboardingWizardStatus();
    expect(resolveWizardStart(s, "cash")).toBe("cash");
    expect(resolveWizardStart(s, "crypto")).toBe("crypto");
    expect(resolveWizardStart(s, "loan")).toBe("loan");
    expect(resolveWizardStart(s, "stock")).toBe("stock");
    expect(resolveWizardStart(s, null)).toBe("stock");
    expect(resolveWizardStart(s, undefined)).toBe("stock");
  });
  it("시작값이 이미 처리됨 → 현행 재개 규칙(pending 첫 단계)", () => {
    markCategoryStatus("cash", "skipped");
    expect(resolveWizardStart(readOnboardingWizardStatus(), "cash")).toBe("stock");
    markCategoryStatus("stock", "done");
    expect(resolveWizardStart(readOnboardingWizardStatus(), "cash")).toBe("crypto");
  });
  it("전부 처리 → 인트로", () => {
    for (const c of WIZARD_CATEGORIES) markCategoryStatus(c, "done");
    expect(resolveWizardStart(readOnboardingWizardStatus(), "crypto")).toBe("intro");
  });
  it("현금 단계에서 저장 → 다음은 대출, 앞 단계(주식·암호화폐)는 pending 유지 → 다시 열면 주식", () => {
    markCategoryStatus("cash", "done");
    const s = readOnboardingWizardStatus();
    expect(getNextCategory(s, "cash")).toBe("loan");
    expect(s.categories.stock).toBe("pending");
    expect(s.categories.crypto).toBe("pending");
    markCategoryStatus("loan", "skipped");
    expect(getNextCategory(readOnboardingWizardStatus(), "loan")).toBeNull();
    expect(resolveWizardStart(readOnboardingWizardStatus(), null)).toBe("stock");
  });
  it("저장 형식 무변경 — 키 1개, categories·dismissed 2필드만(시작 단계는 저장하지 않음)", () => {
    markCategoryStatus("cash", "done");
    resolveWizardStart(readOnboardingWizardStatus(), "crypto");
    expect([...store.keys()]).toEqual([STORAGE_KEYS.onboardingWizardStatus]);
    expect(Object.keys(JSON.parse(store.get(STORAGE_KEYS.onboardingWizardStatus)!)).sort()).toEqual(["categories", "dismissed"]);
  });
});
