// 앱 버전 — 설정 화면 표기용.
// 빌드 시 next.config.mjs가 git 브랜치(issue-{버전})에서 자동 주입(NEXT_PUBLIC_APP_VERSION).
// git이 없거나 브랜치가 패턴에 안 맞으면 아래 폴백 값 사용(릴리스 시 함께 올린다).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "4.18";
