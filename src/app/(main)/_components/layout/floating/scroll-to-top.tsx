"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { Z_LAYER } from "@/config/theme";
import { cn } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { isStandalone } = usePWAInstall();

  useEffect(() => {
    const toggleVisibility = () => {
      // 화면을 100px 이상 스크롤하면 버튼 표시
      if (window.scrollY > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={cn(
        "fixed right-6 size-10 rounded-full shadow-md transition-[opacity,transform] duration-300",
        // PWA standalone은 하단 네비(BottomNav)에 가려지지 않도록 그 위로 띄운다 — 브라우저 탭은 하단 네비가 없어 기존 값 유지
        isStandalone ? "bottom-[calc(7rem+env(safe-area-inset-bottom))]" : "bottom-18 sm:bottom-22",
        "inline-flex items-center justify-center",
        "bg-foreground/60 text-background hover:bg-foreground/90 hover:scale-105",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      aria-label="맨 위로 가기"
      style={{ zIndex: Z_LAYER.nav }}
    >
      <ChevronUp className="size-5" />
    </button>
  );
}
