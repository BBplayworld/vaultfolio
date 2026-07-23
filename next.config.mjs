import { execSync } from "node:child_process";

// 빌드 시 앱 버전 자동 추출 — git 브랜치(issue-4.18-award)에서 4.18 파싱.
// Vercel 등 detached HEAD 환경은 VERCEL_GIT_COMMIT_REF 폴백. 실패 시 빈 문자열(app-version.ts가 하드코딩 폴백).
function resolveAppVersion() {
  let ref = process.env.VERCEL_GIT_COMMIT_REF || "";
  if (!ref) {
    try {
      ref = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    } catch {
      ref = "";
    }
  }
  const m = ref.match(/issue-(\d+\.\d+)/i);
  return m ? m[1] : "";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
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
