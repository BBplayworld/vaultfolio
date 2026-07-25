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
