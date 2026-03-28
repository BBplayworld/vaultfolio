/**
 * 애플리케이션 기본 설정
 */

import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "SecretAsset",
  version: packageJson.version,
  copyright: `© ${currentYear}, SecretAsset.`,
  meta: {
    title: "SecretAsset — 안전하게 보관되는 오프라인 자산 관리 시스템",
    description:
      "SecretAsset는 로그인 없이 브라우저 안에서 안전하게 자산을 관리하는 개인 자산 금고입니다. 부동산, 주식, 암호화폐, 대출까지 한눈에 정리하고 AI 기반 분석으로 내 자산 흐름을 쉽게 파악하세요.",
  },
} as const;
