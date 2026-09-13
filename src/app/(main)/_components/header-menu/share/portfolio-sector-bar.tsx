"use client";

// 인증카드 "포트폴리오" 타입 하단 — 범용 비중 분포 막대바. 금액 없이 항목명 + 비중%만.
// "분야 구성"(computeBreakdown("theme", ...))과 "보유 유형 구성"(stock.category) 두 곳에서
// 같은 컴포넌트를 재사용한다(캡션은 title prop). 데이터는 ShareCard가 만들어 주입.
// 캡처(big=true) 전용 값은 뷰포트 반응형 클래스 금지(고정 px, R32) — 프리뷰(!big)는 화면
// 표시일 뿐 저장 PNG에 안 쓰이므로 `sm:`이 안전하다(theme.ts의 ASSET_THEME_SHOT과 동일 원칙).

export interface SectorBarItem {
  key: string;
  label: string; // 분야 메인 제목만 (개별 종목 서브 항목 없음)
  pct: number;
  color: string; // 막대 구간 fill — 범례 % 텍스트에도 같은 색을 쓴다
}

export function PortfolioSectorBar({ title, items, big = false }: { title: string; items: SectorBarItem[]; big?: boolean }) {
  if (items.length === 0) return null;
  // big = 캡처(저장 PNG) 전용 — 680px 아트보드에서 프리뷰 비율을 내려고 텍스트/막대를 ×SHOT_BIG_SCALE(1.46)
  // 프리뷰(!big)는 나머지 인증카드 본문(ASSET_THEME_SHOT.bodyText 등)과 같은 640px 기준으로
  // PC에서 한 단계 확대(2026-09 — 이 컴포넌트만 누락돼 있었음).
  const txt = big ? "text-[20px]" : "text-xs sm:text-sm";
  const dot = big ? "size-[15px]" : "size-2.5";
  const barH = big ? "h-[15px]" : "h-2.5";
  return (
    <div className="space-y-2.5">
      <p className={`${txt} font-semibold text-muted-foreground`}>{title}</p>
      <div className={`flex ${barH} w-full rounded-full overflow-hidden gap-px`}>
        {items.map((it) => (
          <div key={it.key} style={{ width: `${it.pct}%`, backgroundColor: it.color }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-1.5 min-w-0">
            <span className={`${dot} rounded-full shrink-0`} style={{ backgroundColor: it.color }} />
            <span className={`flex-1 min-w-0 truncate ${txt} text-foreground`}>{it.label}</span>
            <span className={`shrink-0 ${txt} font-bold tabular-nums`} style={{ color: it.color }}>
              {it.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
