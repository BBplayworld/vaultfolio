"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Z_LAYER } from "@/config/theme";

// 부수 설명 공용 Hint — 데스크톱 hover · 모바일 터치(탭) 모두 동작
// 가이드 §3 패턴 (radix Tooltip 대신 Popover + pointerType 필터)
//
// 규칙 ① 한 줄 설명: summary 는 필수. 팝오버 최상단에 한 줄 요약이 항상 먼저 오고,
//   children(상세)은 선택. "열어보면 무슨 말인지 모르겠는" 장문 힌트를 막는다.
// 규칙 ③ 히트영역: 터치 기기(pointer: coarse)에서만 투명 after 로 40×40px 확장(레이아웃 폭 불변, 마우스 hover 영역 불변).
//   이웃에 클릭 가능한 요소가 있으면 그 요소에 relative z-10 을 줘 이웃 탭이 가로채이지 않게 한다.
// 규칙 ② 레이어: Popover 는 Portal 로 body 에 붙으므로 부모의 stacking context 를 벗어난다.
//   기본은 Z_LAYER.hint(=nav 위). 다이얼로그·시트 안에서 쓸 때는 inModal 을 켜야
//   모달 콘텐츠(Z_LAYER.modalContent)에 가려지지 않는다.
export function InfoHint({
  summary,
  children,
  side = "bottom",
  inModal = false,
}: {
  /** 한 줄 요약 (필수) */
  summary: ReactNode;
  /** 추가 상세 설명 (선택) */
  children?: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Dialog·Sheet 내부에서 사용할 때 true */
  inModal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const z = inModal ? Z_LAYER.modalHint : Z_LAYER.hint;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="설명 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors inline-flex items-center relative pointer-coarse:after:absolute pointer-coarse:after:content-[''] pointer-coarse:after:-inset-[13px] sm:pointer-coarse:after:-inset-3"
        >
          <Info className="size-3.5 sm:size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        sideOffset={4}
        collisionPadding={12}
        style={{ zIndex: z }}
        className="w-72 p-3 text-sm leading-relaxed text-left space-y-1.5"
      >
        <p className="font-semibold text-foreground text-pretty break-keep">{summary}</p>
        {children && <div className="space-y-1 text-muted-foreground">{children}</div>}
      </PopoverContent>
    </Popover>
  );
}
