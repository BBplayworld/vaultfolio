// /ratio·/guide/<slug> 유입 캠페인(UTM) 허용 목록 — GA page_location에 안전한 3개 키만 붙인다(#63).
// 값은 영숫자·점·밑줄·하이픈 1~50자만 허용하고 그 밖의 쿼리·해시는 버린다.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const GUIDE_PATH_RE = /^\/guide\/[a-z0-9-]+$/;
const UTM_VALUE_RE = /^[A-Za-z0-9._-]{1,50}$/;

/** pathname이 /ratio 또는 /guide/<slug>(말미 슬래시 허용)일 때만 허용 UTM 쿼리("?a=b&…")를, 아니면 ""를 반환 */
export function allowedUtmQuery(pathname: string | undefined, search: string | undefined): string {
  if (typeof pathname !== "string") return "";
  const path = pathname.replace(/\/$/, "");
  if (path !== "/ratio" && !GUIDE_PATH_RE.test(path)) return "";
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search ?? "");
  } catch {
    return "";
  }
  const parts: string[] = [];
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v !== null && UTM_VALUE_RE.test(v)) parts.push(`${key}=${v}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}
