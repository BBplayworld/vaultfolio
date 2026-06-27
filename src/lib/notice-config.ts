// 공지 설정은 단일 환경변수 NEXT_PUBLIC_NOTICE에 JSON으로 관리
// 예: {"enabled":true,"expiresAt":"2026-07-10T00:00:00+09:00"}
interface NoticeEnv {
  enabled?: boolean;
  expiresAt?: string;
}

export function getNoticeWindow(): { expiresAt: number } | null {
  const raw = process.env.NEXT_PUBLIC_NOTICE?.trim();
  if (!raw) return null;

  let parsed: NoticeEnv;
  try {
    parsed = JSON.parse(raw) as NoticeEnv;
  } catch {
    return null;
  }

  if (parsed.enabled !== true) return null;

  const expiresRaw = parsed.expiresAt?.trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : Infinity;
  if (Number.isNaN(expiresAt)) return null;
  if (expiresAt !== Infinity && expiresAt <= Date.now()) return null;

  return {
    expiresAt: expiresAt === Infinity ? Number.MAX_SAFE_INTEGER : expiresAt,
  };
}
