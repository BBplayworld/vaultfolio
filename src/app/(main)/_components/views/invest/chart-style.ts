// 투자 탭 SVG 공용 색·글자 스타일. 새 토큰 0 — 기존 시맨틱 토큰(foreground·muted-foreground·card·secondary·brand)을 CSS 변수로 읽고,
// 옅은 선·면은 color-mix로 만든다. 손실색(파랑)은 design-system §1.2 `text-blue-600 dark:text-blue-400`와 같은 값의 클래스를 쓴다.
import type { CSSProperties } from "react";

export const C = {
  fg: "var(--foreground)",
  mf: "var(--muted-foreground)",
  card: "var(--card)",
  sec: "var(--secondary)",
  brand: "var(--brand)",
  hair: "color-mix(in oklab, var(--foreground) 10%, transparent)",
  ink2: "color-mix(in oklab, var(--foreground) 62%, transparent)",
  ink3: "color-mix(in oklab, var(--foreground) 16%, transparent)",
  brandSoft: "color-mix(in oklab, var(--brand) 16%, transparent)",
} as const;

export const LOSS_STROKE = "stroke-blue-600 dark:stroke-blue-400";
export const LOSS_FILL = "fill-blue-600 dark:fill-blue-400";
/** 오른쪽 축 글자(겹쳐 보기): 링크·선택 글자 규약(design-system) `text-brand dark:text-indigo-300`과 같은 색 */
export const BRAND_TEXT_FILL = "fill-indigo-600 dark:fill-indigo-300";

/** 글자 뒤 카드색 후광(C3: 선택선이 글자를 가로질러도 읽히게) */
export const HALO: CSSProperties = { paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" };
export const SVG_TEXT = "fill-muted-foreground";
