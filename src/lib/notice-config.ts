export interface NoticeItem {
  headline: string;
  description?: string;
  image?: string; // Vercel Blob 파일명 stem (확장자 제외)
}

export interface NoticeConfig {
  id: string;
  expiresAt: number;
  title: string;
  items: NoticeItem[];
}

// 공지 설정은 단일 환경변수 NEXT_PUBLIC_NOTICE에 JSON으로 관리
// 예: {"enabled":true,"id":"2026-06-01","expiresAt":"2026-06-15T00:00:00+09:00","title":"...","items":[{"headline":"...","description":"...","image":"..."}]}
interface NoticeEnv {
  enabled?: boolean;
  id?: string;
  expiresAt?: string;
  title?: string;
  items?: Array<{ headline?: string; description?: string; image?: string }>;
  body?: string; // 하위 호환
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

  // items 배열 파싱 (하위 호환: body 문자열 → items 자동 변환)
  let items: NoticeItem[] = [];
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    items = parsed.items
      .filter((it) => it.headline?.trim())
      .map((it) => {
        const item: NoticeItem = { headline: it.headline!.trim() };
        if (it.description?.trim()) item.description = it.description.trim();
        if (it.image?.trim()) item.image = it.image.trim();
        return item;
      });
  } else if (parsed.body?.trim()) {
    items = parsed.body.split("#").filter(Boolean).map((line) => ({ headline: line.trim() }));
  }

  if (items.length === 0) return null;

  return { id, expiresAt: expiresAt === Infinity ? Number.MAX_SAFE_INTEGER : expiresAt, title, items };
}
