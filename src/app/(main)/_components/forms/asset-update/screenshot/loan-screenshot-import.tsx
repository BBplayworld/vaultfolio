"use client";

import { useState, useRef } from "react";
import { ImageUp, Loader2, AlertTriangle, CheckSquare, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loan, AssetData } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { loanTypes } from "@/config/asset-options";
import { formatCurrency } from "@/lib/number-utils";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { keyOfLoan, countConflicts, resolveKept, type ConflictMode } from "@/lib/asset/holdings-conflict";
import { markCategoryRefreshed } from "@/lib/asset/asset-refresh-status";

type ImportLoan = {
  id: string;
  name: string;
  type: Loan["type"];
  balance: number;
  interestRate: number;
  institution: string;
  startDate: string;
  startDateMissing: boolean;
  description: string;
  selected: boolean;
};

const LOAN_TYPE_OPTIONS = loanTypes.map((t) => ({ value: t.value, label: t.label }));

interface LoanScreenshotImportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 저장 성공 시 등록 건수와 함께 호출(S-4.29 온보딩 마법사가 단계 완료 판단에 사용) — 옵셔널, 기존 호출부는 영향 없음 */
  onSaved?: (count: number) => void;
}

export function LoanScreenshotImport({ open: externalOpen, onOpenChange, onSaved }: LoanScreenshotImportProps = {}) {
  const { saveData, assetData } = useAssetData();
  const geminiUsage = useGeminiUsage();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  const [step, setStep] = useState<"upload" | "conflict" | "preview">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [loans, setLoans] = useState<ImportLoan[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [conflictMode, setConflictMode] = useState<ConflictMode>("merge");
  const [conflictCount, setConflictCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setLoans([]);
    setIsParsing(false);
    setConflictMode("merge");
    setConflictCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const handleFileChange = async (file: File) => {
    if (!geminiUsage.canUse()) {
      toast.error(`오늘의 AI 인식 한도(${geminiUsage.limit}회)를 모두 사용했습니다. 내일 다시 시도해주세요.`);
      return;
    }

    setIsParsing(true);
    setStep("upload");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("assetType", "loan");

    try {
      const res = await fetch("/api/parse-screenshot", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "파싱에 실패했습니다.");
        return;
      }

      if (!data.loans || data.loans.length === 0) {
        toast.error("인식된 대출이 없습니다. 다른 스크린샷을 시도해보세요.");
        return;
      }

      geminiUsage.increment("loan");

      const importLoans: ImportLoan[] = data.loans.map(
        (s: Omit<ImportLoan, "selected">) => ({ ...s, selected: true })
      );

      setLoans(importLoans);
      const conflicts = countConflicts(assetData.loans, importLoans, keyOfLoan);
      if (conflicts > 0) {
        setConflictCount(conflicts);
        setStep("conflict");
      } else {
        setStep("preview");
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  };

  const toggleSelect = (id: string) =>
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l)));

  const toggleAll = () => {
    const allSelected = loans.every((l) => l.selected);
    setLoans((prev) => prev.map((l) => ({ ...l, selected: !allSelected })));
  };

  const updateType = (id: string, type: Loan["type"]) =>
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, type } : l)));

  const handleRegister = () => {
    const selected = loans.filter((l) => l.selected);
    if (selected.length === 0) {
      toast.error("등록할 대출을 선택해주세요.");
      return;
    }

    setIsRegistering(true);

    const registered = selected.map(({ selected: _, startDateMissing: __, ...l }, idx) => ({
      ...l,
      id: `loan_import_${Date.now()}_${idx}`,
    }));
    const importedKeys = new Set(registered.map(keyOfLoan));
    const kept = resolveKept(assetData.loans, importedKeys, conflictMode, keyOfLoan);
    const newLoans: Loan[] = [...kept, ...registered];

    const newData: AssetData = { ...assetData, loans: newLoans };
    const success = saveData(newData);

    setIsRegistering(false);

    if (success) {
      toast.success(`${selected.length}개 대출이 등록되었습니다.`);
      markCategoryRefreshed("loan");
      onSaved?.(selected.length);
      handleClose();
    } else {
      toast.error("등록에 실패했습니다.");
    }
  };

  const selectedCount = loans.filter((l) => l.selected).length;
  const allSelected = loans.length > 0 && loans.every((l) => l.selected);
  const remaining = geminiUsage.remaining();

  const getTypeLabel = (value: string) => LOAN_TYPE_OPTIONS.find((t) => t.value === value)?.label ?? value;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (isParsing) return;
        if (!open) handleClose(); else setIsOpen(true);
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-primary/40 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {isParsing && <div className="absolute inset-0 z-10 rounded-lg cursor-wait" />}

        <DialogHeader>
          <DialogTitle>스크린샷으로 가져오기 — 대출</DialogTitle>
          <DialogDescription>
            <span className="text-foreground">대출 현황 또는 대출 상세 화면을 선택하세요.</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: 업로드 */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 border px-3 py-2 text-sm text-muted-foreground">
              본인 계좌 스크린샷을 본인 앱에 입력하는 행위로, 저작권·약관·개인정보 측면에서 문제없습니다.
            </div>

            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-10 transition-colors ${geminiUsage.canUse() ? "hover:border-primary/60 hover:bg-primary/10 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
              onClick={() => geminiUsage.canUse() && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {isParsing ? (
                <>
                  <Loader2 className="size-10 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">AI가 대출 정보를 인식하는 중...</p>
                </>
              ) : (
                <>
                  <ImageUp className="size-10 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium">클릭하거나 이미지를 드래그하세요</p>
                    <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WEBP, HEIC · 최대 10MB</p>
                  </div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
                e.target.value = "";
              }}
            />

            <div className="flex justify-end">
              <Badge variant={remaining <= 2 ? "destructive" : "secondary"} className="text-xs">
                AI 인식 오늘 {remaining}회 남음
              </Badge>
            </div>

            {!geminiUsage.canUse() && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                오늘의 AI 인식 한도({geminiUsage.limit}회)를 모두 사용했습니다. 내일 다시 시도해주세요.
              </div>
            )}

            <div className="rounded-md bg-amber-500/10px-3 py-2 space-y-1">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="size-3" /> 등록 후 확인이 필요한 항목
              </p>
              <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                <li><span className="text-foreground">대출 종류</span>(신용·담보 등)는 미리보기에서 변경할 수 있습니다.</li>
                <li><span className="text-foreground">대출 실행일</span>이 화면에 없으면 오늘 날짜로 설정됩니다. 등록 후 수정해주세요.</li>
                <li>연계 자산(담보 부동산·주식)은 등록 후 직접 연결해주세요.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: 중복 처리 */}
        {step === "conflict" && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-500/10px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                기존 보유 대출과 <span className="font-semibold">{conflictCount}개</span> 이름·기관·종류가 같습니다.
                동일 대출이 맞는지 미리보기에서 확인 후 처리 방식을 선택해주세요.
              </p>
            </div>

            <div className="space-y-2">
              {(["merge", "reset"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${conflictMode === mode ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  onClick={() => setConflictMode(mode)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${conflictMode === mode ? "border-primary" : "border-muted-foreground"}`}>
                      {conflictMode === mode && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{mode === "merge" ? "덮어쓰기" : "초기화 후 등록"}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {mode === "merge"
                          ? "이름·기관·종류가 같은 대출을 스크린샷 기준으로 교체하고, 나머지 기존 대출은 유지합니다."
                          : "기존 대출을 모두 삭제하고 스크린샷 대출로 대체합니다."}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 미리보기 */}
        {step === "preview" && loans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleAll}
              >
                {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                전체 선택 ({selectedCount}/{loans.length})
              </button>
              <Button variant="ghost" size="sm" className="h-7 text-sm" onClick={reset}>
                <X className="size-3 mr-1" /> 다시 업로드
              </Button>
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {loans.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 transition-colors ${item.selected ? "bg-card border-border" : "bg-muted/30 border-muted opacity-60"}`}
                >
                  <div className="flex items-start gap-3">
                    <button type="button" className="mt-0.5 flex-shrink-0" onClick={() => toggleSelect(item.id)}>
                      {item.selected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/30">
                          {getTypeLabel(item.type)}
                        </Badge>
                        {item.institution && (
                          <span className="text-sm text-muted-foreground">{item.institution}</span>
                        )}
                        {conflictMode === "merge" && assetData.loans.some((l) => keyOfLoan(l) === keyOfLoan(item)) && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">교체</Badge>
                        )}
                        {item.startDateMissing && (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                            대출일 확인 필요
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span>잔액 <span className="font-semibold text-destructive">{formatCurrency(item.balance)}</span></span>
                        <span>금리 <span className="font-semibold text-foreground">{item.interestRate}%</span></span>
                        <span>실행일 <span className="font-semibold text-foreground">{item.startDate}</span></span>
                      </div>

                      <Select
                        value={item.type}
                        onValueChange={(v) => updateType(item.id, v as Loan["type"])}
                      >
                        <SelectTrigger className="h-7 w-40 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOAN_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === "conflict" && <Button variant="brand" onClick={() => setStep("preview")}>다음</Button>}
          {step === "preview" && (
            <Button variant="brand" onClick={handleRegister} disabled={isRegistering || selectedCount === 0}>
              {isRegistering ? <><Loader2 className="size-4 animate-spin mr-2" />등록 중...</> : `${selectedCount}개 대출 등록`}
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
