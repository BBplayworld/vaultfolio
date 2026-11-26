"use client";

// 거래 목록의 메모 줄(5.158 #311, ui.md 4절) — 현금·대출·코인 목록 공용. 날짜 아래 별도 줄, 2줄 말줄임.
// 잘린 메모만 버튼(1탭 그 자리 펼침/재탭 접힘), 잘리지 않은 메모는 누를 수 없는 줄. 잘림 판정은 렌더 후 높이 비교 + 폭 변경 대응.
import { useEffect, useState } from "react";

const TEXT = "text-sm max-[360px]:text-xs text-muted-foreground break-keep [overflow-wrap:anywhere]";

export function TxMemo({ memo }: { memo: string }) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [clamped, setClamped] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!el || open) return; // 펼친 동안은 판정하지 않는다(잘림 상태 유지)
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, open, memo]);

  const text = <span ref={setEl} className={`${TEXT} ${open ? "line-clamp-none" : "line-clamp-2"}`}>{memo}</span>;
  if (!clamped) return <p data-testid="tx-memo">{text}</p>;
  return (
    <button
      type="button"
      data-testid="tx-memo"
      aria-expanded={open}
      aria-label={open ? "메모 접기" : "메모 전체 보기"}
      className="block w-full text-left py-1 -my-1 min-h-10"
      onClick={() => setOpen((v) => !v)}
    >
      {text}
    </button>
  );
}
