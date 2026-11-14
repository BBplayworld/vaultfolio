const CACHE_NAME = "secretasset-cache-v5";
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

// 알림(#179, 4.91) — 페이로드 {m,t,b} 3필드만. 파싱 실패·형식 이상이면 중립 폴백 문구.
// 종류별 같은 tag로 교체(쌓이지 않음). 누르면 종류에 맞는 화면으로 바로 연다(아침·국내→홈 '오늘' 카드, 결산→월 결산, 세금→세금 관리, C80).
// 알림 안에 보유 정보는 없다(서버가 모름).
const PUSH_FALLBACK = { t: "시크릿에셋", b: "새 알림이 도착했어요" };
const PUSH_TAGS = { morning: "push-morning", kr: "push-kr", settle: "push-settle", tax: "push-tax", test: "push-test", misc: "push-misc" };
const PUSH_URLS = {
  morning: "/?from=push&t=morning",
  kr: "/?from=push&t=kr",
  settle: "/?from=push&t=settle",
  tax: "/?from=push&t=tax",
};

function parsePushPayload(event) {
  try {
    const d = event.data ? event.data.json() : null;
    if (d && typeof d.t === "string" && typeof d.b === "string" && d.t && d.b) {
      return { m: PUSH_TAGS[d.m] ? d.m : "misc", t: d.t, b: d.b };
    }
  } catch (e) {
    // 형식 이상 — 폴백
  }
  return { m: "misc", t: PUSH_FALLBACK.t, b: PUSH_FALLBACK.b };
}

self.addEventListener("push", (event) => {
  const p = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(p.t, {
      body: p.b,
      tag: PUSH_TAGS[p.m],
      renotify: false,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: PUSH_URLS[p.m] || "/?from=push" },
    }),
  );
});

// 알림 누름 — 같은 origin 창이 열려 있으면 focus 후 도착 화면 주소로 이동, 없으면 그 주소로 연다
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/?from=push";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => w.url && w.url.indexOf(self.location.origin) === 0);
      if (same && "focus" in same) {
        return Promise.resolve(same.focus()).then((c) => (c && "navigate" in c ? c.navigate(url) : c));
      }
      return self.clients.openWindow(url);
    }),
  );
});
