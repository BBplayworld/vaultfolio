const CACHE_NAME = "secretasset-cache-v2";
const PRECACHE_URLS = [
  "/",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// 서비스 워커 설치 및 프리캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 활성화 시 오래된 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch 가로채기 (오프라인 캐싱)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API 요청이나 핫 리로드(development) 웹소켓 등은 캐시하지 않음
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/_next/webpack-hmr") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return;
  }

  // 1. static 리소스 (JS, CSS, 폰트, 이미지 등) -> Cache First / Stale-While-Revalidate
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.includes("fonts.gstatic.com") ||
    url.pathname.includes("fonts.googleapis.com") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico");

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // 캐시된 버전을 반환하되, 백그라운드에서 신규 버전을 가져와 캐시를 업데이트함
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => { /* 백그라운드 fetch 에러 무시 */ });
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  } else {
    // 2. 페이지 요청 (e.g. /) -> Network First, Fallback to Cache
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시된 페이지 반환 (특히 / 페이지)
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // 만약 해시가 변경된 형태(/#vault=...)라면 / 매칭을 시도
            if (url.pathname === "/") {
              return caches.match("/");
            }
            return caches.match("/"); // 기본값으로 홈 또는 자산 페이지 반환
          });
        })
    );
  }
});
