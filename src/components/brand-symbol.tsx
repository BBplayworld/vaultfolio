import { Logo } from "@/components/logo";

export interface BrandSymbolProps {
  /** 심볼 한 변 크기(px) */
  size?: number;
  className?: string;
}

/**
 * 시크릿에셋 브랜드 심볼(타일 배경 없음). BrandLockup 전용 교체 지점 —
 * 새 심볼 SVG(currentColor·gradient 지원)가 확정되면 이 파일 내부만 인라인 SVG로 바꾼다.
 * 현재는 임시로 기존 Logo("S")를 사용한다.
 */
export function BrandSymbol({ size = 32, className }: BrandSymbolProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      <Logo size={Math.round(size * 0.9)} />
    </span>
  );
}
