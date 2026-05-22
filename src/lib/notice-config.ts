export interface NoticeConfig {
  id: string;
  expiresAt: number;
  title: string;
  body: string;
}

// 공지 설정은 단일 환경변수 NEXT_PUBLIC_NOTICE에 JSON으로 관리
// 예: {"enabled":true,"id":"2026-05-15","expiresAt":"2026-05-30T00:00:00+09:00","title":"...","body":"#a#b#c"}
interface NoticeEnv {
  enabled?: boolean;
  id?: string;
  expiresAt?: string;
  title?: string;
  body?: string;
}

export function getNoticeConfig(): NoticeConfig | null {
  const raw = process.env.NEXT_PUBLIC_NOTICE?.trim();
  if (!raw) return null;

  let parsed: NoticeEnv;
  try {
    parsed = JSON.parse(raw) as NoticeEnv;
  } catch {
    return null;
  }

  if (parsed.enabled !== true) return null;

  const id = parsed.id?.trim();
  if (!id) return null;

  const expiresRaw = parsed.expiresAt?.trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : Infinity;
  if (Number.isNaN(expiresAt)) return null;
  if (expiresAt !== Infinity && expiresAt <= Date.now()) return null;

  const title = parsed.title?.trim() ?? "";
  const body = parsed.body?.trim() ?? "";

  return { id, expiresAt: expiresAt === Infinity ? Number.MAX_SAFE_INTEGER : expiresAt, title, body };
}
