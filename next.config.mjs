import { execSync } from "node:child_process";

// 빌드 시 앱 버전 자동 추출 — 다단계 폴백. 실패 시 빈 문자열(app-version.ts가 하드코딩 폴백).
// main 병합 후 배포는 브랜치명이 issue-X.Y가 아니라, 커밋 메시지 컨벤션 [#X.Y]로 보완한다.
function resolveAppVersion() {
  // 1) 브랜치 ref(issue-X.Y) — preview·issue 브랜치 배포/로컬. Vercel은 detached HEAD라 VERCEL_GIT_COMMIT_REF 우선.
  let ref = process.env.VERCEL_GIT_COMMIT_REF || "";
  if (!ref) {
    try {
      ref = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    } catch {
      ref = "";
    }
  }
  const branchMatch = ref.match(/issue-(\d+\.\d+)/i);
  if (branchMatch) return branchMatch[1];

  // 2) 배포 커밋 메시지(env, [#X.Y]) — Vercel이 제공. main 병합 배포 커버.
  const envMsgMatch = (process.env.VERCEL_GIT_COMMIT_MESSAGE || "").match(/\[#(\d+\.\d+)\]/);
  if (envMsgMatch) return envMsgMatch[1];

  // 3) 최근 커밋 메시지 스캔([#X.Y]) — main tip이 merge 커밋(패턴 없음)이어도 병합된 issue 커밋에서 최근값 추출.
  try {
    const log = execSync("git log --pretty=%B -n 30", { encoding: "utf8" });
    const logMatch = log.match(/\[#(\d+\.\d+)\]/);
    if (logMatch) return logMatch[1];
  } catch {
    // git 미가용 → 폴백
  }

  return "";
}

// ── 보안 헤더 ──
// CSP는 1차로 Report-Only 배포(차단 없이 브라우저 콘솔에 위반만 보고) — 라이브 검증 없이 enforce하면
// 서드파티(GA·우편번호) 동작이 깨질 수 있어, 위반 확인 후 Content-Security-Policy로 전환한다.
const isDev = process.env.NODE_ENV !== "production";
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 인라인 스크립트(GA 초기화·SW 등록·테마) 5개 — 이후 nonce 전환 대상. dev는 HMR용 eval 허용
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://t1.daumcdn.net https://*.daumcdn.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self' data:",
  // 외부 전송 허용 목록 — 서드파티 스크립트가 침해돼도 localStorage 자산을 임의 도메인으로 보내지 못하게
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src https://*.daum.net https://*.daumcdn.net",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP_DIRECTIVES },
  // iframe 임베드 차단 — 타 사이트가 #share/#sync URL을 iframe으로 띄워 자동 트리거·클릭재킹하는 것 방지
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 응답 헤더로 프레임워크 노출 안 함
  poweredByHeader: false,
  // next/image 미사용 — 이미지 최적화 엔드포인트(/_next/image) 비활성화로 공개 표면·관련 CVE 노출 제거
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // 월말 결산 반복 일정(.ics) — iOS 서드파티 브라우저·인앱이 캘린더 앱으로 넘기도록 같은 출처 URL + text/calendar(C19)
      {
        source: "/calendar/:file*",
        headers: [
          { key: "Content-Type", value: "text/calendar; charset=utf-8" },
          { key: "Content-Disposition", value: 'inline; filename="secretasset-monthly-settlement.ics"' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
    // preview 판별용(isPreviewEnv) — Vercel 시스템 변수. 로컬은 빈 문자열이라 운영과 같이 취급
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/asset",
        permanent: false,
      },
    ];
  },
}

export default nextConfig
