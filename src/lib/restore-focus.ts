import { useLayoutEffect, useRef } from "react";
// 창 닫힘 포커스 복귀 공용 함수 — 여는 버튼이 같은 클릭에서 사라져 Radix가 돌려줄 요소가 없는 창용(#109 잔액 맞추기, #115 FAB 시트).
// 순서: 보이는 '자산 업데이트' FAB → 열기 직전 요소(DOM에 남아 있을 때) → main(tabindex -1).
// 호출측이 onCloseAutoFocus에서 e.preventDefault() 후 부른다. 다른 창으로 이어지는 경우(goAdd 플래그 등)는 호출측이 먼저 건너뛴다.

/** 보이는 FAB — 모바일 하단 바·PC 인라인 중 렌더된 쪽, 스크롤로 숨은 FAB(opacity-0)는 제외 */
function findVisibleFab(): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial="tutorial-fab"]')).find((el) => el.getClientRects().length > 0 && !el.closest(".opacity-0"));
}

export function restoreFocusAfterDialog(opener: HTMLElement | null, opts?: { skipIfOtherDialog?: boolean }): void {
  // 보조 안전장치: 닫는 창 외에 열린 대화상자가 있으면 그 창이 포커스를 갖는다(포커스 탈취 방지)
  if (opts?.skipIfOtherDialog && document.querySelector('[role="dialog"]:not([data-state="closed"]):not(#fab-sheet)')) return;
  const fab = findVisibleFab();
  const connected = opener?.isConnected ? opener : null;
  const main = document.querySelector<HTMLElement>("main");
  if (main && !main.hasAttribute("tabindex")) { main.setAttribute("tabindex", "-1"); main.classList.add("outline-none"); }
  (fab ?? connected ?? main)?.focus({ preventScroll: true });
}

/**
 * FAB 경유 창용 닫힘 포커스 훅(#118) — 열릴 때 직전 포커스 요소를 기억하고, 닫힐 때 그 요소가 사라졌으면
 * (FAB 시트 안 버튼) restoreFocusAfterDialog로 보이는 FAB → main 순 복귀. 상세 탭의 편집 버튼처럼 요소가 남아 있으면
 * Radix 기본 복귀에 맡긴다. 다른 창이 이어서 열려 있으면 포커스를 건드리지 않는다(skipIfOtherDialog).
 * 반환값을 DialogContent의 onCloseAutoFocus에 연결한다.
 */
export function useReturnFocusOnClose(open: boolean): (e: Event) => void {
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // 레이아웃 이펙트는 Radix FocusScope(패시브 이펙트)가 포커스를 옮기기 전에 실행된다
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    wasOpen.current = open;
  }, [open]);
  return (e: Event) => {
    const opener = openerRef.current;
    if (opener && opener !== document.body && opener.isConnected) return; // 열기 직전 요소가 남아 있으면 기본 복귀
    e.preventDefault();
    restoreFocusAfterDialog(opener, { skipIfOtherDialog: true });
  };
}
