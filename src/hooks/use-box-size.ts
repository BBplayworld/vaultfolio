"use client";

// 요소 실측 크기(ResizeObserver) — 차트를 픽셀 좌표 SVG로 그릴 때 쓴다(종목 한 장 차트·상세·주식 행 밴드, 4.84).
// fallback은 측정 전 첫 렌더 크기: 종목 한 장은 320×200, 행 밴드는 {w:0,h:0}(측정 전엔 같은 높이의 빈 슬롯만 그린다)
import { useEffect, useRef, useState } from "react";

export interface BoxSize {
  w: number;
  h: number;
}

export function useBoxSize(fallback: BoxSize) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<BoxSize>(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}
