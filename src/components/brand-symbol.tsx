export interface BrandSymbolProps {
  /** 심볼 한 변 크기(px). CSS width/height가 있으면 그쪽이 우선(SVG 속성은 최저 우선순위) */
  size?: number;
  className?: string;
}

// 글리프 아웃라인: Leckerli One "S" © Gesine Todt, SIL OFL 1.1 (fonts.google.com/specimen/Leckerli+One) — 폰트 파일 미포함, path만
// 파비콘·Logo(next/font)와 같은 서체(#4.66 R8). viewBox 32, 잉크 높이 26.8(y 2.6~29.4, 세로 중심 16)·폭 17.74(x 7.13~24.87, 가로 중앙)
const S_PATH =
  "M12.19 21.74Q12.19 24.8 14.79 24.8Q17.63 24.8 18.62 22.83Q18.97 22.13 18.97 21.02Q18.97 19.92 18.44 18.97Q17.56 17.46 15.42 15.63Q11.87 12.61 11.87 9.36Q11.87 6.11 13.91 4.36Q15.95 2.6 18.58 2.6Q21.22 2.6 22.76 3.93Q24.31 5.27 24.31 7.94Q24.31 9.7 23.13 10.99Q21.95 12.29 20.02 12.61Q20.9 13.35 21.78 14.12Q22.62 14.89 23.32 15.81Q24.87 17.88 24.87 20.76Q24.87 22.76 23.94 24.38Q23.01 25.99 21.51 27.1Q20.02 28.21 18.16 28.8Q16.3 29.4 14.68 29.4Q11.24 29.4 9.34 27.82Q7.13 26.03 7.13 22.66Q7.13 20.44 8.57 18.37Q10.01 16.3 11.63 16.3Q12.89 16.3 12.89 17.07Q12.89 18.2 12.54 19.3Q12.19 20.41 12.19 21.74ZM19 11.77Q21.01 9.77 21.01 7.59Q21.01 6.92 20.3 6.46Q19.53 6.04 18.69 6.04Q16.79 6.04 15.95 7.27Q16.37 8.78 17.19 9.84Q18.02 10.89 19 11.77Z";

/**
 * 시크릿에셋 브랜드 심볼 — Leckerli One "S"(단색, 타일 없음). 대표 결정 #4.66 R8(파비콘과 같은 서체, 기하형 C 레이어 S 대체).
 * 색은 로고 단일 토큰 `--brand-logo`(다크 #F2F3F6 / 라이트 #111111, globals.css) — 워드마크와 같은 값. 틈이 없어 해상도별 분기 없음.
 */
export function BrandSymbol({ size = 32, className }: BrandSymbolProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0${className ? ` ${className}` : ""}`}
    >
      <path d={S_PATH} style={{ fill: "var(--brand-logo)" }} />
    </svg>
  );
}
