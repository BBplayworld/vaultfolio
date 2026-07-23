"use client";

import { useCallback, useRef } from "react";

// 다음(카카오) 우편번호 서비스 — 주소 정확 입력용.
// API 키·쿼터 없이 무료로 쓸 수 있고, 법정동코드(sigunguCode/bcode)까지 내려주므로
// 카카오 로컬 주소검색(resolveAddress) 재해석 없이 실거래가 조회에 바로 쓸 수 있다.
// 오프라인 우선 앱이라 스크립트는 "검색 버튼을 누른 시점"에만 1회 로드하고,
// 실패 시 false를 돌려 호출측이 직접 입력 경로로 graceful degrade 하도록 한다.

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export interface DaumPostcodeResult {
  roadAddress: string;       // 도로명주소
  jibunAddress: string;      // 지번주소
  buildingName: string;      // 건물명(단지명)
  bname: string;             // 법정동명
  sigunguCode: string;       // 법정동코드 시군구 5자리 = MOLIT LAWD_CD
  bcode: string;             // 법정동코드 10자리
  apartment: "Y" | "N";      // 공동주택 여부
  zonecode: string;          // 우편번호
}

interface PostcodeInstance {
  open: () => void;
  embed: (el: HTMLElement, opts?: { autoClose?: boolean }) => void;
}
interface PostcodeOptions {
  oncomplete: (data: DaumPostcodeResult) => void;
  onclose?: (state: string) => void;
  width?: string;
  height?: string;
}
interface DaumPostcodeGlobal {
  daum?: { Postcode: new (opts: PostcodeOptions) => PostcodeInstance };
}

function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const w = window as unknown as DaumPostcodeGlobal;
  if (w.daum?.Postcode) return Promise.resolve(true);

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    // 이미 주입됐지만 아직 로드 중 — 완료를 기다린다
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(!!w.daum?.Postcode), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(!!w.daum?.Postcode);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function useDaumPostcode() {
  const busyRef = useRef(false);

  // 앱 다이얼로그 안에 검색 UI를 그대로 심는다(별도 브라우저 팝업 없음).
  // 스크립트 로드 실패(오프라인·차단)면 false → 호출측이 수동 입력 안내.
  const embedPostcode = useCallback(async (
    container: HTMLElement,
    onComplete: (data: DaumPostcodeResult) => void,
  ): Promise<boolean> => {
    if (busyRef.current) return true; // 중복 실행 방지
    busyRef.current = true;
    try {
      const ok = await loadScript();
      if (!ok) return false;
      const w = window as unknown as DaumPostcodeGlobal;
      if (!w.daum?.Postcode) return false;
      // StrictMode 이중 실행·재열기 시 중복 삽입 방지
      container.innerHTML = "";
      new w.daum.Postcode({
        oncomplete: (data) => onComplete(data),
        width: "100%",
        height: "100%",
      }).embed(container, { autoClose: false }); // 닫기는 앱이 직접 제어
      return true;
    } catch {
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  return { embedPostcode };
}

// 지번주소 문자열 말미의 번지 추출 — "서울 서초구 서초동 1362-10" → "1362-10"
// MOLIT 매칭에 쓰는 지번(jibun) 확보용.
// 마지막 토큰만 떼어 검사한다(백트래킹 없는 앵커드 패턴 — ReDoS 안전).
export function extractJibun(jibunAddress: string): string | undefined {
  const last = jibunAddress.trim().split(/\s+/).pop() ?? "";
  const parts = last.split("-");           // "1362-10" → ["1362","10"] / "1362" → ["1362"]
  if (parts.length > 2) return undefined;
  const isDigits = (s: string) => s.length > 0 && /^\d+$/.test(s);
  return parts.every(isDigits) ? last : undefined;
}
