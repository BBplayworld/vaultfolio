"use client";

import { useRef, useState } from "react";
import { Download, Upload, Trash2, Sparkles, Copy, Check, Share2, CircleChevronDown } from "lucide-react";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { exportAssetData, importAssetData, clearAssetData, generateShareToken } from "@/lib/asset-storage";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency } from "@/lib/number-utils";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const assetDataContext = useAssetData();
  const { refreshData, getAssetSummary, assetData } = assetDataContext;
  const [isImporting, setIsImporting] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sharePin, setSharePin] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
    } catch (error) {
      toast.error("데이터 내보내기에 실패했습니다.");
    }
  };

  const handleShare = () => {
    setSharePin("");
    setShowShareDialog(true);
  };

  const confirmShare = async () => {
    try {
      if (!assetData) return;

      if (sharePin && sharePin.length !== 4) {
        toast.error("PIN 번호는 4자리여야 합니다.");
        return;
      }

      const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin || undefined);
      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(token)}`;

      await navigator.clipboard.writeText(shareUrl);

      const length = token.length;
      if (length <= 200) {
        toast.success(sharePin ? "보안된 공유 URL이 복사되었습니다." : "최적화된 공유 URL이 복사되었습니다.");
      } else {
        toast.success("공유 URL이 복사되었습니다.");
        toast.info(`데이터가 많아 토큰이 ${length}자입니다. 일부 환경에서 제한될 수 있습니다.`);
      }
      setShowShareDialog(false);
    } catch (error) {
      toast.error("URL 공유 준비에 실패했습니다.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importAssetData(file);
      refreshData();
      toast.success("자산 데이터를 불러왔습니다.");
    } catch (error) {
      toast.error("데이터 가져오기에 실패했습니다. 파일 형식을 확인해주세요.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    const success = clearAssetData();
    if (success) {
      refreshData();
      toast.success("모든 자산 데이터가 삭제되었습니다.");
    } else {
      toast.error("데이터 삭제에 실패했습니다.");
    }
    setShowClearDialog(false);
  };

  const generateAIPrompt = () => {
    const summary = getAssetSummary();

    // 부동산 상세 분석 (주소 포함)
    const realEstateList = assetData.realEstate.map((item) => {
      const typeMap: Record<string, string> = {
        apartment: '아파트',
        house: '주택',
        land: '토지',
        commercial: '상가',
        other: '기타'
      };
      const type = typeMap[item.type] || item.type;
      const profit = item.currentValue - item.purchasePrice;
      const profitRate = item.purchasePrice > 0 ? ((profit / item.purchasePrice) * 100).toFixed(2) : '0.00';
      const address = item.address || '주소 미입력';

      return `  • ${item.name} (${type}) - ${address}
    평가금액: ${formatShortCurrency(item.currentValue)} | 수익률: ${profitRate}%`;
    }).join('\n');

    // 주식 상세 분석 (종목명 포함)
    const stockList = assetData.stocks.map((item) => {
      const categoryMap: Record<string, string> = {
        domestic: '국내',
        foreign: '해외',
        irp: 'IRP',
        isa: 'ISA',
        pension: '연금',
        unlisted: '비상장'
      };
      const category = categoryMap[item.category] || item.category;
      const value = item.quantity * item.currentPrice;
      const cost = item.quantity * item.averagePrice;
      const profit = value - cost;
      const profitRate = cost > 0 ? ((profit / cost) * 100).toFixed(2) : '0.00';

      return `  • [${category}] ${item.name} (${item.ticker || 'N/A'})
    평가금액: ${formatShortCurrency(value)} | 수익률: ${profitRate}%`;
    }).join('\n');

    // 암호화폐 상세 분석 (코인명 포함)
    const cryptoList = assetData.crypto.map((item) => {
      const value = item.quantity * item.currentPrice;
      const cost = item.quantity * item.averagePrice;
      const profit = value - cost;
      const profitRate = cost > 0 ? ((profit / cost) * 100).toFixed(2) : '0.00';

      return `  • ${item.name} (${item.symbol}) - ${item.exchange || '거래소 미입력'}
    보유량: ${item.quantity} ${item.symbol} | 평가금액: ${formatShortCurrency(value)} | 수익률: ${profitRate}%`;
    }).join('\n');

    // 대출 상세 분석
    const loanList = assetData.loans.map((item) => {
      const typeMap: Record<string, string> = {
        credit: '신용대출',
        minus: '마이너스통장',
        home_mortgage: '주택담보대출',
        stock_mortgage: '주식담보대출',
        insurance_loan: '보험약관대출',
        deposit_loan: '전세자금대출',
        other: '기타'
      };
      const type = typeMap[item.type] || item.type;

      return `  • ${item.name} (${type}) - ${item.institution || '금융기관 미입력'}
    잔액: ${formatShortCurrency(item.balance)} | 금리: ${item.interestRate}%`;
    }).join('\n');

    const debtRatio = summary.totalValue > 0 ? (summary.loanBalance / summary.totalValue * 100).toFixed(1) : '0';
    const netAssetRatio = summary.totalValue > 0 ? (summary.netAsset / summary.totalValue * 100).toFixed(1) : '0';

    const prompt = `안녕하세요! 제 현재 자산 현황을 분석하고 조언을 부탁드립니다.

📊 **자산 현황 요약**

• 순자산: ${formatShortCurrency(summary.netAsset)} (순자산비율 ${netAssetRatio}%)
  (총자산 ${formatShortCurrency(summary.totalValue)} - 대출 ${formatShortCurrency(summary.loanBalance)} - 임차인보증금 ${formatShortCurrency(summary.tenantDepositTotal)})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏠 **부동산 상세** (총 ${formatShortCurrency(summary.realEstateValue)}, ${summary.realEstateCount}개)
${realEstateList || '  - 등록된 부동산 없음'}

평가손익: ${summary.realEstateProfit >= 0 ? '+' : ''}${formatShortCurrency(summary.realEstateProfit)} (${summary.realEstateCost > 0 ? ((summary.realEstateProfit / summary.realEstateCost) * 100).toFixed(2) : '0.00'}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 **주식 상세** (총 ${formatShortCurrency(summary.stockValue)}, ${summary.stockCount}개)
${stockList || '  - 등록된 주식 없음'}

평가손익: ${summary.stockProfit >= 0 ? '+' : ''}${formatShortCurrency(summary.stockProfit)} (${summary.stockCost > 0 ? ((summary.stockProfit / summary.stockCost) * 100).toFixed(2) : '0.00'}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

₿ **암호화폐 상세** (총 ${formatShortCurrency(summary.cryptoValue)}, ${summary.cryptoCount}개)
${cryptoList || '  - 등록된 암호화폐 없음'}

평가손익: ${summary.cryptoProfit >= 0 ? '+' : ''}${formatShortCurrency(summary.cryptoProfit)} (${summary.cryptoCost > 0 ? ((summary.cryptoProfit / summary.cryptoCost) * 100).toFixed(2) : '0.00'}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 **대출 상세** (총 ${formatShortCurrency(summary.loanBalance)}, ${summary.loanCount}건)
${loanList || '  - 등록된 대출 없음'}

📊 **부채 비율**
  - 총자산 대비 부채 비율: ${debtRatio}%
  - 순자산 대비 부채 비율: ${summary.netAsset > 0 ? (summary.loanBalance / summary.netAsset * 100).toFixed(1) : 'N/A'}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 **자산 포트폴리오 분석 및 개선 조언 요청**

위 자산 현황을 바탕으로 다음 사항에 대해 조언 부탁드립니다:

1. **포트폴리오 균형 분석**
   - 부동산/주식/암호화폐 배분 비율의 적절성
   - 리스크 수준 평가 및 개선 방안

2. **부동산 포트폴리오**
   - 각 부동산의 입지와 유형 평가
   - 지역/유형 다각화 필요성

3. **주식 포트폴리오 리밸런싱**
   - 국내/해외 주식 비율의 적절성
   - 개별 종목별 비중 및 집중도 평가
   - 각 카테고리별(IRP, ISA, 연금저축 등) 배분 전략

4. **암호화폐 포트폴리오**
   - 종목별 비중 및 리스크 평가
   - 포트폴리오 다각화 필요성

5. **대출 관리 전략**
   - 현재 부채 비율(${debtRatio}%)의 적정성 평가
   - 대출 유형별 우선 상환 순서
   - 레버리지 활용의 적절성

6. **장기 자산 증식 로드맵**
   - 현재 포트폴리오 기반 3~5년 목표 설정
   - 월별/분기별 투자 전략
   - 우선적으로 개선해야 할 점

감사합니다!`;

    return prompt;
  };

  const handleCopyPrompt = async () => {
    const prompt = generateAIPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("AI 평가 프롬프트가 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <>
      <SidebarMenu className="rounded-md transition-colors shadow-sm overflow-hidden">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="h-9 px-2 text-white hover:text-white transition-colors border-none bg-zinc-800 hover:bg-zinc-700 data-[state=open]:bg-zinc-700 dark:bg-rose-500 dark:hover:bg-rose-600 dark:data-[state=open]:bg-rose-600"
              >
                <div className="grid flex-1 text-left text-xs leading-tight ml-1">
                  <span className="truncate font-bold tracking-tighter uppercase text-[11px]">데이터 및 설정 관리</span>
                </div>
                <CircleChevronDown className="ml-auto size-3.5 opacity-70" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">데이터 및 설정 관리</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-muted-foreground">데이터 관리</p>
              </div>
              <DropdownMenuItem className="py-2" onClick={handleExport}>
                <Download className="size-4" />
                데이터 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2" onClick={handleImportClick} disabled={isImporting}>
                <Upload className="size-4" />
                {isImporting ? "가져오는 중..." : "데이터 가져오기"}
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2" onClick={handleShare}>
                <Share2 className="size-4" />
                공유 URL 복사
              </DropdownMenuItem>
              <DropdownMenuItem className="text-rose-400 focus:text-rose-400 py-2" onClick={() => setShowClearDialog(true)} >
                <Trash2 className="size-4" />
                모든 데이터 삭제
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-muted-foreground">기능</p>
              </div>
              <DropdownMenuItem className="text-primary focus:text-primary py-2" onClick={() => setShowAIPromptDialog(true)} >
                <Sparkles className="size-4" />
                <span className="flex-1">AI 평가용 자산 현황</span>
                <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">NEW</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 모든 데이터를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 모든 자산 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAIPromptDialog} onOpenChange={setShowAIPromptDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI 평가용 자산 종합 현황
            </DialogTitle>
            <DialogDescription>
              아래 프롬프트를 복사하여 Gemini, Grok 등 AI에게 자산 분석 및 조언을 요청하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <Textarea
              value={generateAIPrompt()}
              readOnly
              className="min-h-[400px] w-full font-mono text-sm resize-none"
            />
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="text-muted-foreground">
                💡 이 프롬프트에는 현재 자산 현황 요약과 분석 요청 사항이 포함되어 있습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIPromptDialog(false)}>
              닫기
            </Button>
            <Button onClick={handleCopyPrompt}>
              {copied ? (
                <>
                  <Check className="mr-2 size-4" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" />
                  프롬프트 복사
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              자산 데이터 공유
            </DialogTitle>
            <DialogDescription>
              암호화된 토큰을 생성하여 다른 브라우저와 데이터를 공유합니다.<br />
              <span className="font-semibold text-rose-500">선택사항:</span> 민감한 정보 보호를 위해 4자리 PIN을 설정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                {sharePin ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                비밀번호 (4자리 숫자)
              </Label>
              <InputOTP
                maxLength={4}
                value={sharePin}
                onChange={(value) => setSharePin(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-[11px] text-muted-foreground">
                설정하지 않으려면 비워두세요.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              취소
            </Button>
            <Button onClick={confirmShare} type="button">
              <Copy className="mr-2 size-4" />
              공유 URL 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
