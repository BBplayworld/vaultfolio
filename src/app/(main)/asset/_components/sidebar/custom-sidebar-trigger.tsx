"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function CustomSidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      {/* 모바일 환경: 설정 아이콘 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn("md:hidden", className)}
        aria-label="사이드바 열기"
      >
        <PanelLeft className="size-5" />
      </Button>

      {/* PC 환경: 기본 패널 아이콘 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn("hidden md:flex", className)}
        aria-label="사이드바 토글"
      >
        <PanelLeft className="size-5" />
      </Button>
    </>
  );
}
