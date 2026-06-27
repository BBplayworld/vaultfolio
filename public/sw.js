const CACHE_NAME = "secretasset-cache-v4";
const PRECACHE_URLS = ["/", "/favicon.ico", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

// 서비스 워커 설치 및 프리캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()),
  );
});

// 활성화 시 오래된 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch 가로채기 — Network-First 전면 (온라인이면 항상 최신 = 신규 웹 접속과 동일)
// 캐시는 오직 오프라인 폴백 용도로만 사용한다 (SWR/Cache-First 미사용).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API·데이터·HMR 등은 가로채지 않고 네트워크 직행
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/_next/webpack-hmr") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return;
  }

  // 불변 해시 자산(_next/static, icons, 폰트): URL이 콘텐츠 해시라 안전 → 브라우저 캐시 활용 가능
  const isImmutable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com");

  // 페이지(HTML)·RSC 등 동적 자산: HTTP 캐시까지 무시(no-store)하고 항상 최신
  const fetchOptions = isImmutable ? undefined : { cache: "no-store" };

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then((networkResponse) => {
        // 성공 응답은 오프라인 폴백용으로만 캐시 갱신
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() =>
        // 네트워크 실패(오프라인) 시에만 캐시 폴백, 없으면 홈(/)
        caches.match(event.request).then((cached) => cached || caches.match("/")),
      ),
  );
});
