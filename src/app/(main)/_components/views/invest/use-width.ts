"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** 요소 폭(px). 처음 측정 전은 0 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** 미디어 쿼리(서버·첫 렌더는 false) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 클라이언트에서 마운트된 뒤 true(SSR HTML에 지수 수준값을 넣지 않기 위한 문) */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
