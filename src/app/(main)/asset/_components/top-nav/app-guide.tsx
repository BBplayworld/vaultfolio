import { APP_CONFIG } from "@/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Database, Sparkles, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/local-storage";

export function AppGuideContent() {
    return (
        <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
                <Database className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground leading-relaxed">
                    <span className="font-semibold text-primary">영지식(Zero-Knowledge) 이중 보안</span>
                    {"  —  "}
                    데이터는 <span className="text-rose-400">이 기기 브라우저</span>에만 보관됩니다.{" "}
                    <span className="text-rose-400">&apos;공유 URL 복사&apos;</span> 시에도 랜덤 키(Key)와 사용자 PIN이 완전히 분리되어, 관리자를 포함한 그 누구도 서버 데이터 단독으로는 복호화할 수 없도록 <span className="font-medium text-rose-400">원천 봉쇄</span>되어 있습니다.{" "}
                    <span className="text-muted-foreground block mt-1 break-keep">
                        (주의: 공유 URL 자체에 해독 키의 절반이 포함되어 있습니다. 안전을 위해 URL을 공개 게시판 등에 노출하지 마시고, PIN 번호는 다른 수단을 통해 공유 대상자에게 별도로 알려주세요.)
                    </span>
                </span>
            </li>
            <li className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground leading-relaxed">
                    <span className="font-semibold text-primary">AI 자산 분석</span>
                    {"  —  "}
                    상단{" "}
                    <span className="text-rose-400">자산 관리 메뉴</span>에서
                    Grok·Gemini·GPT에 바로 붙여넣을 수 있는{" "}
                    <span className="text-rose-400">AI 평가용 프롬프트</span>를 생성할 수 있습니다.{" "}
                    데이터 내보내기·가져오기를 지원합니다.
                </span>
            </li>
            <li className="flex items-start gap-2">
                <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground leading-relaxed">
                    <span className="font-semibold text-primary">매일 자동 업데이트</span>
                    {"  —  "}
                    보유 <span className="text-rose-400">주식 현재가</span>와{" "}
                    <span className="text-rose-400">환율(USD·JPY)</span>을
                    매일 최신 정보로 자동 반영합니다.
                </span>
            </li>
        </ul>
    );
}

export function AppGuide() {
    const [alertDismissed, setAlertDismissed] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(STORAGE_KEYS.guideDismissed) === "1";
    });

    const dismissAlert = () => {
        localStorage.setItem(STORAGE_KEYS.guideDismissed, "1");
        setAlertDismissed(true);
    };

    const restoreAlert = () => {
        localStorage.removeItem(STORAGE_KEYS.guideDismissed);
        setAlertDismissed(false);
    };

    useEffect(() => {
        const restore = () => restoreAlert();
        const dismiss = () => setAlertDismissed(true);
        window.addEventListener("trigger-restore-guide", restore);
        window.addEventListener("trigger-dismiss-guide", dismiss);
        return () => {
            window.removeEventListener("trigger-restore-guide", restore);
            window.removeEventListener("trigger-dismiss-guide", dismiss);
        };
    }, []);

    if (alertDismissed) return null;

    return (
        <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 relative">
            <Info className="size-3.5 sm:size-4 text-primary" />
            <Button
                variant="ghost"
                size="icon"
                onClick={dismissAlert}
                className="absolute top-2 right-2 size-7 text-muted-foreground hover:text-foreground"
                aria-label="닫기"
            >
                <X className="size-4" />
            </Button>
            <AlertTitle className="text-base font-semibold text-primary mb-3 pr-8">
                {APP_CONFIG.name} - 내 자산은 오직 내 브라우저에만
            </AlertTitle>
            <AlertDescription>
                <AppGuideContent />
            </AlertDescription>
        </Alert>
    );
}
