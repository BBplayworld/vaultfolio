import "server-only";

import { cookies } from "next/headers";

// 서버 컴포넌트 전용 쿠키 조회 — "use server"(공개 Server Action 엔드포인트)가 아닌 일반 서버 유틸.
// allowlist 밖 값은 fallback으로 대체한다.
export async function getPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): Promise<T> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(key);
  const value = cookie ? cookie.value.trim() : undefined;
  return allowed.includes(value as T) ? (value as T) : fallback;
}
