"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAIN_PALETTE } from "@/config/theme";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

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
    <Button
      variant="outline"
      size="icon"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-5 sm:bottom-10 right-6 z-50 size-12 rounded-full shadow-2xl transition-all duration-300",
        "text-primary-foreground border-2 border-primary-foreground/20",
        "hover:scale-110 hover:shadow-primary/50 hover:bg-primary",
        isVisible ? "opacity-90 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
      aria-label="맨 위로 가기"
      style={{ backgroundColor: MAIN_PALETTE[11] }}
    >
      <ChevronUp className="size-6" />
    </Button>
  );
}
