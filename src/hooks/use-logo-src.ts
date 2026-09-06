"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveLogoSrc, type LogoSourceOptions } from "@/lib/finance/logo-source";

/**
 * 기업 로고 `<img>` src + 유한 재시도.
 *
 * `resolveLogoSrc`(단일 출처)로 URL을 만들고, 로드 실패 시 지수 백오프로 최대 3회 재시도한다.
 * 과거 `BrandMark`/`StockIcon`은 `imgError` state가 한 번 true가 되면 영구히 폴백으로 굳어,
 * 모바일 WebView의 1회성 디코드 실패에도 인증카드 캡처에서 로고가 통째로 빠졌다(2026-09).
 *
 * - `imgProps`: `<img {...imgProps}>`로 스프레드. `null`이면 로고 없음(URL 없음) 또는 재시도 소진.
 * - `failed`: URL은 있으나 재시도까지 모두 실패 — 호출부가 이니셜 등 폴백을 그릴 신호.
 * - 재시도 URL엔 캐시버스터 `&r=N`만 붙는다. `/api/logo` route는 이 파라미터를 파싱하지 않으므로
 *   서버 캐시 키는 불변(HIT 유지)이고, 무력화 대상은 브라우저 HTTP 캐시뿐이다.
 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400; // 400 → 800 → 1600

export interface UseLogoSrcResult {
  src: string | null;
  failed: boolean;
  /** `<img key={imgProps.src} {...imgProps} />` — key로 재시도 시 강제 리마운트 */
  imgProps: { src: string; onError: () => void; onLoad: () => void } | null;
}

export function useLogoSrc(
  ticker: string,
  name: string,
  isForeign: boolean,
  opts?: LogoSourceOptions,
): UseLogoSrcResult {
  const base = resolveLogoSrc(ticker, name, isForeign, opts); // 순수·동기 — 값이 같으면 참조 무관
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 종목·옵션(=base URL)이 바뀌면 재시도 상태 초기화
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [base]);
  // 언마운트 시 대기 중 타이머 정리(다이얼로그 여닫기 반복 시 유령 setState 방지)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onError = useCallback(() => {
    setAttempt((a) => {
      if (a >= MAX_RETRIES) {
        setFailed(true);
        return a;
      }
      timer.current = setTimeout(() => setAttempt(a + 1), BASE_DELAY_MS * 2 ** a);
      return a;
    });
  }, []);

  const onLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!base || failed) {
    return { src: null, failed: !!base && failed, imgProps: null };
  }
  const src = attempt === 0 ? base : `${base}&r=${attempt}`;
  return { src, failed: false, imgProps: { src, onError, onLoad } };
}
