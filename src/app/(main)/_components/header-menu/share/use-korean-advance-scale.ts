import { useEffect, useState } from "react";

// 인증카드 캡처 전용 — 한글이 기기 OS 시스템 폰트(맑은 고딕·Apple SD Gothic Neo 등)로 그려져 같은 px여도
// 글자 폭이 기기마다 다르다(iOS가 PC보다 약 5~6% 좁음). 실제 한글 자폭을 재서 좁은 기기만 글자를 키워 맞춘다.
// TARGET_ADVANCE = 기준 기기(Windows PC, 맑은 고딕)의 한글 1자 폭(em). PC 콘솔 실측 0.9200(2026-09)으로
// 확정 — PC는 보정 1(불변), 이보다 좁은 기기(iOS Apple SD Gothic Neo 등)만 이 폭에 맞춰 커진다.
// 개발 모드 콘솔의 "[share] 한글 자폭(em)"로 기기별 값을 확인할 수 있다.
const TARGET_ADVANCE = 0.92;
const MAX_SCALE = 1.12;

/** 캡처(!responsive)에서만 측정. 줄이지 않고 키우기만 한다(이미 넓은 기기는 1). */
export function useKoreanAdvanceScale(enabled: boolean): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const measure = () => {
      const span = document.createElement("span");
      span.textContent = "가".repeat(20);
      span.style.cssText =
        "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:100px;line-height:1;";
      document.body.appendChild(span);
      const advance = span.getBoundingClientRect().width / 2000;
      document.body.removeChild(span);
      if (process.env.NODE_ENV !== "production") console.info("[share] 한글 자폭(em)", advance.toFixed(4));
      if (advance > 0) setScale(Math.min(MAX_SCALE, Math.max(1, TARGET_ADVANCE / advance)));
    };
    measure();
    void document.fonts?.ready.then(measure);
  }, [enabled]);
  return scale;
}
