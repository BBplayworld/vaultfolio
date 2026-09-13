import type { CSSProperties } from "react";
import { Leckerli_One } from "next/font/google";

const leckerliOne = Leckerli_One({ weight: "400", subsets: ["latin"] });

export interface LogoProps {
  /** 글자 크기(px). 기본 24 */
  size?: number;
  className?: string;
  /** 색상 등 인라인 스타일 오버라이드(예: 활성 탭 강조색) — fontSize보다 우선 적용되지 않음 */
  style?: CSSProperties;
}

/**
 * 시크릿에셋 서비스 로고 — 파비콘과 동일한 Leckerli One 서체로 "S" 한 글자를 렌더.
 * 특정 도메인(자산/화면/폼)에 속하지 않는 범용 브랜드 UI 원자라 도메인 트리 바깥(src/components/)에
 * 둔다. 위치·색·투명도는 호출부 `className`/`style`로 지정 — 이 컴포넌트 자체는 배치를 가정하지 않는다.
 */
export function Logo({ size = 24, className, style }: LogoProps) {
  return (
    <span
      aria-hidden
      className={`${leckerliOne.className} inline-block leading-none select-none${className ? ` ${className}` : ""}`}
      style={{ fontSize: size, ...style }}
    >
      S
    </span>
  );
}
