"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // PWA(standalone) 환경에서만 아래로 스와이프 시 toast 해제 (브라우저는 기본 동작 유지 — pull-to-refresh 충돌 회피)
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true
    )
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={2000}
      mobileOffset={{ bottom: "12px" }}
      // Radix 모달이 body에 걸어 둔 pointer-events:none을 토스트가 상속해 시트·대화상자가 열린 동안 토스트 버튼(예: 되돌리기)이 눌리지 않던 문제(5.161 D-1).
      // 클래스(0,1,0)라 숨김 토스트의 sonner 규칙 [data-visible=false]{pointer-events:none}(0,2,0)은 그대로 이긴다
      toastOptions={{ className: "pointer-events-auto" }}
      swipeDirections={isStandalone ? ["bottom"] : undefined}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
