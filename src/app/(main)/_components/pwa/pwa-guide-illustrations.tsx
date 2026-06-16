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

import { APP_CONFIG } from "@/config/app";

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

/** iOS 1단계: Safari 하단 우측 메뉴 ⋯ 클릭 후 나타나는 팝업 최상단 공유 버튼 강조 */
export function IosShareStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="Safari 하단 우측 메뉴의 공유 버튼 위치" fill="none">
      <PhoneFrame />
      
      {/* Safari 상단 주소창 영역 */}
      <rect x="48" y="34" width="124" height="18" rx="9" className={SURFACE} fill="currentColor" />
      {/* 자물쇠 아이콘 */}
      <path d="M62 43 v-2.5 a1.8 1.8 0 0 1 3.6 0 v2.5" stroke="currentColor" className={HINT} strokeWidth="1" />
      <rect x="61" y="42.5" width="5.6" height="4.5" rx="1" className={HINT} fill="currentColor" />
      {/* 주소 텍스트 (실제 도메인 주소 반영) */}
      <text x="110" y="46.5" fontSize="7" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>
      
      {/* 본문 콘텐츠 라인 피드 (스크롤 페이지 묘사) */}
      <rect x="52" y="66" width="116" height="8" rx="4" className={LINE} fill="currentColor" opacity="0.5" />
      <rect x="52" y="82" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.5" />
      
      {/* Safari 하단 우측 ⋯ 클릭 시 팝업되는 메뉴창 (세련된 블러/팝업 느낌) */}
      <rect x="65" y="105" width="112" height="120" rx="12" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />
      
      {/* 팝업 최상단 헤더 영역과 [공유] 버튼 */}
      <rect x="65" y="105" width="112" height="28" rx="12 12 0 0" className={SURFACE} fill="currentColor" />
      <line x1="65" y1="133" x2="177" y2="133" stroke="currentColor" className={FRAME} strokeWidth="0.8" />
      
      {/* 팝업 상단 좌측 텍스트 (가상의 페이지 타이틀/액션) */}
      <rect x="74" y="117" width="28" height="4" rx="2" className={HINT} fill="currentColor" />

      {/* [강조] 최상단 공유 버튼 */}
      <g transform="translate(130, 110)">
        <rect x="0" y="0" width="38" height="14" rx="4" fill={BRAND} opacity="0.15" />
        <rect x="0" y="0" width="38" height="14" rx="4" stroke={BRAND} strokeWidth="0.8" />
        <text x="19" y="9.5" fontSize="6.5" fontWeight="bold" fill={BRAND} textAnchor="middle">공유</text>
        {/* 터치 포인트 펄스 */}
        <circle cx="19" cy="7" r="7" stroke={BRAND} strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.6" />
      </g>
      
      {/* 팝업 메뉴 항목들 */}
      <g transform="translate(74, 142)" className={LINE}>
        <rect x="0" y="0" width="80" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="14" width="60" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="28" width="70" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="42" width="50" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="56" width="64" height="4" rx="2" fill="currentColor" opacity="0.8" />
      </g>
      
      {/* 하단 Safari 고정 툴바 배경 */}
      <rect x="39" y="228" width="142" height="34" rx="0" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="228" x2="181" y2="228" stroke="currentColor" className={FRAME} strokeWidth="1" />
      
      {/* Safari 하단 툴바 아이콘들 (뒤로가기, 앞으로가기, 책, 탭, 점세개 ⋯) */}
      {/* 뒤로가기 < */}
      <path d="M50 245 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 앞으로가기 > */}
      <path d="M68 245 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 책 북마크 */}
      <path d="M92 243.5 h10 v11.5 h-10 z" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      <line x1="97" y1="243.5" x2="97" y2="255" stroke="currentColor" className={HINT} strokeWidth="1.2" />
      
      {/* 탭 사각형 */}
      <rect x="116" y="244" width="9" height="9" rx="1.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />
      <rect x="120" y="248" width="9" height="9" rx="1.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />

      {/* 하단 우측 메뉴 점세개 (⋯) - 클릭된 상태로 강조 */}
      <circle cx="156" cy="249" r="9.5" fill={BRAND} opacity="0.1" />
      <circle cx="156" cy="249" r="13" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      <circle cx="148" cy="249" r="1.2" fill={BRAND} />
      <circle cx="156" cy="249" r="1.2" fill={BRAND} />
      <circle cx="164" cy="249" r="1.2" fill={BRAND} />

      {/* 가이드 화살표: 팝업 최상단의 공유 버튼을 명확하게 지목 */}
      <g transform="translate(149, 94)">
        <path d="M0 -8 V5" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 2 L0 5 L3 2" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS Chrome 1단계: 주소창 옆 메뉴(⋯) 터치 → 팝업 메뉴 상단 공유 항목 강조 (Safari와 동일 흐름) */
export function IosChromeShareStep({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="iOS 크롬 주소창 옆 메뉴의 공유 위치" fill="none">
      <PhoneFrame />

      {/* iOS Chrome 상단 주소창 영역 (메뉴 버튼 공간 확보 위해 단축) */}
      <rect x="44" y="34" width="100" height="20" rx="10" className={SURFACE} fill="currentColor" />
      {/* 자물쇠 */}
      <rect x="52" y="42.5" width="4.5" height="3.5" rx="0.8" className={HINT} fill="currentColor" />
      {/* 주소 텍스트 (실제 도메인 주소 반영) */}
      <text x="96" y="47.5" fontSize="6.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>

      {/* [강조] 주소창 옆 메뉴 버튼 (⋯ 세로 3점) - 클릭된 상태 */}
      <circle cx="164" cy="44" r="9.5" fill={BRAND} opacity="0.12" />
      <circle cx="164" cy="44" r="13" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <circle cx="164" cy="40" r="1.3" fill={BRAND} />
      <circle cx="164" cy="44" r="1.3" fill={BRAND} />
      <circle cx="164" cy="48" r="1.3" fill={BRAND} />

      {/* 메뉴 클릭 시 나타나는 팝업 (우상단에서 드롭) */}
      <rect x="92" y="62" width="86" height="120" rx="12" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />

      {/* [강조] 팝업 상단 공유 항목 */}
      <g transform="translate(98, 68)">
        <rect x="0" y="0" width="74" height="20" rx="6" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="74" height="20" rx="6" stroke={BRAND} strokeWidth="0.9" />
        {/* 공유 아이콘 (box+arrow) */}
        <g transform="translate(12, 10)" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-4" y="-1" width="8" height="7" rx="1.3" fill="none" />
          <path d="M0 -5 V1.5" />
          <path d="M-2.2 -3 L0 -5 L2.2 -3" />
        </g>
        <text x="46" y="13.5" fontSize="7" fontWeight="bold" fill={BRAND} textAnchor="middle">공유</text>
        {/* 터치 펄스 */}
        <circle cx="46" cy="10" r="9" stroke={BRAND} strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.55" />
      </g>

      {/* 팝업 나머지 메뉴 항목들 */}
      <g transform="translate(102, 100)" className={LINE}>
        <rect x="0" y="0" width="66" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="16" width="52" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="32" width="60" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="48" width="44" height="4" rx="2" fill="currentColor" opacity="0.8" />
      </g>

      {/* 본문 콘텐츠 라인 (팝업 뒤) */}
      <rect x="52" y="200" width="116" height="7" rx="3.5" className={LINE} fill="currentColor" opacity="0.5" />
      <rect x="52" y="214" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.5" />

      {/* 가이드 화살표: 메뉴 버튼 지목 */}
      <g transform="translate(164, 22)">
        <path d="M0 -4 V6" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 3 L0 6 L3 3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** iOS Whale 1단계: 주소창 옆 메뉴(☰) 터치 → 팝업 메뉴 상단 공유 항목 강조 (Safari와 동일 흐름) */
export function IosWhaleShareStep({ className }: IllustrationProps) {
  const WHALE_GREEN = "#00cd3c";
  return (
    <svg viewBox="0 0 220 290" className={className} role="img" aria-label="iOS 웨일 주소창 옆 메뉴의 공유 위치" fill="none">
      <PhoneFrame />

      {/* iOS Whale 상단 주소창 영역 (메뉴 버튼 공간 확보 위해 단축) */}
      <rect x="44" y="34" width="100" height="20" rx="10" className={SURFACE} fill="currentColor" />
      {/* 고래 심볼 로고 느낌 포인트 (웨일 식별) */}
      <circle cx="52" cy="44" r="3.5" fill={WHALE_GREEN} opacity="0.8" />
      {/* 주소 텍스트 (실제 도메인 주소 반영) */}
      <text x="98" y="47.5" fontSize="6.5" fontWeight="500" textAnchor="middle" className={HINT} fill="currentColor">{DOMAIN}</text>

      {/* [강조] 주소창 옆 메뉴 버튼 (☰) - 클릭된 상태 */}
      <circle cx="164" cy="44" r="9.5" fill={BRAND} opacity="0.12" />
      <circle cx="164" cy="44" r="13" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <g stroke={BRAND} strokeWidth="1.5" strokeLinecap="round" transform="translate(159, 41)">
        <line x1="0" y1="0" x2="10" y2="0" />
        <line x1="0" y1="3" x2="10" y2="3" />
        <line x1="0" y1="6" x2="10" y2="6" />
      </g>

      {/* 메뉴 클릭 시 나타나는 팝업 (우상단에서 드롭) */}
      <rect x="92" y="62" width="86" height="120" rx="12" fill="currentColor" className="text-popover shadow-2xl" stroke="currentColor" strokeWidth="0.8" />

      {/* [강조] 팝업 상단 공유 항목 */}
      <g transform="translate(98, 68)">
        <rect x="0" y="0" width="74" height="20" rx="6" fill={BRAND} opacity="0.14" />
        <rect x="0" y="0" width="74" height="20" rx="6" stroke={BRAND} strokeWidth="0.9" />
        {/* 공유 아이콘 (box+arrow) */}
        <g transform="translate(12, 10)" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-4" y="-1" width="8" height="7" rx="1.3" fill="none" />
          <path d="M0 -5 V1.5" />
          <path d="M-2.2 -3 L0 -5 L2.2 -3" />
        </g>
        <text x="46" y="13.5" fontSize="7" fontWeight="bold" fill={BRAND} textAnchor="middle">공유</text>
        {/* 터치 펄스 */}
        <circle cx="46" cy="10" r="9" stroke={BRAND} strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.55" />
      </g>

      {/* 팝업 나머지 메뉴 항목들 */}
      <g transform="translate(102, 100)" className={LINE}>
        <rect x="0" y="0" width="66" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="16" width="52" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="32" width="60" height="4" rx="2" fill="currentColor" />
        <rect x="0" y="48" width="44" height="4" rx="2" fill="currentColor" opacity="0.8" />
      </g>

      {/* 본문 콘텐츠 라인 (팝업 뒤) */}
      <rect x="52" y="200" width="116" height="7" rx="3.5" className={LINE} fill="currentColor" opacity="0.5" />
      <rect x="52" y="214" width="92" height="6" rx="3" className={LINE} fill="currentColor" opacity="0.5" />

      {/* 가이드 화살표: 메뉴 버튼 지목 */}
      <g transform="translate(164, 22)">
        <path d="M0 -4 V6" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 3 L0 6 L3 3" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* 2x3 그리드 형태의 도구들 */}
      {/* 1행 1열: 북마크 (비활성) */}
      <g transform="translate(50, 108)">
        <rect x="4" y="2" width="18" height="18" rx="4" className={LINE} fill="currentColor" />
        <text x="13" y="30" fontSize="5.5" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">북마크</text>
      </g>
      {/* 1행 2열: 저장됨 (비활성) */}
      <g transform="translate(80, 108)">
        <rect x="4" y="2" width="18" height="18" rx="4" className={LINE} fill="currentColor" />
        <text x="13" y="30" fontSize="5.5" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">저장됨</text>
      </g>
      {/* [강조] 1행 3열: 앱 추가 / 홈 화면에 추가 */}
      <g transform="translate(110, 108)">
        <rect x="0" y="-2" width="26" height="34" rx="6" fill={BRAND} opacity="0.14" />
        <rect x="0" y="-2" width="26" height="34" rx="6" stroke={BRAND} strokeWidth="1" />
        
        {/* 모니터/웹 화면에 + 아이콘 */}
        <rect x="4" y="2" width="18" height="14" rx="3.5" stroke={BRAND} strokeWidth="1.5" fill="none" />
        <path d="M13 5 v8 M9 9 h8" stroke={BRAND} strokeWidth="1.5" strokeLinecap="round" />
        
        {/* 실제 텍스트 추가 ("앱 추가") */}
        <text x="13" y="30" fontSize="6" fontWeight="800" textAnchor="middle" fill={BRAND}>앱 추가</text>
        {/* 펄스 링 */}
        <circle cx="13" cy="9" r="11" stroke={BRAND} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      </g>

      {/* 2행 1열: 다크 모드 (비활성) */}
      <g transform="translate(50, 148)">
        <rect x="4" y="2" width="18" height="18" rx="4" className={LINE} fill="currentColor" />
        <text x="13" y="30" fontSize="5.5" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">다크 모드</text>
      </g>
      {/* 2행 2열: 광고 차단 (비활성) */}
      <g transform="translate(80, 148)">
        <rect x="4" y="2" width="18" height="18" rx="4" className={LINE} fill="currentColor" />
        <text x="13" y="30" fontSize="5.5" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">광고 차단</text>
      </g>
      {/* 2행 3열: 설정 (비활성) */}
      <g transform="translate(110, 148)">
        <rect x="4" y="2" width="18" height="18" rx="4" className={LINE} fill="currentColor" />
        <text x="13" y="30" fontSize="5.5" fontWeight="500" textAnchor="middle" className={LINE} fill="currentColor">설정</text>
      </g>

      {/* 하단 삼성 인터넷 고정 툴바 */}
      <rect x="39" y="228" width="142" height="34" rx="0" fill="currentColor" className="text-background/95 dark:text-background/90" />
      <line x1="39" y1="228" x2="181" y2="228" stroke="currentColor" className={FRAME} strokeWidth="1" />
      
      {/* 툴바 아이콘들 (뒤로, 앞으로, 홈, 탭목록, ☰메뉴) */}
      <path d="M50 245 l-4 4 l4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 245 l4 4 l-4 4" stroke="currentColor" className={HINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 249 v-4.5 l4 -3.5 l4 3.5 v4.5 z" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <rect x="114" y="244" width="10" height="10" rx="2.5" stroke="currentColor" className={HINT} strokeWidth="1.2" fill="none" />

      {/* [강조] ☰ 메뉴 버튼 */}
      <circle cx="148" cy="249" r="10.5" fill={BRAND} opacity="0.15" />
      <g stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" transform="translate(143, 246)">
        <line x1="1" y1="1" x2="9" y2="1" />
        <line x1="1" y1="3.5" x2="9" y2="3.5" />
        <line x1="1" y1="6" x2="9" y2="6" />
      </g>

      {/* 가이드 지시 화살표 (☰ 메뉴 포인팅) */}
      <g transform="translate(148, 274)">
        <path d="M0 4 V-5" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M-3 -2 L0 -5 L3 -2" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
