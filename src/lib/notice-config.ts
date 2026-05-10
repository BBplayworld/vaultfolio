export interface NoticeConfig {
  id: string;
  expiresAt: number;
  title: string;
  body: string;
}

export function getNoticeConfig(): NoticeConfig | null {
  if (process.env.NEXT_PUBLIC_NOTICE_ENABLED !== "true") return null;

  const id = process.env.NEXT_PUBLIC_NOTICE_ID?.trim();
  if (!id) return null;

  const expiresRaw = process.env.NEXT_PUBLIC_NOTICE_EXPIRES_AT?.trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : Infinity;
  if (Number.isNaN(expiresAt)) return null;
  if (expiresAt !== Infinity && expiresAt <= Date.now()) return null;

  const title = process.env.NEXT_PUBLIC_NOTICE_TITLE?.trim() ?? "";
  const body = process.env.NEXT_PUBLIC_NOTICE_BODY?.trim() ?? "";

  return { id, expiresAt: expiresAt === Infinity ? Number.MAX_SAFE_INTEGER : expiresAt, title, body };
}
