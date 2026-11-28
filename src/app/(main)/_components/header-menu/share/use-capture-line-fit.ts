import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// 설명 강조어 조각 나누기 — share-card 렌더(renderDescriptionWithHighlights)와 캡처 줄 폭 실측(useCaptureLineFit)이 함께 쓴다(같은 strong 구조로 재야 폭이 같다).
export const HIGHLIGHT_CLASS = "font-semibold text-foreground";
export function splitHighlightParts(text: string, terms: string[]): { text: string; strong: boolean }[] {
  if (terms.length === 0) return [{ text, strong: false }];
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  return text.split(re).map((part) => ({ text: part, strong: terms.includes(part) }));
}

// 캡처 긴 문장 한 줄 판정 여유(px) — 실측 nowrap 폭이 `블록 폭 − 한 글자(17px)` 이하일 때만 한 줄로 둔다.
// 경계(0~4px)에서는 DOM과 html-to-image의 접힘이 달라 꼬리 줄이 생기므로 여유 안에 들면 2줄로 보낸다(#373, 5.182)
export const DESC_FIT_SLACK_PX = 17;

/** 한 줄 판정 — 실측 nowrap 폭 w가 블록 폭 − 여유(17px) 이하일 때만 true. 0·NaN(측정 실패)은 false(2줄 폴백) */
export function fitsOneLine(w: number, blockW: number, slack = DESC_FIT_SLACK_PX): boolean {
  return Number.isFinite(w) && Number.isFinite(blockW) && blockW > 0 && w > 0 && w <= blockW - slack;
}

/**
 * 설명 블록 el 안에서 긴 묶음마다 nowrap 폭을 재 한 줄 여부를 돌려준다. 블록 폭은 el에 잠시 width:100%를 줘
 * max-w(82%) 상한 그대로 잰다(평소 el은 mx-auto라 가장 긴 줄 폭으로 줄어 있다). 줄 폭은 el 글꼴을 상속한 숨김
 * nowrap span으로 재며 강조어는 렌더와 같은 strong 클래스로 넣는다. 끝나면 width·span을 즉시 되돌린다.
 * 예외가 나면 전부 false(2줄 폴백).
 */
export function measureLongLineFit(el: HTMLElement, longLines: string[], terms: string[]): boolean[] {
  const doc = el.ownerDocument;
  const prevWidth = el.style.width;
  let probe: HTMLSpanElement | null = null;
  try {
    el.style.width = "100%";
    const blockW = el.getBoundingClientRect().width;
    el.style.width = prevWidth;
    probe = doc.createElement("span");
    probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;";
    el.appendChild(probe);
    const span = probe;
    return longLines.map((line) => {
      span.textContent = "";
      for (const part of splitHighlightParts(line, terms)) {
        if (part.strong) {
          const strong = doc.createElement("strong");
          strong.className = HIGHLIGHT_CLASS;
          strong.textContent = part.text;
          span.appendChild(strong);
        } else span.appendChild(doc.createTextNode(part.text));
      }
      return fitsOneLine(span.getBoundingClientRect().width, blockW);
    });
  } catch {
    return longLines.map(() => false);
  } finally {
    el.style.width = prevWidth;
    probe?.remove();
  }
}

/**
 * 캡처 설명의 targetChars 초과 묶음이 한 줄에 들어가는지 실측한다(#373, 5.182).
 * 시점: document.fonts.ready 뒤 useLayoutEffect(커밋 직후·페인트 전이라 판정 전 줄 구조가 캡처에 섞이지 않는다).
 * 측정은 measureLongLineFit.
 * 반환 single[k] = k번째 긴 묶음을 한 줄로 그릴지. 판정 전·측정 실패는 false(= 2줄 분할 폴백, 넘침 0이 보장되는 쪽).
 * ready = 판정 완료(긴 묶음이 없거나 측정 끝) — 캡처는 이 값이 설명 블록 data-desc-fit에 반영된 뒤에만 한다.
 */
export function useCaptureLineFit(
  ref: RefObject<HTMLDivElement | null>,
  longLines: string[],
  terms: string[],
  enabled: boolean,
  fontPx: number,
): { single: boolean[] | null; ready: boolean } {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    if (!enabled || fontsReady) return;
    let alive = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts?.ready) {
      setFontsReady(true);
      return;
    }
    const done = () => {
      if (alive) setFontsReady(true);
    };
    fonts.ready.then(done, done);
    return () => {
      alive = false;
    };
  }, [enabled, fontsReady]);
  const key = `${fontPx}\u0001${terms.join("\u0002")}\u0001${longLines.join("\u0002")}`;
  const [fit, setFit] = useState<{ key: string; single: boolean[] } | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !fontsReady || longLines.length === 0) return;
    const el = ref.current;
    setFit({ key, single: el ? measureLongLineFit(el, longLines, terms) : longLines.map(() => false) });
  }, [enabled, fontsReady, key, longLines, terms, ref]);
  if (!enabled || longLines.length === 0) return { single: null, ready: true };
  const current = fit?.key === key ? fit.single : null;
  return { single: current, ready: current !== null };
}

