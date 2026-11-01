"use client";

import { APP_CONFIG } from "@/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, CloudLightning, EyeOff, Info } from "lucide-react";
import React, { useState, useEffect } from "react";
import { SECURITY_COPY, APP_GUIDE_SECURITY_DESC, type SecurityCopyId } from "@/config/security-copy";

const SECURITY_ICONS: Record<SecurityCopyId, React.ElementType> = { local: ShieldCheck, sync: CloudLightning, admin: EyeOff };

export function AppGuideContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-sm">
      {/* 보안 특징 카드 3개 — 웰컴 보안 상세와 같은 SECURITY_COPY 렌더 */}
      {SECURITY_COPY.map(({ id, title, desc }) => {
        const Icon = SECURITY_ICONS[id];
        return (
          <div key={id} className="flex flex-col gap-2.5 p-5 rounded-xl bg-muted/40 backdrop-blur-sm shadow-sm transition-colors hover:bg-muted/60">
            <div className="flex items-center gap-2">
              <Icon className="size-5 text-primary shrink-0" />
              <h4 className="font-semibold text-foreground text-[15px] text-balance break-keep">{title}</h4>
            </div>
            <p className="text-muted-foreground text-[13px] leading-7 tracking-[0.01em] break-keep text-pretty">{desc}</p>
          </div>
        );
      })}
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
          <DialogTitle className="flex items-center gap-2 text-[17px] font-bold text-primary tracking-tight pr-8 text-balance">
            <Info className="size-5 shrink-0" />
            {APP_CONFIG.name} 보안 가이드 - 내 자산은 오직 나만 볼 수 있게
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-left text-pretty break-keep">
            시크릿에셋은 데이터 프라이버시를 최우선으로 생각합니다. {APP_GUIDE_SECURITY_DESC}
          </DialogDescription>
        </DialogHeader>
        <AppGuideContent />
      </DialogContent>
    </Dialog>
  );
}
