/**
 * 애플리케이션 기본 설정
 */

import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  // 사용자에게 노출되는 브랜드명은 한글 "시크릿에셋"으로 통일한다.
  // (영문 secretasset은 도메인·저장소 키·파일명 등 기술 식별자에만 남긴다)
  name: "시크릿에셋",
  version: packageJson.version,
  copyright: `© ${currentYear}, 시크릿에셋.`,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://secretasset.xyz",
  meta: {
    title: "시크릿에셋 — 안전하게 보관되는 오프라인 자산 관리 시스템",
    description:
      "시크릿에셋은 로그인 없이 브라우저 안에서 안전하게 자산을 관리하는 개인 자산 금고입니다. 부동산, 주식, 암호화폐, 대출까지 한눈에 정리하고 AI 기반 분석으로 내 자산 흐름을 쉽게 파악하세요.",
    keywords: [
      "자산관리", "개인자산관리", "순자산", "자산추적", "포트폴리오",
      "부동산관리", "주식관리", "암호화폐관리", "대출관리", "현금자산",
      "오프라인 자산관리", "프라이버시 자산관리", "로그인없이 자산관리",
      // 검색어는 표시용 브랜드가 아니므로 한/영 표기를 모두 남긴다(영문 검색 유입 유지)
      "자산 금고", "자산 현황", "시크릿에셋", "SecretAsset", "안전한 자산 관리",
    ],
  },
} as const;
