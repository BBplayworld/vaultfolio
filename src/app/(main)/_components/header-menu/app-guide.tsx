"use client";

import { APP_CONFIG } from "@/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, CloudLightning, EyeOff, Info } from "lucide-react";
import { useState, useEffect } from "react";

export function AppGuideContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-sm">
      {/* 피처 1: 영지식 */}
      <div className="flex flex-col gap-2.5 p-5 rounded-xl border border-primary/20 bg-background/50 backdrop-blur-sm shadow-sm transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary shrink-0" />
          <h4 className="font-semibold text-foreground text-[15px]">영지식(Zero-Knowledge) 로컬 격리</h4>
        </div>
        <p className="text-muted-foreground text-[13px] leading-7 tracking-[0.01em] break-keep">
          모든 자산 데이터는 브라우저 내부(<span className="text-foreground font-medium">localStorage</span> 및 기기 비추출 키 기반 <span className="text-foreground font-medium">IndexedDB</span>)에만 안전하게 보관됩니다. 자격 증명이나 사용자 동의 없이는 데이터가 기기를 절대 벗어나지 않습니다.
        </p>
      </div>

      {/* 피처 2: 클라우드 동기화 */}
      <div className="flex flex-col gap-2.5 p-5 rounded-xl border border-primary/20 bg-background/50 backdrop-blur-sm shadow-sm transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <CloudLightning className="size-5 text-primary shrink-0" />
          <h4 className="font-semibold text-foreground text-[15px]">이중 종단간 암호화(E2EE) 동기화</h4>
        </div>
        <p className="text-muted-foreground text-[13px] leading-7 tracking-[0.01em] break-keep">
          기기 내부에서 금고 암호로부터 <span className="text-foreground font-medium">PBKDF2 (200k 반복 연산)</span>를 통해 강력한 대칭키(<span className="text-foreground font-medium">encKey</span>)와 인증용 서명 키쌍(<span className="text-foreground font-medium">Ed25519</span>)을 결정적으로 파생합니다.
          전송되는 모든 데이터는 기기 내에서 암호화되며, 사용자의 암호나 `encKey`는 절대 네트워크로 나가지 않습니다.
        </p>
      </div>

      {/* 피처 3: 서버 관리자 불가 */}
      <div className="flex flex-col gap-2.5 p-5 rounded-xl border border-primary/20 bg-background/50 backdrop-blur-sm shadow-sm transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <EyeOff className="size-5 text-primary shrink-0" />
          <h4 className="font-semibold text-foreground text-[15px]">서버 관리자 자산 열람 원천 불가</h4>
        </div>
        <p className="text-muted-foreground text-[13px] leading-7 tracking-[0.01em] break-keep">
          서버는 오직 <span className="text-foreground font-medium">암호문(blob)과 공개키(pubKey)만 보관</span>하며 해독 수단이 전혀 없습니다.
          링크 공유나 기기 연결 시에도 복호화 키의 절반(localKey)은 오직 클라이언트 브라우저 주소 해시(#)로만 전달되므로, 서버 관리자나 제3자는 사용자의 데이터를 볼 수 없습니다.
        </p>
      </div>
    </div>
  );
}

export function AppGuide() {
  // 평소에는 숨김. 메뉴-앱가이드 클릭(trigger-restore-guide) 시 중앙 모달로 표시.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const restore = () => setOpen(true);
    const dismiss = () => setOpen(false);
    window.addEventListener("trigger-restore-guide", restore);
    window.addEventListener("trigger-dismiss-guide", dismiss);
    return () => {
      window.removeEventListener("trigger-restore-guide", restore);
      window.removeEventListener("trigger-dismiss-guide", dismiss);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-[17px] font-bold text-primary tracking-tight">
            <Info className="size-5 shrink-0" />
            {APP_CONFIG.name} 보안 가이드 - 내 자산은 오직 나만 볼 수 있게
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-left">
            시크릿에셋은 데이터 프라이버시를 최우선으로 생각합니다. E2EE 암호학적 검증 모델이 적용되어 안전합니다.
          </DialogDescription>
        </DialogHeader>
        <AppGuideContent />
      </DialogContent>
    </Dialog>
  );
}
