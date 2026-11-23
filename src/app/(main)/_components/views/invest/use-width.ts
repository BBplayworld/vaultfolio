"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** 요소 폭(px). 처음 측정 전은 0. 렌더마다 ref가 가리키는 요소가 바뀌었는지 확인해 새 요소를 다시 관찰한다
 *  (공개 가이드는 SSR 뒤 wide 전환으로 레이아웃 트리가 바뀌어 DOM이 교체된다 — 예전 요소만 보면 폭이 0으로 남아 그림이 스켈레톤에 머문다) */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  const seen = useRef<HTMLElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === seen.current) return;
    ro.current?.disconnect();
    seen.current = el;
    if (!el) return;
    const read = () => setW(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return;
    ro.current = new ResizeObserver(read);
    ro.current.observe(el);
  });
  useEffect(() => () => ro.current?.disconnect(), []);
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
