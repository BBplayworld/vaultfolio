import { ShieldCheck } from "lucide-react";

// 웰컴 첫 부분(히어로·신뢰 한 줄) 공용 조각 — 훅·window 없음, 서버/클라이언트 첫 렌더 동일(#113).
// WelcomeGuide와 루트 첫 화면 사전 조각(RootFirstPaint)이 같은 코드를 렌더해 위치·글자가 구조적으로 일치한다.

// 진입 stagger 공용 클래스 (모션 비활성 환경에선 즉시 표시) — delay는 style로 분산
export const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500";

/** page 웰컴 분기 래퍼 / WelcomeGuide 루트 / 신뢰 줄 래퍼 클래스 — 조각과 웰컴 완성 화면이 같은 값을 쓴다 */
export const WELCOME_PAGE_WRAP = "flex flex-col gap-4 md:gap-6";
export const WELCOME_ROOT = "w-full py-2 space-y-5";
export const WELCOME_TRUST_WRAP = "w-full flex flex-col items-center";

/** 사전 조각이 실제로 보였는지(마운트 시점 판정) — 로드 전 첫 렌더이고 보유자 숨김 속성이 없을 때만 true.
 *  키만 남은 0건 기기는 조각이 숨겨졌으므로 false(웰컴 ENTER 유지) */
export function shouldSkipHeroEnter(env: { isDataLoaded: boolean; hasAssetsAttr: boolean }): boolean {
  return !env.isDataLoaded && !env.hasAssetsAttr;
}

/** ① 히어로 — enter=false면 진입 애니메이션 없음(사전 조각 직후 웰컴·조각 자체) */
export function WelcomeHero({ enter }: { enter: boolean }) {
  return (
    <section data-testid="welcome-hero" className={`text-center space-y-2${enter ? ` ${ENTER}` : ""}`}>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
        나만의 비밀 자산 금고
      </h1>
      <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed text-pretty break-keep">
        흩어진 자산을 한 화면에서 정리해 보세요.
      </p>
    </section>
  );
}

/** ② 신뢰 한 줄(아이콘 + 3항목) — 래퍼(data-testid="welcome-trust")는 호출처가 WELCOME_TRUST_WRAP으로 둔다 */
export function WelcomeTrustLine() {
  return (
    <p className="max-w-xl text-sm text-muted-foreground leading-relaxed text-center">
      <ShieldCheck aria-hidden className="inline size-4 -mt-0.5 mr-1.5 text-primary" />
      {/* 구분자를 앞 항목과 한 덩어리로 묶어 줄바꿈은 구분자 뒤에서만 일어나게 */}
      <span className="whitespace-nowrap">로그인 없음<span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span></span>
      <span className="whitespace-nowrap">자산은 내 기기에 저장<span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span></span>
      <span className="whitespace-nowrap">원하면 암호화 동기화</span>
    </p>
  );
}

/** 루트 `/` 데이터 로드 전 정적 사전 조각 — 0건 방문자·수집기가 첫 HTML에서 읽는다. html[data-has-assets]이면 CSS로 숨김 */
export function RootFirstPaint() {
  return (
    <div data-first-paint data-testid="first-paint-shell" className={WELCOME_PAGE_WRAP}>
      <div className={WELCOME_ROOT}>
        <WelcomeHero enter={false} />
        <div data-testid="welcome-trust" className={WELCOME_TRUST_WRAP}>
          <WelcomeTrustLine />
        </div>
      </div>
    </div>
  );
}
