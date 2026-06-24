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

import { useEffect, useState, type FC } from "react";

import { APP_CONFIG } from "@/config/app";
import type { GuidePlatform, GuideBrowser } from "@/lib/pwa/detect-browser";

const BRAND = "#5b6fbf"; // MAIN_PALETTE[0]
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
function PhoneFrame() {
  return (
    <>
      {/* 폰 그림자 및 배경 */}
      <rect x="35" y="10" width="150" height="270" rx="24" className="text-background" fill="currentColor" />
      <rect x="35" y="10" width="150" height="270" rx="24" className={SURFACE} fill="currentColor" opacity="0.1" />
      {/* 폰 테두리 */}
      <rect x="35" y="10" width="150" height="270" rx="24" stroke="currentColor" className={FRAME} strokeWidth="3.5" fill="none" />
      {/* 액정 화면 내부 경계 (베젤 안쪽) */}
      <rect x="39" y="14" width="142" height="262" rx="20" stroke="currentColor" className={FRAME} strokeWidth="1.2" fill="none" opacity="0.5" />
      {/* 상단 다이내믹 아일랜드 (카메라/센서부) */}
      <rect x="90" y="18" width="40" height="8" rx="4" fill="currentColor" className="text-foreground/80 dark:text-foreground/60" />
      <circle cx="110" cy="22" r="2.5" fill="currentColor" className="text-foreground/40 dark:text-foreground/20" />
      {/* 하단 iOS 홈 인디케이터 바 */}
      <rect x="85" y="268" width="50" height="3" rx="1.5" fill="currentColor" className="text-foreground/30 dark:text-foreground/20" />
    </>
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
function getGuideSteps(platform: GuideAnimPlatform, browser: GuideBrowser): FC<IllustrationProps>[] {
  if (platform === "ios") {
    const Step1 = browser === "safari" ? IosShareStep : browser === "whale" ? IosWhaleShareStep : IosChromeShareStep;
    return [Step1, IosAddToHomeStep, IosConfirmAddStep];
  }
  // android — 전 브라우저 3단계 통일
  if (browser === "samsung") return [SamsungMenuStep, SamsungAddToHomeStep, IosConfirmAddStep];
  const Step1 = browser === "whale" ? IosWhaleShareStep : IosChromeShareStep;
  return [Step1, IosAddToHomeStep, IosConfirmAddStep];
}

/**
 * 설치 가이드 — 브라우저별 3단계를 2.5초 간격 페이드로 자동 순환 재생하는 동영상형 공통 플레이어.
 * 설치 플로우와 통합 설치 가이드 양쪽에서 재사용.
 */
export function InstallGuideAnimation({
  platform,
  browser,
  className,
}: IllustrationProps & { platform: GuideAnimPlatform; browser: GuideBrowser }) {
  const steps = getGuideSteps(platform, browser);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    if (steps.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive(a => (a + 1) % steps.length), 2500);
    return () => clearInterval(id);
    // platform·browser가 바뀌면 시퀀스가 바뀌므로 재시작
  }, [platform, browser, steps.length]);

  return (
    <div className={className}>
      <div className="relative mx-auto w-full max-w-[260px]">
        {/* 220:290 비율 스페이서 — 구형 Safari(iOS 14 이하) 등 aspect-ratio 미지원 대비 */}
        <div style={{ paddingTop: "131.818%" }} aria-hidden />
        {steps.map((Step, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: i === active ? 1 : 0 }}
            aria-hidden={i === active ? undefined : true}
          >
            <Step className="w-full h-full text-foreground" />
          </div>
        ))}
      </div>
      {/* 단계 진행 점 인디케이터 */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-[transform,background-color] duration-300 ${i === active ? "scale-125" : "bg-border"}`}
            style={i === active ? { backgroundColor: BRAND } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

