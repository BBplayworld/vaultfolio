"use client";

/**
 * PWA 공유→홈 화면 추가 단계 SVG 일러스트.
 * 외부 이미지·실제 로고 없이 인라인 SVG로 각 브라우저의 실제 UI 형태를 정밀하게 묘사.
 * 다크모드는 테마 토큰(currentColor 계열)으로 대응, 강조는 --brand(MAIN_PALETTE[0]).
 *
 * - IosShareStep / IosChromeShareStep / IosWhaleShareStep : iOS Safari·크롬·웨일
 *   (공통 흐름: 주소 옆 메뉴 → 공유 → IosAddToHomeStep 의 '홈 화면에 추가')
 * - ChromeMenuStep                  : Android 크롬·웨일 (⋮ 상단 메뉴)
 * - SamsungMenuStep                 : 삼성 인터넷 (☰ 하단 메뉴)
 */

import { useEffect, useMemo, useState, type FC } from "react";
import { Play, Pause } from "lucide-react";

import { APP_CONFIG } from "@/config/app";
import type { GuidePlatform, GuideBrowser } from "@/lib/pwa/detect-browser";

const BRAND = "#5b6fbf"; // MAIN_PALETTE[0]
const ACCENT = "#37a98e"; // 새 기기 구분용 보조 색(teal) — "다른 기기" 인식 강화
const DOMAIN = APP_CONFIG.siteUrl.replace(/^https?:\/\//, ""); // "secretasset.xyz"

// 다크/라이트 모드 대응 컬러 토큰 클래스
const FRAME = "text-border/80 dark:text-border/30";
const SURFACE = "text-muted/60 dark:text-muted/20";
const LINE = "text-muted-foreground/20 dark:text-muted-foreground/15";
const HINT = "text-muted-foreground/45 dark:text-muted-foreground/30";

interface IllustrationProps {
  className?: string;
}

/** 
 * 공용 세로형 스마트폰 외곽 프레임 
 * viewBox="0 0 220 290" 에 최적화된 세련된 베젤리스 폰 묘사
 */
function PhoneFrame({ accent }: { accent?: string }) {
  return (
    <>
      {/* 폰 그림자 및 배경 */}
      <rect x="35" y="10" width="150" height="270" rx="24" className="text-background" fill="currentColor" />
      <rect x="35" y="10" width="150" height="270" rx="24" className={SURFACE} fill="currentColor" opacity="0.1" />
      {/* accent: 베젤 안쪽 강조색 틴트 (다른 기기/앱 구분) */}
      {accent && <rect x="35" y="10" width="150" height="270" rx="24" fill={accent} opacity="0.06" />}
      {/* 폰 테두리 — accent 지정 시 강조색으로 '다른 기기/앱' 강조 */}
      {accent ? (
        <rect x="35" y="10" width="150" height="270" rx="24" stroke={accent} strokeWidth="3.5" fill="none" />
      ) : (
        <rect x="35" y="10" width="150" height="270" rx="24" stroke="currentColor" className={FRAME} strokeWidth="3.5" fill="none" />
      )}
      {/* 액정 화면 내부 경계 (베젤 안쪽) */}
      <rect x="39" y="14" width="142" height="262" rx="20" stroke={accent ?? "currentColor"} className={accent ? undefined : FRAME} strokeWidth="1.2" fill="none" opacity="0.5" />
      {/* 상단 다이내믹 아일랜드 (카메라/센서부) */}
      <rect x="90" y="18" width="40" height="8" rx="4" fill="currentColor" className="text-foreground/80 dark:text-foreground/60" />
      <circle cx="110" cy="22" r="2.5" fill="currentColor" className="text-foreground/40 dark:text-foreground/20" />
      {/* 하단 iOS 홈 인디케이터 바 */}
      <rect x="85" y="268" width="50" height="3" rx="1.5" fill="currentColor" className="text-foreground/30 dark:text-foreground/20" />
    </>
  );
}

/** 화면 구분 배지 — 좌측 상단 라벨. 기본 "새 기기"(teal, 동기화=다른 기기). PWA 설치는 "앱 (PWA)"(brand, 같은 기기의 설치 앱). */
function DeviceBadge({ label = "새 기기", color = ACCENT, width = 40 }: { label?: string; color?: string; width?: number }) {
  return (
    <g>
      <rect x="47" y="31" width={width} height="13" rx="6.5" fill={color} opacity="0.16" />
      <rect x="47" y="31" width={width} height="13" rx="6.5" stroke={color} strokeWidth="0.8" />
      <circle cx="55" cy="37.5" r="2" fill={color} />
      <text x="61" y="40" fontSize="6.3" fontWeight="800" fill={color}>{label}</text>
    </g>
  );
}

/** iOS Safari 1단계: 하단 툴바 중앙의 '공유'(box-arrow) 버튼을 직접 탭 (메뉴 버튼 없음) */
export function IosShareStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="Safari 하단 툴바 중앙의 공유 버튼 위치" fill="none">
      <PhoneFrame />

      {/* 본문 콘텐츠 라인 (팝업 없이 상단 가득) */}
      <rect x="52" y="46" width="116" height="9" rx="4.5" className={LINE} fill="currentColor" opacity="0.5" />
      <rect x="52" y="64" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.45" />
      <rect x="52" y="78" width="104" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="100" width="108" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />
      <rect x="52" y="114" width="84" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />
      <rect x="52" y="136" width="100" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="150" width="96" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />

      {/* 하단 Safari 바 배경 (주소창 + 툴바 2단) */}
      <rect x="39" y="216" width="142" height="48" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="216" x2="181" y2="216" stroke="currentColor" className={FRAME} strokeWidth="1" />

      {/* 상단 주소창 pill (좌 글자크기 ㄱㅏ · 중앙 도메인 · 우 새로고침) */}
      <rect x="48" y="221" width="124" height="16" rx="8" className={SURFACE} fill="currentColor" />
      <text x="58" y="232" fontSize="6" fontWeight="700" textAnchor="middle" className={HINT} fill="currentColor">A</text>
      <text x="65" y="232" fontSize="8.5" fontWeight="700" textAnchor="middle" className={HINT} fill="currentColor">A</text>
      <text x="113" y="231.5" fontSize="6.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>
      <path d="M160 231 a3.4 3.4 0 1 1 0.9 -3.4" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M161.6 223.1 l-0.3 3 l-2.9 -0.5" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* 툴바 행 (뒤로 < / 앞으로 > / 공유(중앙,강조) / 북마크 / 탭) */}
      {/* 뒤로 < */}
      <path d="M52 250 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 앞으로 > */}
      <path d="M80 250 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* [강조] 중앙 공유 버튼 (box-arrow) - 직접 탭 대상 */}
      <circle cx="110" cy="254" r="10" fill={BRAND} opacity="0.12" />
      <circle cx="110" cy="254" r="12.5" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <g transform="translate(110, 254.5)" stroke={BRAND} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-4.5" y="-1" width="9" height="8" rx="1.4" fill="none" />
        <path d="M0 -6 V2" />
        <path d="M-2.4 -3.6 L0 -6 L2.4 -3.6" />
      </g>

      {/* 북마크 (책 모양) */}
      <path d="M140 249 h7 v10 l-3.5 -2.6 l-3.5 2.6 z" stroke="currentColor" className={HINT} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      {/* 탭 (겹친 사각) */}
      <rect x="167" y="251" width="8.5" height="8.5" rx="2" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      <rect x="164" y="249" width="8.5" height="8.5" rx="2" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />

      {/* 가이드 화살표: 중앙 공유 버튼을 위에서 아래로 지목 */}
      <g transform="translate(110, 234)">
        <path d="M0 -6 V4" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 1 L0 4 L3 1" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS Safari(신형, iOS 18+) 1단계: 하단 주소창 우측 ⋯ 메뉴 → 팝업 최상단 '공유' 강조 */
export function IosSafariNewShareStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="신형 Safari 하단 더보기 메뉴의 공유 위치" fill="none">
      <PhoneFrame />

      {/* 페이지 콘텐츠 (상단) */}
      <rect x="52" y="44" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="58" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />

      {/* ⋯ 클릭 시 위로 뜨는 메뉴 팝업 */}
      <rect x="66" y="74" width="108" height="140" rx="14" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />

      {/* [강조] 공유 (최상단) */}
      <rect x="73" y="82" width="94" height="22" rx="7" fill={BRAND} opacity="0.14" />
      <rect x="73" y="82" width="94" height="22" rx="7" stroke={BRAND} strokeWidth="1.1" />
      <g transform="translate(86, 93)" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-4" y="-1" width="8" height="7" rx="1.3" />
        <path d="M0 -5 V1.5" />
        <path d="M-2.2 -3 L0 -5 L2.2 -3" />
      </g>
      <text x="100" y="96.5" fontSize="7.6" fontWeight="800" fill={BRAND}>공유</text>

      {/* 북마크에 추가 */}
      <path d="M82 116 h7 v9 l-3.5 -2.6 l-3.5 2.6 z" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <text x="100" y="123" fontSize="7" fontWeight="500" className={HINT} fill="currentColor">북마크에 추가</text>

      {/* 폴더에 추가 */}
      <path d="M81 137 h4 l1.5 2 h4.5 v7 h-10 z" stroke="currentColor" className={HINT} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      <text x="100" y="143" fontSize="7" fontWeight="500" className={HINT} fill="currentColor">폴더에 추가…</text>

      <line x1="73" y1="156" x2="167" y2="156" stroke="currentColor" className={FRAME} strokeWidth="0.7" opacity="0.5" />

      {/* 새로운 탭 */}
      <path d="M83 166 V174 M79 170 H87" stroke="currentColor" className={HINT} strokeWidth="1.3" strokeLinecap="round" />
      <text x="100" y="173" fontSize="7" fontWeight="500" className={HINT} fill="currentColor">새로운 탭</text>

      <line x1="73" y1="186" x2="167" y2="186" stroke="currentColor" className={FRAME} strokeWidth="0.7" opacity="0.5" />

      {/* 하단 빠른 항목 [북마크] [모든 탭] */}
      <path d="M96 196 h4 v8 l-2 -1.5 l-2 1.5 z" stroke="currentColor" className={HINT} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      <text x="98" y="211" fontSize="5.5" fontWeight="600" textAnchor="middle" className={HINT} fill="currentColor">북마크</text>
      <rect x="141" y="197" width="8" height="8" rx="2" stroke="currentColor" className={HINT} strokeWidth="1.1" fill="none" />
      <rect x="138" y="200" width="8" height="8" rx="2" stroke="currentColor" className={HINT} strokeWidth="1.1" fill="none" />
      <text x="142" y="217" fontSize="5.5" fontWeight="600" textAnchor="middle" className={HINT} fill="currentColor">모든 탭</text>

      {/* 하단 Safari 단일 바: < · 주소 · ↻ · ⋯ */}
      <rect x="39" y="230" width="142" height="36" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="230" x2="181" y2="230" stroke="currentColor" className={FRAME} strokeWidth="1" />
      {/* 뒤로 < (원형) */}
      <circle cx="52" cy="248" r="8.5" className={SURFACE} fill="currentColor" />
      <path d="M54 244 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* 주소 pill */}
      <rect x="68" y="240" width="84" height="16" rx="8" className={SURFACE} fill="currentColor" />
      <g transform="translate(77, 248)" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinejoin="round">
        <rect x="-3" y="-2.5" width="6" height="4.5" rx="1" /><path d="M-3 3 h6" />
      </g>
      <text x="112" y="251" fontSize="6.2" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>
      <path d="M146 248 a3.2 3.2 0 1 1 0.8 -3.2" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* [강조] ⋯ 더보기 (우측, 원형) */}
      <circle cx="170" cy="248" r="9.5" fill={BRAND} opacity="0.14" />
      <circle cx="170" cy="248" r="12" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <g fill={BRAND}>
        <circle cx="165.5" cy="248" r="1.5" /><circle cx="170" cy="248" r="1.5" /><circle cx="174.5" cy="248" r="1.5" />
      </g>

      {/* 가이드 화살표: 메뉴 최상단 공유로 */}
      <g transform="translate(96, 70)">
        <path d="M0 -5 V5" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-3 2 L0 5 L3 2" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS Chrome 1단계: 하단 주소창 우측의 '공유'(box-arrow) 아이콘 직접 탭 (중간 메뉴 없음) */
export function IosChromeShareStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="iOS 크롬 하단 주소창의 공유 아이콘 위치" fill="none">
      <PhoneFrame />

      {/* 본문 콘텐츠 라인 (페이지 — 팝업 없이 상단 가득) */}
      <rect x="52" y="46" width="116" height="9" rx="4.5" className={LINE} fill="currentColor" opacity="0.5" />
      <rect x="52" y="64" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.45" />
      <rect x="52" y="78" width="104" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="100" width="108" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />
      <rect x="52" y="114" width="84" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />
      <rect x="52" y="136" width="100" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="150" width="96" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />

      {/* 하단 Chrome 바 배경 (주소창 + 툴바 2단) */}
      <rect x="39" y="216" width="142" height="48" rx="0" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="216" x2="181" y2="216" stroke="currentColor" className={FRAME} strokeWidth="1" />

      {/* 상단 주소창 pill */}
      <rect x="48" y="222" width="124" height="17" rx="8.5" className={SURFACE} fill="currentColor" />
      {/* 좌측 AI 반짝임 ✦ */}
      <g transform="translate(59, 230.5)" fill="currentColor" className={HINT}>
        <path d="M0 -3.4 L0.9 -0.9 L3.4 0 L0.9 0.9 L0 3.4 L-0.9 0.9 L-3.4 0 L-0.9 -0.9 Z" />
        <path d="M3.6 -3.6 L4.1 -2.1 L5.6 -1.6 L4.1 -1.1 L3.6 0.4 L3.1 -1.1 L1.6 -1.6 L3.1 -2.1 Z" opacity="0.7" />
      </g>
      {/* 주소 텍스트 */}
      <text x="104" y="234" fontSize="6.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>

      {/* [강조] 주소창 우측 공유(box-arrow) 아이콘 - 직접 탭 대상 */}
      <circle cx="161" cy="230.5" r="9.5" fill={BRAND} opacity="0.12" />
      <circle cx="161" cy="230.5" r="12" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <g transform="translate(161, 231)" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-4" y="-1" width="8" height="7" rx="1.3" fill="none" />
        <path d="M0 -5 V1.5" />
        <path d="M-2.2 -3 L0 -5 L2.2 -3" />
      </g>

      {/* 툴바 행 (뒤로/앞으로/새 탭/탭/⋯) */}
      {/* 뒤로 < */}
      <path d="M54 250 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 앞으로 > */}
      <path d="M82 250 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 새 탭 ⊕ (원형) */}
      <circle cx="110" cy="254" r="8" className={SURFACE} fill="currentColor" />
      <path d="M110 250 V258 M106 254 H114" stroke="currentColor" className={HINT} strokeWidth="1.4" strokeLinecap="round" />
      {/* 탭 [2] */}
      <rect x="134" y="249" width="11" height="11" rx="2.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      {/* ⋯ (보조) */}
      <circle cx="164" cy="254.5" r="1.2" className={HINT} fill="currentColor" />
      <circle cx="168" cy="254.5" r="1.2" className={HINT} fill="currentColor" />
      <circle cx="172" cy="254.5" r="1.2" className={HINT} fill="currentColor" />

      {/* 가이드 화살표: 주소창 우측 공유 아이콘을 아래로 지목 */}
      <g transform="translate(161, 207)">
        <path d="M0 -6 V4" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 1 L0 4 L3 1" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS Whale 1단계: 하단 우측 ≡(햄버거) 메뉴 터치 → 그리드 팝업의 '공유' 타일 강조 */
export function IosWhaleShareStep({ className }: IllustrationProps) {
  const WHALE_GREEN = "#00cd3c";
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="iOS 웨일 하단 메뉴의 공유 위치" fill="none">
      <PhoneFrame />

      {/* 본문 콘텐츠 라인 (페이지 상단) */}
      <rect x="52" y="42" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="58" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />

      {/* ≡ 클릭 시 위로 뜨는 그리드 팝업 */}
      <rect x="50" y="74" width="120" height="130" rx="14" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />

      {/* 상단 빠른 타일 행 (북마크/스크랩북/알림/설정 더미) */}
      <g className={SURFACE} fill="currentColor">
        <rect x="59" y="84" width="17" height="17" rx="4" />
        <rect x="85" y="84" width="17" height="17" rx="4" />
        <rect x="111" y="84" width="17" height="17" rx="4" />
        <rect x="137" y="84" width="17" height="17" rx="4" />
      </g>
      <line x1="59" y1="110" x2="161" y2="110" stroke="currentColor" className={FRAME} strokeWidth="0.7" opacity="0.6" />

      {/* 3열 아이콘 그리드 (row0: 웨일온/퀵서치/공유, row1: 방문기록/다운로드/최근탭) */}
      <g className={HINT}>
        {/* row0 col0·col1 (더미 아이콘) */}
        <rect x="68" y="120" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="111" cy="126" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
        {/* row1 더미 아이콘 3개 */}
        <circle cx="75" cy="160" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M111 154 v9 M107 159 l4 4 l4 -4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="138" y="155" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </g>
      {/* 타일 라벨 더미 (텍스트 자리) */}
      <g className={LINE} fill="currentColor" opacity="0.7">
        <rect x="68" y="136" width="14" height="3" rx="1.5" />
        <rect x="105" y="136" width="12" height="3" rx="1.5" />
        <rect x="69" y="170" width="12" height="3" rx="1.5" />
        <rect x="105" y="170" width="12" height="3" rx="1.5" />
        <rect x="138" y="170" width="12" height="3" rx="1.5" />
      </g>

      {/* [강조] row0 col2 = 공유 타일 (box-arrow) */}
      <circle cx="144" cy="126" r="11" fill={BRAND} opacity="0.12" />
      <circle cx="144" cy="126" r="13.5" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <g transform="translate(144, 126)" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-4" y="-1" width="8" height="7" rx="1.3" fill="none" />
        <path d="M0 -5 V1.5" />
        <path d="M-2.2 -3 L0 -5 L2.2 -3" />
      </g>
      <text x="144" y="139.5" fontSize="5.5" fontWeight="bold" fill={BRAND} textAnchor="middle">공유</text>

      {/* 하단 Whale 바 배경 (주소창 + 툴바 2단) */}
      <rect x="39" y="214" width="142" height="50" rx="0" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="214" x2="181" y2="214" stroke="currentColor" className={FRAME} strokeWidth="1" />

      {/* 상단 주소창 pill (좌 ⋯ · 중앙 도메인 · 우 ↻) */}
      <rect x="48" y="219" width="124" height="16" rx="8" className={SURFACE} fill="currentColor" />
      <circle cx="57" cy="227" r="1.1" className={HINT} fill="currentColor" />
      <circle cx="61" cy="227" r="1.1" className={HINT} fill="currentColor" />
      <circle cx="65" cy="227" r="1.1" className={HINT} fill="currentColor" />
      <text x="110" y="230.5" fontSize="6.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>
      <path d="M161 230.5 a3.4 3.4 0 1 1 0.9 -3.4" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M162.6 222.6 l-0.3 3 l-2.9 -0.5" stroke="currentColor" className={HINT} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* 툴바 행 (✕ / > / 웨일 로고 / [4] / ≡) */}
      {/* ✕ 닫기 */}
      <path d="M51 246 l8 8 M59 246 l-8 8" stroke="currentColor" className={HINT} strokeWidth="1.3" strokeLinecap="round" />
      {/* > 앞으로 (흐림) */}
      <path d="M82 246 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      {/* 중앙 웨일 로고 포인트 (green) */}
      <circle cx="110" cy="250" r="6" stroke={WHALE_GREEN} strokeWidth="1.6" fill="none" />
      <path d="M107 251 a3 2 0 0 0 6 0" stroke={WHALE_GREEN} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* 탭 [4] */}
      <rect x="134" y="244.5" width="11" height="11" rx="2.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      {/* [강조] ≡ 햄버거 메뉴 - 클릭된 상태 */}
      <circle cx="168" cy="250" r="9.5" fill={BRAND} opacity="0.12" />
      <circle cx="168" cy="250" r="12" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <g stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" transform="translate(163, 247.5)">
        <line x1="0" y1="0" x2="10" y2="0" />
        <line x1="0" y1="5" x2="10" y2="5" />
      </g>

      {/* 가이드 화살표: 하단 우측 ≡ 메뉴를 아래로 지목 */}
      <g transform="translate(168, 226)">
        <path d="M0 -5 V3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 0 L0 3 L3 0" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS 2단계: 공유 시트의 "홈 화면에 추가" 행 강조 */
export function IosAddToHomeStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="공유 메뉴의 홈 화면에 추가 항목" fill="none">
      <PhoneFrame />
      
      {/* 배경 콘텐츠 흐릿하게 묘사 */}
      <rect x="48" y="34" width="124" height="18" rx="9" className={SURFACE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="66" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="82" width="72" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />

      {/* iOS 공유 메뉴 시트 (밑에서 슬라이드 업 형태로 노출) */}
      <rect x="41" y="90" width="138" height="172" rx="16" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />
      
      {/* 시트 상단 드래그바 */}
      <rect x="98" y="96" width="24" height="3.5" rx="1.7" className={HINT} fill="currentColor" opacity="0.4" />
      
      {/* 상단 닫기 X 버튼 */}
      <circle cx="164" cy="106" r="6" className={SURFACE} fill="currentColor" />
      <path d="M162 104 L166 108 M166 104 L162 108" stroke="currentColor" className={HINT} strokeWidth="1.2" strokeLinecap="round" />
      
      {/* 가로형 빠른 앱 아이콘 행 */}
      <g transform="translate(48, 114)" className={LINE}>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <circle cx="38" cy="12" r="10" fill="currentColor" />
        <circle cx="64" cy="12" r="10" fill="currentColor" />
        <circle cx="90" cy="12" r="10" fill="currentColor" />
        <circle cx="116" cy="12" r="10" fill="currentColor" />
      </g>
      <line x1="48" y1="144" x2="172" y2="144" stroke="currentColor" className={FRAME} strokeWidth="1" opacity="0.6" />

      {/* 리스트 메뉴 항목 1: 복사 */}
      <g transform="translate(48, 150)">
        <rect x="4" y="2" width="10" height="10" rx="2" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
        <rect x="8" y="6" width="6" height="6" rx="1" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
        {/* 실제 한글 텍스트 추가 */}
        <text x="24" y="11" fontSize="7.5" fontWeight="500" className={HINT} fill="currentColor">링크 복사</text>
      </g>

      {/* [강조] 리스트 메뉴 항목 2: 홈 화면에 추가 */}
      <g transform="translate(44, 172)">
        {/* 행 전체 강조 박스 */}
        <rect x="0" y="0" width="132" height="26" rx="8" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="132" height="26" rx="8" stroke={BRAND} strokeWidth="1.2" />
        
        {/* iOS 홈 추가 아이콘 (정사각형 안의 +) */}
        <rect x="8" y="4" width="18" height="18" rx="4.5" fill="none" stroke={BRAND} strokeWidth="1.6" />
        <path d="M17 8 V18 M12 13 H22" stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" />
        
        {/* 실제 한글 텍스트 추가 ("홈 화면에 추가" 강조) */}
        <text x="34" y="16.5" fontSize="8" fontWeight="800" fill={BRAND}>홈 화면에 추가</text>
        
        {/* 터치 포인터 펄스 서클 */}
        <circle cx="116" cy="13" r="8" fill={BRAND} opacity="0.2" />
        <circle cx="116" cy="13" r="13" stroke={BRAND} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.5" />
      </g>

      {/* 리스트 메뉴 항목 3: 북마크 추가 */}
      <g transform="translate(48, 206)">
        <path d="M9 2 L11.5 7 L17 7.5 L13 11 L14 16.5 L9 13.5 L4 16.5 L5 11 L1 7.5 L6.5 7 Z" stroke="currentColor" className={HINT} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
        {/* 실제 한글 텍스트 추가 */}
        <text x="24" y="11" fontSize="7.5" fontWeight="500" className={HINT} fill="currentColor">북마크 추가</text>
      </g>

      {/* 리스트 메뉴 항목 4: 읽기 목록에 추가 */}
      <g transform="translate(48, 230)">
        <circle cx="6" cy="7" r="4" stroke="currentColor" className={HINT} strokeWidth="1.2" />
        <circle cx="14" cy="7" r="4" stroke="currentColor" className={HINT} strokeWidth="1.2" />
        <path d="M9 7 H11" stroke="currentColor" className={HINT} strokeWidth="1.2" />
        {/* 실제 한글 텍스트 추가 */}
        <text x="24" y="11" fontSize="7.5" fontWeight="500" className={HINT} fill="currentColor">읽기 목록에 추가</text>
      </g>

      {/* 가이드 지시 손가락/화살표 */}
      <g transform="translate(160, 192)">
        <path d="M-6 8 L-1 -2" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-5 -4 L-1 -2 L-3 2" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS 3단계: '홈 화면에 추가' 미리보기 화면에서 우측 상단 [추가] 버튼 강조 (대부분 브라우저 공통 형태) */
export function IosConfirmAddStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="홈 화면에 추가 화면의 추가 버튼" fill="none">
      <PhoneFrame />

      {/* 배경 콘텐츠 흐릿하게 묘사 */}
      <rect x="48" y="44" width="124" height="16" rx="8" className={SURFACE} fill="currentColor" opacity="0.22" />
      <rect x="52" y="72" width="116" height="7" rx="3.5" className={LINE} fill="currentColor" opacity="0.22" />

      {/* 상단에서 내려온 '홈 화면에 추가' 시트 */}
      <rect x="41" y="34" width="138" height="116" rx="16" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />

      {/* 네비 행: 취소(좌) / 제목(중앙) / 추가(우, 강조) */}
      <text x="58" y="55.5" fontSize="7.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">취소</text>
      <text x="106" y="55.5" fontSize="7.8" fontWeight="800" textAnchor="middle" fill="currentColor" className="text-foreground">홈 화면에 추가</text>

      {/* [강조] 우측 상단 추가 버튼 */}
      <g transform="translate(150, 44)">
        <rect x="0" y="0" width="23" height="16" rx="6" fill={BRAND} opacity="0.16" />
        <rect x="0" y="0" width="23" height="16" rx="6" stroke={BRAND} strokeWidth="1.1" />
        <text x="11.5" y="11.5" fontSize="7.5" fontWeight="800" textAnchor="middle" fill={BRAND}>추가</text>
        <circle cx="11.5" cy="8" r="14" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      </g>
      <line x1="41" y1="68" x2="179" y2="68" stroke="currentColor" className={FRAME} strokeWidth="0.8" opacity="0.5" />

      {/* 미리보기 행: 앱 아이콘(좌) + 이름 '시크릿에셋'(중앙) + 도메인 */}
      {/* 앱 아이콘 */}
      <rect x="52" y="80" width="30" height="30" rx="7.5" fill={BRAND} />
      {/* 아이콘 내부 자물쇠 모티프 */}
      <g transform="translate(67, 95)">
        <rect x="-5" y="-1.5" width="10" height="8.5" rx="2" fill="#fff" />
        <path d="M-3 -1.5 V-4 a3 3 0 0 1 6 0 V-1.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="0" cy="2.5" r="1.3" fill={BRAND} />
      </g>
      {/* 이름 입력 필드 '시크릿에셋' */}
      <rect x="90" y="82" width="84" height="14" rx="3.5" className={SURFACE} fill="currentColor" />
      <text x="95" y="92" fontSize="7.5" fontWeight="700" className="text-foreground" fill="currentColor">시크릿에셋</text>
      {/* 도메인 주소 */}
      <text x="91" y="107" fontSize="6.5" fontWeight="500" className={HINT} fill="currentColor">{DOMAIN}</text>

      {/* 안내 문구 라인 */}
      <rect x="52" y="126" width="116" height="4" rx="2" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="136" width="84" height="4" rx="2" className={LINE} fill="currentColor" opacity="0.4" />

      {/* 가이드 화살표: 추가 버튼을 위에서 아래로 지목 */}
      <g transform="translate(161.5, 30)">
        <path d="M0 -5 V3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 0 L0 3 L3 0" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Android 크롬·웨일: 우측 상단 ⋮ 메뉴 → 홈 화면에 추가 강조 */
export function ChromeMenuStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="크롬·웨일 상단 메뉴의 홈 화면에 추가" fill="none">
      <PhoneFrame />

      {/* Android 크롬 상단 주소창 영역 */}
      <rect x="39" y="32" width="142" height="24" fill="currentColor" className="text-background dark:text-muted/10" />
      <line x1="39" y1="56" x2="181" y2="56" stroke="currentColor" className={FRAME} strokeWidth="1" />
      
      {/* 주소창 검색창 박스 */}
      <rect x="44" y="36" width="102" height="16" rx="8" className={SURFACE} fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
      {/* 지구본/자물쇠 아이콘 대체 */}
      <circle cx="52" cy="44" r="3" className={HINT} fill="currentColor" />
      {/* 주소 텍스트 (실제 도메인 주소 반영) */}
      <text x="96" y="47" fontSize="7" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>

      {/* 크롬 우측 탭 개수 배지 [ 1 ] */}
      <rect x="152" y="37" width="13" height="13" rx="3" stroke="currentColor" className={HINT} strokeWidth="1.4" fill="none" />
      <text x="156.5" y="47" fontSize="8" fontWeight="800" className={HINT} fill="currentColor">1</text>

      {/* [강조] ⋮ 메뉴 버튼 */}
      <circle cx="172" cy="44" r="9" fill={BRAND} opacity="0.15" />
      <circle cx="172" cy="44" r="13" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <g fill={BRAND}>
        <circle cx="172" cy="39.5" r="1.5" />
        <circle cx="172" cy="44" r="1.5" />
        <circle cx="172" cy="48.5" r="1.5" />
      </g>

      {/* 본문 흐릿한 라인 */}
      <rect x="48" y="70" width="124" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="48" y="86" width="96" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.4" />

      {/* 크롬 드롭다운 메뉴 (⋮ 누르면 나타나는 팝업) */}
      <rect x="85" y="58" width="92" height="194" rx="6" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />

      {/* 메뉴 항목 1: 새 탭 */}
      <g transform="translate(90, 68)">
        <rect x="6" y="6" width="36" height="4" rx="2" className={HINT} fill="currentColor" />
      </g>
      {/* 메뉴 항목 2: 북마크 */}
      <g transform="translate(90, 88)">
        <rect x="6" y="6" width="42" height="4" rx="2" className={HINT} fill="currentColor" />
      </g>
      {/* 메뉴 항목 3: 최근 탭 */}
      <g transform="translate(90, 108)">
        <rect x="6" y="6" width="34" height="4" rx="2" className={HINT} fill="currentColor" />
      </g>
      <line x1="88" y1="126" x2="174" y2="126" stroke="currentColor" className={FRAME} strokeWidth="0.8" />

      {/* [강조] 메뉴 항목 4: 홈 화면에 추가 (또는 앱 설치) */}
      <g transform="translate(87, 132)">
        {/* 행 강조 박스 */}
        <rect x="0" y="0" width="88" height="26" rx="4" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="88" height="26" rx="4" stroke={BRAND} strokeWidth="1" />
        
        {/* 크롬 모바일 화면 다운로드 아이콘 형태 */}
        <g transform="translate(6, 6)" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <rect x="0" y="0" width="10" height="14" rx="2" />
          <path d="M5 4 v5 M3 7 l2 2 l2 -2" />
        </g>
        
        {/* 실제 한글 텍스트 추가 ("홈 화면에 추가") */}
        <text x="20" y="16.5" fontSize="7.5" fontWeight="800" fill={BRAND}>홈 화면에 추가</text>
        
        {/* 터치 포인트 */}
        <circle cx="78" cy="13" r="6" fill={BRAND} opacity="0.2" />
      </g>

      {/* 메뉴 항목 5: 데스크톱 사이트 */}
      <g transform="translate(90, 168)">
        <rect x="6" y="6" width="48" height="4" rx="2" className={HINT} fill="currentColor" />
      </g>
      {/* 메뉴 항목 6: 설정 */}
      <g transform="translate(90, 188)">
        <rect x="6" y="6" width="30" height="4" rx="2" className={HINT} fill="currentColor" />
      </g>
      
      {/* 가이드 지시 화살표 */}
      <g transform="translate(178, 152)">
        <path d="M-8 8 L-1 -1" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-5 -3 L-1 -1 L-3 3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 삼성 인터넷: 하단 ☰ 메뉴 → 홈 화면에 추가 강조 */
export function SamsungMenuStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="삼성 인터넷 하단 메뉴의 홈 화면에 추가" fill="none">
      <PhoneFrame />

      {/* 상단 주소창 영역 */}
      <rect x="48" y="34" width="124" height="18" rx="9" className={SURFACE} fill="currentColor" />
      {/* 주소 텍스트 (실제 도메인 주소 반영) */}
      <text x="110" y="46.5" fontSize="7" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">{DOMAIN}</text>

      {/* 본문 콘텐츠 라인 */}
      <rect x="52" y="66" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="52" y="82" width="76" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.4" />

      {/* 삼성 인터넷 하단 도구 패널 (☰ 클릭 시 올라오는 메뉴 창) */}
      <rect x="41" y="90" width="138" height="134" rx="16" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" strokeOpacity="0.8" />
      
      {/* 메뉴 드래그 바 */}
      <rect x="98" y="96" width="24" height="3" rx="1.5" className={HINT} fill="currentColor" opacity="0.3" />

      {/* 4x4 그리드 형태의 도구들 */}
      {/* 1행 1열: 다운로드 */}
      <g transform="translate(58, 112)" className={LINE}>
        <path d="M-3 -3 v4.5 M-5 -1 L-3 1.5 L-1 -1 M-6 3.5 h12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">다운로드</text>
      </g>
      {/* 1행 2열: 방문기록 */}
      <g transform="translate(93, 112)" className={LINE}>
        <circle cx="0" cy="-2.5" r="4.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M0 -5 v2.5 h1.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">방문기록</text>
      </g>
      {/* 1행 3열: 저장한 페이지 */}
      <g transform="translate(127, 112)" className={LINE}>
        <circle cx="0" cy="-2.5" r="4.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M-3.5 -2.5 h7 M-2 -4 v3 M1 -4.5 v4 M-2.5 -0.5 h5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">저장한 페이지</text>
      </g>
      {/* [강조] 1행 4열: 현재 페이지 추가 */}
      <g transform="translate(162, 112)">
        {/* 강조 배경 박스 */}
        <rect x="-13" y="-10" width="26" height="30" rx="4" fill={BRAND} opacity="0.14" />
        <rect x="-13" y="-10" width="26" height="30" rx="4" stroke={BRAND} strokeWidth="1" />
        {/* + 기호 */}
        <path d="M-4 -2.5 h8 M0 -6.5 v8" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" />
        {/* 라벨 텍스트 2줄 분리 */}
        <text x="0" y="9.5" fontSize="4.2" fontWeight="800" textAnchor="middle" fill={BRAND}>현재 페이지</text>
        <text x="0" y="15" fontSize="4.2" fontWeight="800" textAnchor="middle" fill={BRAND}>추가</text>
        {/* 터치 펄스 */}
        <circle cx="0" cy="-2.5" r="9.5" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      </g>

      {/* 2행 1열: 공유 */}
      <g transform="translate(58, 140)" className={LINE}>
        <circle cx="-2.5" cy="-2.5" r="1.2" stroke="currentColor" strokeWidth="0.9" />
        <circle cx="2.5" cy="-5" r="1.2" stroke="currentColor" strokeWidth="0.9" />
        <circle cx="2.5" cy="0" r="1.2" stroke="currentColor" strokeWidth="0.9" />
        <path d="M-1.5 -3 L1.5 -4.5 M-1.5 -2 L1.5 -1" stroke="currentColor" strokeWidth="0.9" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">공유</text>
      </g>
      {/* 2행 2열: 어두운 웹페이지 */}
      <g transform="translate(93, 140)" className={LINE} opacity="0.3">
        <path d="M-2 -5.5 a4.5 4.5 0 0 0 4 6 a4.5 4.5 0 1 1 -4 -6" stroke="currentColor" strokeWidth="1" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">어두운 웹페이지</text>
      </g>
      {/* 2행 3열: 광고 차단 기능 */}
      <g transform="translate(127, 140)" className={LINE}>
        <path d="M-4 -5.5 h8 v3.5 c0 2.5 -4 5 -4 5 s-4 -2.5 -4 -5 z" stroke="currentColor" strokeWidth="1" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">광고 차단</text>
      </g>
      {/* 2행 4열: 페이지에서 찾기 */}
      <g transform="translate(162, 140)" className={LINE}>
        <circle cx="-1" cy="-3.5" r="2.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M1 -1.5 L3.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">페이지 찾기</text>
      </g>

      {/* 3행 1열: PC 버전 */}
      <g transform="translate(58, 168)" className={LINE}>
        <rect x="-5" y="-6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M-2.5 2 h5 M0 1 v1" stroke="currentColor" strokeWidth="1" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">PC 버전</text>
      </g>
      {/* 3행 2열: 글자 크기 */}
      <g transform="translate(93, 168)" className={LINE}>
        <path d="M-4 -5 h3 M-2.5 -5 v6.5 M1 -3.5 h2.5 M2.2 -3.5 v5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">글자 크기</text>
      </g>
      {/* 3행 3열: 확대/축소 */}
      <g transform="translate(127, 168)" className={LINE}>
        <circle cx="0" cy="-2.5" r="4.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M-2 -2.5 h4 M0 -4.5 v4" stroke="currentColor" strokeWidth="0.8" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">확대/축소</text>
      </g>
      {/* 3행 4열: 추가 기능 */}
      <g transform="translate(162, 168)" className={LINE}>
        <rect x="-4.5" y="-6" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="0" cy="-2.5" r="1.5" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">추가 기능</text>
      </g>

      {/* 4행 1열: 인쇄/PDF */}
      <g transform="translate(58, 196)" className={LINE}>
        <path d="M-4.5 -2 h9 v4.5 h-9 z M-3 -4.5 h6 v2.5 h-6 z M-2.5 2.5 h5" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">인쇄/PDF</text>
      </g>
      {/* 4행 2열: 개인정보 */}
      <g transform="translate(93, 196)" className={LINE}>
        <circle cx="0" cy="-4" r="2.2" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M-3.5 0.5 a3.5 3.5 0 0 1 7 0 z" stroke="currentColor" strokeWidth="1" fill="none" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">개인정보</text>
      </g>
      {/* 4행 3열: 설정 */}
      <g transform="translate(127, 196)" className={LINE}>
        <circle cx="0" cy="-2.5" r="3" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M0 -6 v1 M0 -1 v1 M-3.5 -2.5 h1 M2.5 -2.5 h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">설정</text>
      </g>
      {/* 4행 4열: 번역기 */}
      <g transform="translate(162, 196)" className={LINE}>
        <rect x="-4.5" y="-6" width="9" height="7.5" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
        <text x="0" y="-1" fontSize="3.5" fontWeight="bold" textAnchor="middle" fill="currentColor">A</text>
        <text x="0" y="14" fontSize="4" fontWeight="500" textAnchor="middle" fill="currentColor">번역기</text>
      </g>

      {/* 하단 삼성 인터넷 고정 툴바 */}
      <rect x="39" y="228" width="142" height="34" rx="0" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="228" x2="181" y2="228" stroke="currentColor" className={FRAME} strokeWidth="1" />
      
      {/* 툴바 아이콘들 (뒤로, 앞으로, 홈, 탭목록, ☰메뉴) */}
      <path d="M50 245 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 245 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M92 249 v-4.5 l4 -3.5 l4 3.5 v4.5 z" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <rect x="114" y="244" width="10" height="10" rx="2.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      <g stroke="currentColor" className={HINT} strokeWidth="1.6" strokeLinecap="round" transform="translate(143, 246)">
        <line x1="1" y1="1" x2="9" y2="1" opacity="0.5" />
        <line x1="1" y1="3.5" x2="9" y2="3.5" opacity="0.5" />
        <line x1="1" y1="6" x2="9" y2="6" opacity="0.5" />
      </g>

      {/* 가이드 지시 화살표 (+ 기호 포인팅) */}
      <g transform="translate(162, 134)">
        <path d="M0 8 V-1" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 2 L0 -1 L3 2" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 삼성 인터넷 2단계: '현재 페이지 추가' 팝업에서 '홈 화면' 강조 */
export function SamsungAddToHomeStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="삼성 인터넷 현재 페이지 추가 팝업의 홈 화면 항목" fill="none">
      <PhoneFrame />

      {/* 배경 콘텐츠 흐릿하게 묘사 */}
      <rect x="48" y="34" width="124" height="18" rx="9" className={SURFACE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="66" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.3" />
      <rect x="52" y="82" width="72" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.3" />

      {/* 삼성 인터넷 '현재 페이지 추가' 팝업 */}
      <rect x="46" y="75" width="128" height="136" rx="14" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />

      {/* 팝업 타이틀 */}
      <text x="110" y="96" fontSize="8" fontWeight="800" textAnchor="middle" fill="currentColor" className="text-foreground">현재 페이지 추가</text>
      <line x1="46" y1="106" x2="174" y2="106" stroke="currentColor" className={FRAME} strokeWidth="0.8" opacity="0.4" />

      {/* 항목 1: 북마크 */}
      <g transform="translate(110, 122)">
        <text x="0" y="0" fontSize="7.2" fontWeight="500" textAnchor="middle" fill="currentColor" className={HINT}>북마크</text>
      </g>
      <line x1="56" y1="130" x2="164" y2="130" stroke="currentColor" className={FRAME} strokeWidth="0.6" opacity="0.3" />

      {/* 항목 2: 빠른 실행 */}
      <g transform="translate(110, 146)">
        <text x="0" y="0" fontSize="7.2" fontWeight="500" textAnchor="middle" fill="currentColor" className={HINT}>빠른 실행</text>
      </g>
      <line x1="56" y1="154" x2="164" y2="154" stroke="currentColor" className={FRAME} strokeWidth="0.6" opacity="0.3" />

      {/* [강조] 항목 3: 홈 화면 */}
      <g transform="translate(110, 170)">
        {/* 행 전체 강조 박스 */}
        <rect x="-56" y="-10" width="112" height="18" rx="6" fill={BRAND} opacity="0.14" />
        <rect x="-56" y="-10" width="112" height="18" rx="6" stroke={BRAND} strokeWidth="1.2" />
        
        {/* 홈 화면 텍스트 */}
        <text x="0" y="2" fontSize="7.8" fontWeight="800" textAnchor="middle" fill={BRAND}>홈 화면</text>

        {/* 터치 포인터 펄스 서클 */}
        <circle cx="42" cy="-1" r="5" fill={BRAND} opacity="0.2" />
        <circle cx="42" cy="-1" r="8" stroke={BRAND} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.5" />
      </g>
      <line x1="56" y1="178" x2="164" y2="178" stroke="currentColor" className={FRAME} strokeWidth="0.6" opacity="0.3" />

      {/* 항목 4: 저장한 페이지 */}
      <g transform="translate(110, 194)">
        <text x="0" y="0" fontSize="7.2" fontWeight="500" textAnchor="middle" fill="currentColor" className={HINT}>저장한 페이지</text>
      </g>

      {/* 가이드 지시 화살표 (오른쪽에서 왼쪽으로 가리킴) */}
      <g transform="translate(172, 169)">
        <path d="M6 0 L-3 0" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
        <path d="M1 -3.5 L-3 0 L1 3.5" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// 가이드 애니메이션이 다루는 플랫폼(pc 제외 — pc는 네이티브 설치라 단계 가이드 없음)
type GuideAnimPlatform = Exclude<GuidePlatform, "pc">;

/** 플랫폼·브라우저별 설치 가이드 3단계 시퀀스 (브라우저별 1스텝 일러스트는 각자 distinct, 3번째 '추가 확정'은 공통) */
function getGuideSteps(platform: GuideAnimPlatform, browser: GuideBrowser, safariModern = false): FC<IllustrationProps>[] {
  if (platform === "ios") {
    const Step1 = browser === "safari"
      ? (safariModern ? IosSafariNewShareStep : IosShareStep) // 신형(iOS 15+)=⋯메뉴→공유 / 구형=하단 중앙 공유
      : browser === "whale" ? IosWhaleShareStep : IosChromeShareStep;
    return [Step1, IosAddToHomeStep, IosConfirmAddStep];
  }
  // android — 전 브라우저 3단계 통일
  if (browser === "samsung") return [SamsungMenuStep, SamsungAddToHomeStep, IosConfirmAddStep];
  const Step1 = browser === "whale" ? IosWhaleShareStep : IosChromeShareStep;
  return [Step1, IosAddToHomeStep, IosConfirmAddStep];
}

// ─── 기기 동기화 설정 단계 일러스트 (모바일 웹 기준) ──────────────────────────

/** 동기화 1단계: 우측 상단 ⋯ 더보기 → '자산 공유 · 동기화'(간편 공유 · 기기 동기화 가로 배치) */
function SyncStepMenu({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="우측 상단 더보기 메뉴의 자산 공유 동기화 항목" fill="none">
      <PhoneFrame />
      {/* 상단 앱바 */}
      <rect x="39" y="32" width="142" height="22" fill="currentColor" className="text-background dark:text-muted/10" />
      <line x1="39" y1="54" x2="181" y2="54" stroke="currentColor" className={FRAME} strokeWidth="1" />
      <text x="50" y="46.5" fontSize="8" fontWeight="800" className="text-foreground" fill="currentColor">시크릿에셋</text>

      {/* [강조] ⋯ 더보기 (우측 상단, 가로 점) */}
      <circle cx="170" cy="43" r="9" fill={BRAND} opacity="0.15" />
      <circle cx="170" cy="43" r="12.5" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <g fill={BRAND}>
        <circle cx="165.5" cy="43" r="1.5" />
        <circle cx="170" cy="43" r="1.5" />
        <circle cx="174.5" cy="43" r="1.5" />
      </g>

      {/* 본문 흐릿 라인 */}
      <rect x="50" y="70" width="120" height="7" rx="3.5" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="50" y="84" width="90" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.35" />

      {/* 메뉴 패널 (가로형) */}
      <rect x="46" y="104" width="128" height="100" rx="13" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.9" />
      {/* 패널 제목 */}
      <text x="58" y="123" fontSize="7.2" fontWeight="800" className="text-foreground" fill="currentColor">자산 공유 · 동기화</text>
      <line x1="58" y1="130" x2="162" y2="130" stroke="currentColor" className={FRAME} strokeWidth="0.7" opacity="0.5" />

      {/* 두 옵션 가로 배치 — 간편 공유 | 기기 동기화(강조) */}
      {/* 간편 공유 카드 */}
      <g transform="translate(58, 140)">
        <rect x="0" y="0" width="48" height="50" rx="9" className={SURFACE} fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
        {/* 공유 아이콘 */}
        <g transform="translate(24, 18)" stroke="currentColor" className={HINT} strokeWidth="1.3" fill="none">
          <circle cx="-6" cy="0" r="2.2" /><circle cx="6" cy="-5" r="2.2" /><circle cx="6" cy="5" r="2.2" />
          <path d="M-3.8 -1.1 L3.8 -3.9 M-3.8 1.1 L3.8 3.9" />
        </g>
        <text x="24" y="40" fontSize="6.4" fontWeight="700" textAnchor="middle" className={HINT} fill="currentColor">간편 공유</text>
      </g>
      {/* [강조] 기기 동기화 카드 */}
      <g transform="translate(114, 140)">
        <rect x="0" y="0" width="48" height="50" rx="9" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="48" height="50" rx="9" stroke={BRAND} strokeWidth="1.2" />
        {/* 클라우드 아이콘 */}
        <path d="M16 26 a4 4 0 0 1 0.5 -7.9 a5 5 0 0 1 9.6 1 a3.3 3.3 0 0 1 0.4 6.9 z" stroke={BRAND} strokeWidth="1.4" fill="none" strokeLinejoin="round" />
        <text x="24" y="40" fontSize="6.4" fontWeight="800" textAnchor="middle" fill={BRAND}>기기 동기화</text>
        <circle cx="24" cy="25" r="20" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      </g>

      {/* 화살표 → ⋯ */}
      <g transform="translate(170, 20)">
        <path d="M0 -6 V6" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 3 L0 6 L3 3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 동기화 2단계: 기기 동기화 다이얼로그 — 금고 암호 입력 → '동기화 시작' */
function SyncStepPassphrase({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="기기 동기화 금고 암호 입력" fill="none">
      <PhoneFrame />
      <rect x="50" y="40" width="120" height="7" rx="3.5" className={LINE} fill="currentColor" opacity="0.22" />

      {/* 다이얼로그 카드 */}
      <rect x="46" y="62" width="128" height="172" rx="14" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />

      {/* 타이틀: 클라우드 + 기기 동기화 */}
      <path d="M59 90 a3.3 3.3 0 0 1 0.4 -6.5 a4.2 4.2 0 0 1 8 0.8 a2.8 2.8 0 0 1 0.3 5.7 z" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <text x="76" y="89" fontSize="8.5" fontWeight="800" className="text-foreground" fill="currentColor">기기 동기화</text>

      {/* 라벨 + [강조] 입력 필드 (점) */}
      <text x="58" y="116" fontSize="6.8" fontWeight="700" className={HINT} fill="currentColor">금고 암호</text>
      <rect x="58" y="122" width="104" height="20" rx="6" className={SURFACE} fill="currentColor" stroke={BRAND} strokeWidth="1.3" />
      <g fill="currentColor" className={HINT}>
        <circle cx="69" cy="132" r="2" /><circle cx="77" cy="132" r="2" /><circle cx="85" cy="132" r="2" />
        <circle cx="93" cy="132" r="2" /><circle cx="101" cy="132" r="2" /><circle cx="109" cy="132" r="2" />
      </g>

      {/* 이 기기 기억하기 */}
      <rect x="58" y="152" width="9" height="9" rx="2.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      <path d="M60 156.5 l2 2 l3 -3.5" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="72" y="159.5" fontSize="6.5" fontWeight="500" className={HINT} fill="currentColor">이 기기 기억하기</text>

      {/* [강조] 동기화 시작 버튼 */}
      <rect x="58" y="174" width="104" height="22" rx="7" fill={BRAND} />
      <text x="110" y="188.5" fontSize="8" fontWeight="800" textAnchor="middle" fill="#fff">동기화 시작</text>
      <circle cx="110" cy="185" r="15" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />

      {/* 화살표 → 입력 필드 */}
      <g transform="translate(168, 132)">
        <path d="M6 0 L-4 0" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M0 -3.5 L-4 0 L0 3.5" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 동기화 3단계: 자동 동기화 켜짐 → '다른 기기 동기화 링크' 복사·QR·공유 */
function SyncStepLink({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="다른 기기 동기화 링크 복사 및 공유" fill="none">
      <PhoneFrame />

      {/* 자동 동기화 켜짐 배너 */}
      <rect x="50" y="44" width="120" height="18" rx="6" fill={BRAND} opacity="0.1" />
      <rect x="50" y="44" width="120" height="18" rx="6" stroke={BRAND} strokeWidth="0.8" />
      <g transform="translate(60, 53)" stroke={BRAND} strokeWidth="1.2" fill="none" strokeLinecap="round">
        <path d="M-3 -1 a3.2 3.2 0 1 1 0.6 2.2" />
        <path d="M-3 -3.4 V-1 H-0.6" strokeLinejoin="round" />
      </g>
      <text x="70" y="55.5" fontSize="6.5" fontWeight="700" fill={BRAND}>자동 동기화 켜짐</text>

      {/* 카드: 다른 기기 동기화 링크 */}
      <rect x="46" y="74" width="128" height="124" rx="12" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />
      {/* 링크 아이콘 + 제목 */}
      <g transform="translate(58, 92)" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M0 3 a3 3 0 0 1 0 -4 l2 -2 a3 3 0 0 1 4 4 l-1 1" />
        <path d="M6 1 a3 3 0 0 1 0 4 l-2 2 a3 3 0 0 1 -4 -4 l1 -1" />
      </g>
      <text x="70" y="93" fontSize="7.4" fontWeight="800" className="text-foreground" fill="currentColor">다른 기기 동기화 링크</text>

      {/* [강조] 링크 pill */}
      <rect x="58" y="106" width="104" height="18" rx="6" className={SURFACE} fill="currentColor" stroke={BRAND} strokeWidth="1.2" />
      <text x="64" y="117.5" fontSize="5.6" fontWeight="500" fontFamily="monospace" className={HINT} fill="currentColor">{DOMAIN}/#sync=…</text>

      {/* 버튼 행: 복사 / QR / 공유 */}
      <g transform="translate(58, 134)">
        {/* 복사 (강조) */}
        <rect x="0" y="0" width="32" height="20" rx="6" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="32" height="20" rx="6" stroke={BRAND} strokeWidth="1.1" />
        <g transform="translate(9, 6)" stroke={BRAND} strokeWidth="1.1" fill="none" strokeLinejoin="round">
          <rect x="2" y="2" width="7" height="7" rx="1.4" />
          <path d="M0 6 V0 h6" />
        </g>
        <text x="22" y="13" fontSize="5.5" fontWeight="700" fill={BRAND}>복사</text>
        {/* QR */}
        <rect x="38" y="0" width="32" height="20" rx="6" className={SURFACE} fill="currentColor" />
        <g transform="translate(45, 5)" stroke="currentColor" className={HINT} strokeWidth="1" fill="none">
          <rect x="0" y="0" width="4" height="4" rx="0.8" /><rect x="6" y="0" width="4" height="4" rx="0.8" /><rect x="0" y="6" width="4" height="4" rx="0.8" />
          <rect x="7" y="7" width="2.5" height="2.5" rx="0.6" />
        </g>
        <text x="60" y="13" fontSize="5.5" fontWeight="600" className={HINT} fill="currentColor">QR</text>
        {/* 공유 */}
        <rect x="76" y="0" width="32" height="20" rx="6" className={SURFACE} fill="currentColor" />
        <g transform="translate(84, 5)" stroke="currentColor" className={HINT} strokeWidth="1" fill="none">
          <circle cx="0" cy="0" r="1.6" /><circle cx="7" cy="-3" r="1.6" /><circle cx="7" cy="3" r="1.6" />
          <path d="M1.4 -0.8 L5.6 -2.4 M1.4 0.8 L5.6 2.4" />
        </g>
        <text x="93" y="13" fontSize="5.5" fontWeight="600" className={HINT} fill="currentColor">공유</text>
      </g>

      {/* 화살표 → 복사 버튼 */}
      <g transform="translate(74, 168)">
        <path d="M0 8 V-2" stroke={BRAND} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M-3 1 L0 -2 L3 1" stroke={BRAND} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 동기화 4단계: 새 기기에서 링크 열고 금고 암호 입력 → 동기화 완료 */
function SyncStepNewDevice({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="새 기기에서 금고 암호 입력 후 동기화 완료" fill="none">
      <PhoneFrame accent={ACCENT} />
      <DeviceBadge />

      {/* '이 기기 연결' 카드 */}
      <rect x="46" y="60" width="128" height="150" rx="14" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />
      <path d="M59 86 a3.3 3.3 0 0 1 0.4 -6.5 a4.2 4.2 0 0 1 8 0.8 a2.8 2.8 0 0 1 0.3 5.7 z" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <text x="76" y="85" fontSize="8" fontWeight="800" className="text-foreground" fill="currentColor">이 기기 연결</text>

      {/* 동기화 코드(읽기전용) */}
      <rect x="58" y="98" width="104" height="15" rx="5" className={SURFACE} fill="currentColor" />
      <text x="110" y="108" fontSize="5.6" fontWeight="500" fontFamily="monospace" textAnchor="middle" className={HINT} fill="currentColor">sync:••••••••</text>

      {/* [강조] 금고 암호 입력 */}
      <text x="58" y="128" fontSize="6.6" fontWeight="700" className={HINT} fill="currentColor">금고 암호</text>
      <rect x="58" y="133" width="104" height="19" rx="6" className={SURFACE} fill="currentColor" stroke={BRAND} strokeWidth="1.3" />
      <g fill="currentColor" className={HINT}>
        <circle cx="69" cy="142.5" r="2" /><circle cx="77" cy="142.5" r="2" /><circle cx="85" cy="142.5" r="2" />
        <circle cx="93" cy="142.5" r="2" /><circle cx="101" cy="142.5" r="2" /><circle cx="109" cy="142.5" r="2" />
      </g>

      {/* 연결하기 버튼 */}
      <rect x="58" y="162" width="104" height="20" rx="6.5" fill={BRAND} />
      <text x="110" y="175.5" fontSize="7.6" fontWeight="800" textAnchor="middle" fill="#fff">연결하기</text>

      {/* 동기화 완료 배지 */}
      <g transform="translate(110, 234)">
        <circle cx="0" cy="0" r="15" fill={BRAND} opacity="0.12" />
        <circle cx="0" cy="0" r="15" stroke={BRAND} strokeWidth="1.4" />
        <path d="M-6 0 l4 4 l8 -9" stroke={BRAND} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="110" y="259" fontSize="6.6" fontWeight="700" textAnchor="middle" fill={BRAND}>동기화 완료</text>
    </svg>
  );
}

const SYNC_STEPS: { Step: FC<IllustrationProps>; caption: string }[] = [
  { Step: SyncStepMenu, caption: "① 우측 상단 ⋯ 더보기 → 자산 공유 · 동기화" },
  { Step: SyncStepPassphrase, caption: "② 기기 동기화 → 금고 암호 입력 후 시작" },
  { Step: SyncStepLink, caption: "③ 다른 기기 동기화 링크 복사 · 공유" },
  { Step: SyncStepNewDevice, caption: "④ 새 기기에서 링크 열고 금고 암호 → 동기화" },
];

export interface AnimStep { Step: FC<IllustrationProps>; caption?: string }

/**
 * 단계형 SVG 애니메이션 공용 플레이어.
 * - 캡션(있을 때만)·단계 점·멈춤/시작 버튼 포함. 점 클릭 시 해당 단계로 이동(+일시정지).
 * - **현재 컷 1개만 렌더(key={active}로 remount)** — 구형 iOS Safari에서 opacity 스택 레이어의
 *   repaint 누락으로 다음 컷 미전환되던 버그 회피. 진입 페이드는 `motion-safe`로 reduced-motion 대응.
 * - 컨트롤은 `pointer-events-auto`로 상위가 pointer-events-none(예: 공지 본문)이어도 조작 가능.
 */
export function StepAnimationPlayer({
  steps,
  intervalMs = 3000,
  resetKey,
  className,
}: { steps: AnimStep[]; intervalMs?: number; resetKey?: string } & IllustrationProps) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const hasCaptions = steps.some(s => s.caption);

  // 시퀀스가 바뀌면 첫 단계로 리셋
  useEffect(() => { setActive(0); }, [resetKey]);

  // 자동 재생(컷 전환은 콘텐츠 진행이라 reduced-motion에서도 동작 — 페이드만 motion-safe로 비활성). 멈춤 버튼으로 정지.
  useEffect(() => {
    if (!playing || steps.length <= 1) return;
    const id = setInterval(() => setActive(a => (a + 1) % steps.length), intervalMs);
    return () => clearInterval(id);
  }, [playing, steps.length, intervalMs]);

  // steps 길이가 줄어드는 prop 변경 직후(resetKey 리셋 effect는 렌더 후 실행) active가 범위를 넘는 한 프레임 방어
  const safeActive = Math.min(active, steps.length - 1);
  const ActiveStep = steps[safeActive].Step;

  return (
    <div className={className}>
      <div className="relative mx-auto w-full max-w-[240px]">
        {/* 220:290 비율 스페이서 — aspect-ratio 미지원 폴백 */}
        <div style={{ paddingTop: "131.818%" }} aria-hidden />
        {/* 활성 컷만 렌더 + key로 remount → 모든 브라우저에서 전환 보장(구형 Safari opacity repaint 버그 회피) */}
        <div
          key={safeActive}
          className="absolute inset-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
        >
          <ActiveStep className="w-full h-full text-foreground" />
        </div>
      </div>

      {/* 단계 설명 캡션 (레이아웃 시프트 방지 위해 최소 높이 고정) */}
      {hasCaptions && (
        <p className="mt-2 min-h-9 px-2 text-center text-[11px] font-medium leading-relaxed text-muted-foreground text-balance">
          {steps[safeActive].caption}
        </p>
      )}

      {/* 컨트롤: 멈춤/시작 + 단계 점 */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? "애니메이션 멈춤" : "애니메이션 시작"}
          className="pointer-events-auto relative flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-[color,background-color,transform] hover:text-foreground active:not-disabled:scale-[0.96] after:absolute after:-inset-2"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setActive(i); setPlaying(false); }}
              aria-label={`${i + 1}단계 보기`}
              className={`pointer-events-auto relative size-3 rounded-full border-0 p-0 transition-[transform,background-color] duration-300 after:absolute after:-inset-2 hover:opacity-80 ${i === safeActive ? "scale-110" : "bg-border"}`}
              style={i === safeActive ? { backgroundColor: BRAND } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 기기 동기화 설정 흐름 — 4단계 자동 순환 (notice 등 재사용) */
export function SyncSetupAnimation({ className }: IllustrationProps) {
  return <StepAnimationPlayer steps={SYNC_STEPS} intervalMs={3000} className={className} />;
}

// ─── PWA 설치 → 복원 흐름 일러스트 ───────────────────────────────────────────

/** PWA 설치 1단계: 우측 상단 [앱 설치] 버튼 클릭 → 복원 코드 자동 복사 */
function PwaCodeCopyStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="우측 상단 앱 설치 버튼 클릭 후 복원 코드 복사" fill="none">
      <PhoneFrame />
      {/* 상단 앱바 */}
      <rect x="39" y="32" width="142" height="22" fill="currentColor" className="text-background dark:text-muted/10" />
      <line x1="39" y1="54" x2="181" y2="54" stroke="currentColor" className={FRAME} strokeWidth="1" />
      <text x="50" y="46.5" fontSize="8" fontWeight="800" className="text-foreground" fill="currentColor">시크릿에셋</text>

      {/* [강조] 우측 상단 앱 설치 버튼 (다운로드 아이콘) */}
      <rect x="150" y="36" width="24" height="15" rx="5" fill={BRAND} opacity="0.16" />
      <rect x="150" y="36" width="24" height="15" rx="5" stroke={BRAND} strokeWidth="1" />
      <g transform="translate(160, 40)" stroke={BRAND} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 -1 V4 M0 2 L2 4 L4 2 M-0.5 6.5 H4.5" />
      </g>
      <circle cx="162" cy="43.5" r="13" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      {/* 화살표 → 설치 버튼 */}
      <g transform="translate(162, 20)">
        <path d="M0 -5 V5" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-3 2 L0 5 L3 2" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* 복원 코드 복사됨 카드 */}
      <rect x="46" y="80" width="128" height="118" rx="13" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="1" />
      {/* 복사됨 배지 */}
      <g transform="translate(58, 96)">
        <rect x="0" y="0" width="104" height="18" rx="5" fill={BRAND} opacity="0.1" />
        <rect x="0" y="0" width="104" height="18" rx="5" stroke={BRAND} strokeWidth="0.8" />
        <path d="M8 9 l2.6 2.6 l5.4 -6" stroke={BRAND} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="24" y="12" fontSize="5.8" fontWeight="700" fill={BRAND}>복원 코드가 복사되었습니다</text>
      </g>
      {/* 라벨 + 코드 pill + 복사 버튼 */}
      <text x="58" y="132" fontSize="6.6" fontWeight="700" className={HINT} fill="currentColor">복원 코드</text>
      <rect x="58" y="138" width="80" height="18" rx="5" className={SURFACE} fill="currentColor" />
      <text x="64" y="149.5" fontSize="5.6" fontWeight="500" fontFamily="monospace" className={HINT} fill="currentColor">share:••••_••••</text>
      <rect x="142" y="138" width="20" height="18" rx="5" fill={BRAND} opacity="0.16" />
      <rect x="142" y="138" width="20" height="18" rx="5" stroke={BRAND} strokeWidth="1" />
      <g transform="translate(148.5, 143)" stroke={BRAND} strokeWidth="1.1" fill="none" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="6" height="6" rx="1.2" />
        <path d="M0 5 V0 h5" />
      </g>
      {/* 안내 라인 */}
      <rect x="58" y="170" width="104" height="4" rx="2" className={LINE} fill="currentColor" opacity="0.4" />
      <rect x="58" y="180" width="76" height="4" rx="2" className={LINE} fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** PWA 설치 단계: 앱 첫 실행 — 복원 코드 붙여넣기 + (동기화 시) 금고 암호 입력 */
function PwaFirstLaunchStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="앱(PWA) 첫 실행 — 동기화는 금고 암호, 일반 설치는 PIN 4자리로 복원" fill="none">
      <PhoneFrame accent={BRAND} />
      <DeviceBadge label="앱 (PWA)" color={BRAND} width={52} />

      {/* 링크 아이콘 배지 */}
      <rect x="99" y="48" width="22" height="22" rx="6.5" fill={BRAND} />
      <g transform="translate(110, 59)" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M-1 3 a3 3 0 0 1 0 -4 l1.5 -1.5 a3 3 0 0 1 4 4" />
        <path d="M1 -3 a3 3 0 0 1 0 4 l-1.5 1.5 a3 3 0 0 1 -4 -4" />
      </g>

      {/* 타이틀 */}
      <text x="110" y="80" fontSize="7.4" fontWeight="800" textAnchor="middle" className="text-foreground" fill="currentColor">웹에서 쓰던 자산이 있나요?</text>

      {/* 코드 붙여넣기 입력 */}
      <rect x="56" y="88" width="108" height="16" rx="5" className={SURFACE} fill="currentColor" stroke={BRAND} strokeWidth="1.1" />
      <g transform="translate(64, 96)" stroke="currentColor" className={HINT} strokeWidth="0.9" fill="none" strokeLinejoin="round">
        <rect x="0" y="-3.5" width="6" height="7" rx="1.2" />
        <rect x="1.5" y="-4.8" width="3" height="2" rx="0.5" />
      </g>
      <text x="78" y="99" fontSize="5.4" fontWeight="600" className={HINT} fill="currentColor">복원 · 동기화 코드 붙여넣기</text>

      {/* 복원 방법 구분 라벨 */}
      <text x="56" y="116" fontSize="5.8" fontWeight="700" className={HINT} fill="currentColor">복원 방법 — 설치 유형에 따라 입력</text>

      {/* ① 동기화 연동 → 금고 암호 */}
      <rect x="56" y="120" width="108" height="28" rx="7" fill={BRAND} opacity="0.07" />
      <rect x="56" y="120" width="108" height="28" rx="7" stroke={BRAND} strokeWidth="0.9" />
      <text x="63" y="132" fontSize="6" fontWeight="800" fill={BRAND}>동기화 연동</text>
      <text x="63" y="142" fontSize="5.4" fontWeight="600" className={HINT} fill="currentColor">금고 암호</text>
      <rect x="104" y="126" width="54" height="16" rx="5" className={SURFACE} fill="currentColor" stroke={BRAND} strokeWidth="1" />
      <g fill="currentColor" className={HINT}>
        <circle cx="116" cy="134" r="1.7" /><circle cx="123" cy="134" r="1.7" /><circle cx="130" cy="134" r="1.7" />
        <circle cx="137" cy="134" r="1.7" /><circle cx="144" cy="134" r="1.7" />
      </g>

      {/* ② 일반 설치 → PIN 4자리 */}
      <rect x="56" y="152" width="108" height="28" rx="7" className={SURFACE} fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
      <text x="63" y="164" fontSize="6" fontWeight="800" className="text-foreground" fill="currentColor">일반 설치</text>
      <text x="63" y="174" fontSize="5.4" fontWeight="600" className={HINT} fill="currentColor">PIN 4자리</text>
      <g stroke="currentColor" className={HINT} strokeWidth="1" fill="none">
        <rect x="110" y="160" width="10" height="13" rx="2.5" />
        <rect x="124" y="160" width="10" height="13" rx="2.5" />
        <rect x="138" y="160" width="10" height="13" rx="2.5" />
        <rect x="152" y="160" width="10" height="13" rx="2.5" />
      </g>
      <g fill="currentColor" className={HINT}>
        <circle cx="115" cy="166.5" r="1.6" /><circle cx="129" cy="166.5" r="1.6" />
        <circle cx="143" cy="166.5" r="1.6" /><circle cx="157" cy="166.5" r="1.6" />
      </g>

      {/* 자산 가져오기 버튼 */}
      <rect x="56" y="188" width="108" height="20" rx="6.5" fill={BRAND} />
      <text x="110" y="201.5" fontSize="7.4" fontWeight="800" textAnchor="middle" fill="#fff">자산 가져오기</text>
      <circle cx="110" cy="198" r="15" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  );
}

/** PWA 설치→복원 단계 구성 — ①앱 설치(복원 코드)·④새 기기 복원은 공통, ②③은 접속 브라우저별 */
function buildPwaSetupSteps(platform: GuidePlatform, browser: GuideBrowser, safariModern: boolean): AnimStep[] {
  const codeStep: AnimStep = { Step: PwaCodeCopyStep, caption: "① 우측 상단 [앱 설치] 버튼 → 복원 코드 자동 복사" };
  const launchText = "앱(PWA) 첫 실행 → 동기화는 금고 암호 · 일반은 PIN 4자리";
  // PC: 네이티브 설치라 브라우저별 공유·홈추가 단계 없음 → 공통 2컷
  if (platform === "pc") {
    return [codeStep, { Step: PwaFirstLaunchStep, caption: `② ${launchText}` }];
  }
  // 모바일: ②③ = 접속 브라우저별 설치 단계(공유/메뉴 → 홈 화면에 추가)
  const bs = getGuideSteps(platform, browser, safariModern);
  return [
    codeStep,
    { Step: bs[0], caption: "② 브라우저 공유 · 메뉴 열기" },
    { Step: bs[1], caption: "③ 홈 화면에 추가" },
    { Step: PwaFirstLaunchStep, caption: `④ ${launchText}` },
  ];
}

/**
 * PWA 설치→복원 흐름 공용 가이드 — ①앱 설치(복원 코드)·④새 기기 복원은 공통,
 * ②③은 접속 브라우저별 SVG. 공지(notice)·설치 가이드(InstallGuideContent) 공용. 멈춤/시작·단계 점 포함.
 */
export function PwaSetupAnimation({
  platform,
  browser,
  safariModern = false,
  className,
}: IllustrationProps & { platform: GuidePlatform; browser: GuideBrowser; safariModern?: boolean }) {
  const steps = useMemo(() => buildPwaSetupSteps(platform, browser, safariModern), [platform, browser, safariModern]);
  return <StepAnimationPlayer steps={steps} intervalMs={3000} resetKey={`pwa-${platform}-${browser}-${safariModern}`} className={className} />;
}

