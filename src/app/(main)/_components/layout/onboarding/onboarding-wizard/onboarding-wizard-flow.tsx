"use client";

// 스크린샷 일괄 온보딩 마법사(S-4.29) — 주식→코인→현금→대출 4단계, 카테고리당 이미지 1장.
// 부동산은 인식 엔진이 없어(parse-screenshot API에 타입 자체 없음) 즉시 수동 입력으로 연결한다.
// 각 단계는 기존 *-screenshot-import.tsx(스크린샷 인식 다이얼로그)를 그대로 재사용한다 —
// 신규 인식 로직 없음, onSaved 콜백으로 단계 완료만 감지한다.

import { useState } from "react";
import { Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME } from "@/config/theme";
import { StockScreenshotImport } from "../../../forms/asset-update/screenshot/stock-screenshot-import";
import { CryptoScreenshotImport } from "../../../forms/asset-update/screenshot/crypto-screenshot-import";
import { CashScreenshotImport } from "../../../forms/asset-update/screenshot/cash-screenshot-import";
import { LoanScreenshotImport } from "../../../forms/asset-update/screenshot/loan-screenshot-import";
import { dispatchAddRealEstate } from "../../navigation/asset-dispatch";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import {
  WIZARD_CATEGORIES,
  readOnboardingWizardStatus,
  markCategoryStatus,
  markWizardDismissed,
  getResumeCategory,
  type WizardCategory,
} from "@/lib/onboarding-wizard-status";
import { Dashboard } from "../../../views/home/dashboard";

const CATEGORY_META: Record<WizardCategory, { label: string; icon: typeof TrendingUp; guide: string }> = {
  stock: { label: "주식", icon: TrendingUp, guide: "증권사 앱의 보유 종목 화면을 캡처해 올려주세요." },
  crypto: { label: "암호화폐", icon: Bitcoin, guide: "거래소 앱의 보유 코인 화면을 캡처해 올려주세요." },
  cash: { label: "현금", icon: Wallet, guide: "은행 앱의 계좌 잔액 화면을 캡처해 올려주세요." },
  loan: { label: "대출", icon: CreditCard, guide: "대출 잔액이 보이는 화면을 캡처해 올려주세요." },
};

type Phase = "intro" | WizardCategory | "complete";

function hasAnyAsset(assetData: ReturnType<typeof useAssetData>["assetData"]): boolean {
  return assetData.realEstate.length > 0 || assetData.stocks.length > 0 || assetData.crypto.length > 0
    || assetData.cash.length > 0 || assetData.loans.length > 0;
}

function WizardHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-end px-4 pt-3">
      <button type="button" onClick={onClose} aria-label="닫기" className="-m-2 p-2 text-muted-foreground hover:text-foreground">
        <X className="size-5" />
      </button>
    </div>
  );
}

function IntroScreen({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <ImageUp className={`size-12 ${ASSET_THEME.important}`} />
      <div>
        <h2 className="text-lg font-bold text-foreground">증권사/은행 앱 스크린샷을 올리면</h2>
        <p className="text-lg font-bold text-foreground">자동으로 정리해드려요</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button variant="brand" size="lg" onClick={onStart}>시작하기</Button>
        <Button variant="secondary" size="lg" onClick={onClose}>나중에 할게요</Button>
      </div>
    </div>
  );
}

function CategoryStep({ category, onDone, onSkip }: { category: WizardCategory; onDone: () => void; onSkip: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  const handleSaved = () => {
    markCategoryStatus(category, "done");
    onDone();
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <Icon className={`size-12 ${ASSET_THEME.important}`} />
      <div>
        <h2 className="text-lg font-bold text-foreground">{meta.label} 스크린샷 업로드</h2>
        <p className="text-sm text-muted-foreground mt-1">{meta.guide}</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button variant="brand" size="lg" className="gap-2" onClick={() => setDialogOpen(true)}>
          <ImageUp className="size-4" /> 스크린샷 업로드
        </Button>
        <Button variant="secondary" size="lg" onClick={() => { markCategoryStatus(category, "skipped"); onSkip(); }}>
          이 카테고리는 없어요
        </Button>
      </div>

      {category === "stock" && <StockScreenshotImport open={dialogOpen} onOpenChange={handleDialogChange} onSaved={handleSaved} />}
      {category === "crypto" && <CryptoScreenshotImport open={dialogOpen} onOpenChange={handleDialogChange} onSaved={handleSaved} />}
      {category === "cash" && <CashScreenshotImport open={dialogOpen} onOpenChange={handleDialogChange} onSaved={handleSaved} />}
      {category === "loan" && <LoanScreenshotImport open={dialogOpen} onOpenChange={handleDialogChange} onSaved={handleSaved} />}
    </div>
  );
}

function CompleteScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="text-center px-2 py-4">
        <h2 className="text-lg font-bold text-foreground">정리됐어요!</h2>
        <p className="text-sm text-muted-foreground mt-1">등록된 자산을 확인해 보세요</p>
      </div>
      <Dashboard />
      <Button variant="brand" size="lg" className="w-full gap-2" onClick={onFinish}>
        확인 완료 <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

export function OnboardingWizardFlow() {
  const { assetData } = useAssetData();
  const close = useOnboardingWizardStore((s) => s.close);
  // 재개(AC6) — 마지막 완료 단계 다음 미완료 카테고리부터 시작. 전부 처리됐으면 시작 화면부터.
  const [phase, setPhase] = useState<Phase>(() => {
    const status = readOnboardingWizardStatus();
    return getResumeCategory(status) ?? "intro";
  });

  const finish = () => {
    markWizardDismissed();
    close();
  };

  const goToNextCategory = (from: WizardCategory) => {
    const status = readOnboardingWizardStatus();
    const idx = WIZARD_CATEGORIES.indexOf(from);
    const next = WIZARD_CATEGORIES.slice(idx + 1).find((c) => status.categories[c] === "pending");
    if (next) { setPhase(next); return; }
    // 4개 카테고리 모두 처리됨. 아무것도 등록 안 됐으면(전부 건너뜀) 가짜 완료 화면 대신 그냥 닫아
    // 기존 WelcomeGuide(자산 0건 화면)로 돌아가게 한다(AC10) — 별도 안내 화면을 새로 만들지 않는다.
    if (hasAnyAsset(assetData)) { setPhase("complete"); return; }
    finish();
  };

  return (
    <div className="min-h-[70vh] flex flex-col">
      <WizardHeader onClose={finish} />
      {phase === "intro" && (
        <IntroScreen
          onStart={() => setPhase(WIZARD_CATEGORIES[0])}
          onClose={finish}
        />
      )}
      {WIZARD_CATEGORIES.includes(phase as WizardCategory) && (
        <CategoryStep
          category={phase as WizardCategory}
          onDone={() => goToNextCategory(phase as WizardCategory)}
          onSkip={() => goToNextCategory(phase as WizardCategory)}
        />
      )}
      {phase === "complete" && <CompleteScreen onFinish={finish} />}
      {/* 부동산은 인식 엔진이 없어 항상 수동 입력으로 연결(AC4) — 시작 화면·카테고리 단계 어디서든 접근 가능 */}
      {phase !== "complete" && (
        <div className="text-center pb-6">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => dispatchAddRealEstate()}
          >
            <Building2 className="size-4" /> 부동산은 직접 입력할게요
          </button>
        </div>
      )}
    </div>
  );
}
