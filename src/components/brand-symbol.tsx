import { useId } from "react";

export interface BrandSymbolProps {
  /** 심볼 한 변 크기(px). CSS width/height가 있으면 그쪽이 우선(SVG 속성은 최저 우선순위) */
  size?: number;
  className?: string;
}

// C 레이어 S(4.66-ui-r3 C안 → R4 상하 균형). viewBox 32, 획 4.8 → 잉크 x 6.1~25.9 · y 2.6~29.4(세로 중심 = 박스 중심 16)
// R4: 기하 점대칭이던 R3 S는 위쪽 볼이 커 보였다(대표 지적 — 상단 착시 + 밝은 위 면). 타이포 관행대로 광학 보정:
// 척추 교차점 16→15.5(위 볼 잉크 높이 12.9 : 아래 13.9), 위 볼 중심선 반폭 7.5→7.25(잉크 폭 19.3 : 19.8). 교차점 접선 연속
const S_PATH =
  "M23.25 9.68C23.25 6.53 20.06 5 16 5C11.75 5 8.75 6.72 8.75 9.68C8.75 12.83 12.13 13.93 16 15.5C20 17.13 23.5 18.43 23.5 21.88C23.5 25.12 20.4 27 16 27C11.8 27 8.5 25.33 8.5 21.88";
// 대각 틈: 중심선이 척추 교차점 (16,15.5)를 지남, 각도 유지(약 18°). 폭 1.6 → 1.1로 축소 — 20~32px에서 1.6은 사선 슬래시처럼 S를 끊어 보여
// 0.7~0.9px 이음선으로 줄이고 두 면 구분은 톤 차이로 전달(#4.66 R3 크기별 비교 근거)
const CLIP_TOP = "M0 0H32V9.65L0 20.25Z";
const CLIP_BOTTOM = "M0 21.35L32 10.75V32H0Z";

/**
 * 시크릿에셋 브랜드 심볼 — C 레이어 S(두 톤 인디고 그라데이션, 타일 없음). 대표 결정 #4.66 R3, R4 상하 균형.
 * stop 색은 CSS 변수(`--brand-symbol-*`, globals.css 라이트/다크)로 분리. gradient·clip id는 인스턴스별 고유(useId).
 */
export function BrandSymbol({ size = 32, className }: BrandSymbolProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const top = `bs-t-${uid}`;
  const bottom = `bs-b-${uid}`;
  const clipTop = `bs-ct-${uid}`;
  const clipBottom = `bs-cb-${uid}`;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={`shrink-0${className ? ` ${className}` : ""}`}
    >
      <defs>
        <linearGradient id={top} x1="8" y1="4" x2="24" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--brand-symbol-t0)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-symbol-t1)" }} />
        </linearGradient>
        <linearGradient id={bottom} x1="8" y1="15.5" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--brand-symbol-b0)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-symbol-b1)" }} />
        </linearGradient>
        <clipPath id={clipTop}>
          <path d={CLIP_TOP} />
        </clipPath>
        <clipPath id={clipBottom}>
          <path d={CLIP_BOTTOM} />
        </clipPath>
      </defs>
      <path d={S_PATH} strokeWidth={4.8} stroke={`url(#${top})`} clipPath={`url(#${clipTop})`} />
      <path d={S_PATH} strokeWidth={4.8} stroke={`url(#${bottom})`} clipPath={`url(#${clipBottom})`} />
    </svg>
  );
}
