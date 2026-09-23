"use client";

import React from "react";
import {
  Cpu, Code, Zap, Bot, Car, Landmark, FlaskConical, ShoppingBag, Truck, Rocket,
  Link2, Shield, Sparkles, Home, Globe, PiggyBank, ShieldCheck, Gem,
  type LucideIcon,
} from "lucide-react";
import type { Sector, StockType } from "@/lib/xray/classification-store";
import type { ConcentrationLevel } from "@/lib/xray/stock-xray";
import type { InvestorAvatarSpec, AccountKey } from "@/lib/xray/investor-type";
import { pick } from "@/lib/xray/seeded-pick";

// 인증카드 "투자 유형 테스트" 캐릭터 — 외부 이미지 없이 SVG로 직접 그린다.
// 얼굴(색+소품 아이콘)은 테마(SECTOR_ENUM) 축, 표정(눈=집중도·입=투자성향)은 별도 축, 바깥
// 원 색은 테마와 무관한 30색 팔레트에서 seed로 고른다 — 코너 배지 2개(지역·계좌)가 조합을 더한다.

type EyeKind = "dot" | "dotBig" | "sparkle" | "surprised" | "halfmoon" | "wink" | "slant" | "sleepy";
type MouthKind = "smile" | "grin" | "open" | "flat" | "smirk" | "gentle" | "tongue";

interface ThemeVisual {
  light: string;
  mid: string;
  icon: LucideIcon;
}

// 테마별 얼굴(타원)·소품 아이콘 색 — 바깥 원 색과 분리(아래 OUTER_BG_PALETTE 참고).
const THEME_VISUAL: Record<Sector, ThemeVisual> = {
  "AI 및 반도체": { light: "#cfe6ff", mid: "#4f8de0", icon: Cpu },
  "AI 및 소프트웨어": { light: "#e6d9fb", mid: "#9a5fe0", icon: Code },
  "AI 인프라 및 전력": { light: "#ffe6a8", mid: "#f2a83c", icon: Zap },
  "로봇 및 산업 자동화": { light: "#dde2f0", mid: "#7d8ab0", icon: Bot },
  "자율주행 및 모빌리티": { light: "#ffd6b8", mid: "#ff7a3c", icon: Car },
  "금융 및 핀테크": { light: "#c8f2ee", mid: "#3fbdb5", icon: Landmark },
  "바이오 및 헬스케어": { light: "#ffd6dc", mid: "#ff5c78", icon: FlaskConical },
  "소비재 및 유통": { light: "#ffd0f0", mid: "#e85fc4", icon: ShoppingBag },
  "인프라 및 물류": { light: "#cdeed4", mid: "#4cae66", icon: Truck },
  "방산 및 우주항공": { light: "#ffd0d0", mid: "#f04444", icon: Rocket },
  "블록체인 및 디지털자산": { light: "#dcd6fb", mid: "#6f5fea", icon: Link2 },
  "ETF/펀드": { light: "#cdeef7", mid: "#38b6dd", icon: Shield },
  기타: { light: "#fff0b8", mid: "#f2cf3c", icon: Sparkles },
};

// 집중도 → 눈 후보 풀. "집중형"일수록 강렬한 눈, "분산형"일수록 여유로운 눈.
const EYE_POOL_BY_CONCENTRATION: Record<ConcentrationLevel, readonly EyeKind[]> = {
  high: ["sparkle", "slant", "dotBig"],
  medium: ["dot", "halfmoon", "wink"],
  low: ["surprised", "sleepy", "wink"],
};

// 투자성향(stockType) → 입 후보 풀.
const MOUTH_POOL_BY_STOCK_TYPE: Record<StockType, readonly MouthKind[]> = {
  성장주: ["grin", "smirk"],
  혁신주: ["open", "grin"],
  배당성장주: ["smile", "gentle"],
  배당주: ["gentle", "smile"],
  지수투자: ["flat", "gentle"],
  가치주: ["smirk", "flat"],
  "채권/현금성": ["gentle", "flat"],
  기타: ["tongue", "smirk"],
};

// 바깥 원(배경) 전용 팔레트 — 테마와 완전히 무관, 12°씩 회전한 HSL로 30가지 생성(하드코딩 대신
// 공식으로 생성해 품질이 균일하고 필요시 COUNT만 바꿔 손쉽게 늘릴 수 있다). 파스텔→비비드→진한
// 톤 3단 그라데이션은 기존 테마 색상들의 실측 명도/채도 범위와 맞춰 정했다.
const OUTER_PALETTE_COUNT = 30;
function hslTriple(hue: number) {
  return {
    light: `hsl(${hue}, 68%, 87%)`,
    mid: `hsl(${hue}, 62%, 58%)`,
    deep: `hsl(${hue}, 68%, 34%)`,
  };
}
const OUTER_BG_PALETTE = Array.from({ length: OUTER_PALETTE_COUNT }, (_, i) => hslTriple(i * (360 / OUTER_PALETTE_COUNT)));

const ACCOUNT_ICON: Record<AccountKey, LucideIcon> = {
  domestic: Home, foreign: Globe, pension_irp: PiggyBank, isa: ShieldCheck, unlisted: Gem,
};

const DARK = "#1a1a1a";

function Eyes({ kind, mid }: { kind: EyeKind; mid: string }) {
  switch (kind) {
    case "sparkle":
      return (
        <>
          <circle cx="84" cy="120" r="10" fill="#fff" stroke={DARK} strokeWidth={1.6} />
          <circle cx="124" cy="120" r="10" fill="#fff" stroke={DARK} strokeWidth={1.6} />
          <path d="M84 114 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2z" fill={DARK} />
          <path d="M124 114 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2z" fill={DARK} />
        </>
      );
    case "surprised":
      return (
        <>
          <circle cx="84" cy="120" r="12" fill="#fff" stroke={DARK} strokeWidth={2} />
          <circle cx="124" cy="120" r="12" fill="#fff" stroke={DARK} strokeWidth={2} />
          <circle cx="84" cy="121" r="6" fill={DARK} />
          <circle cx="124" cy="121" r="6" fill={DARK} />
          <circle cx="86.5" cy="117" r="1.6" fill="#fff" />
          <circle cx="126.5" cy="117" r="1.6" fill="#fff" />
        </>
      );
    case "halfmoon":
      return (
        <>
          <path d="M74 118 Q84 108 94 118" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M114 118 Q124 108 134 118" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      );
    case "wink":
      return (
        <>
          <circle cx="84" cy="120" r="10" fill={DARK} />
          <circle cx="87" cy="116" r="2.4" fill="#fff" />
          <path d="M114 120 Q124 112 134 120" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      );
    case "slant":
      return (
        <>
          <path d="M74 114 Q84 106 96 118 Q84 122 74 114 Z" fill={DARK} />
          <path d="M134 114 Q124 106 112 118 Q124 122 134 114 Z" fill={DARK} />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M76 120 Q84 123 92 120" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <path d="M116 120 Q124 123 132 120" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </>
      );
    case "dotBig":
      return (
        <>
          <circle cx="84" cy="120" r="11" fill={DARK} />
          <circle cx="124" cy="120" r="11" fill={DARK} />
          <circle cx="87.5" cy="115.5" r="3" fill="#fff" />
          <circle cx="127.5" cy="115.5" r="3" fill="#fff" />
        </>
      );
    case "dot":
    default:
      return (
        <>
          <circle cx="84" cy="120" r="10" fill={DARK} />
          <circle cx="124" cy="120" r="10" fill={DARK} />
          <circle cx="87" cy="116" r="2.4" fill="#fff" />
          <circle cx="127" cy="116" r="2.4" fill="#fff" />
        </>
      );
  }
}

function Mouth({ kind }: { kind: MouthKind }) {
  switch (kind) {
    case "grin":
      return <path d="M84 143 Q104 160 124 143" stroke={DARK} strokeWidth={5} fill="none" strokeLinecap="round" />;
    case "open":
      return <ellipse cx="104" cy="148" rx="9" ry="7" fill="#3a2a24" />;
    case "flat":
      return <path d="M92 146 L116 146" stroke={DARK} strokeWidth={4} strokeLinecap="round" />;
    case "smirk":
      return <path d="M92 146 Q104 150 114 142" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />;
    case "gentle":
      return <path d="M94 146 Q104 151 114 146" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
    case "tongue":
      return (
        <>
          <ellipse cx="104" cy="147" rx="9" ry="7" fill="#3a2a24" />
          <ellipse cx="104" cy="152" rx="4" ry="3" fill="#ff6f61" />
        </>
      );
    case "smile":
    default:
      return <path d="M90 145 Q104 154 118 145" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />;
  }
}

export interface InvestorAvatarProps {
  spec: InvestorAvatarSpec;
  size?: number;
}

/** 인증카드 "투자 유형 테스트" 캐릭터 — 얼굴(테마 13색)·표정(집중도·투자성향)·바깥 원(30색
 *  팔레트, 테마와 무관) + 코너 배지 2개(지역·계좌). */
export function InvestorAvatar({ spec, size = 208 }: InvestorAvatarProps) {
  const visual = THEME_VISUAL[spec.themeKey] ?? THEME_VISUAL["기타"];
  const AccessoryIcon = visual.icon;
  const AccountIcon = ACCOUNT_ICON[spec.accountKey] ?? Home;
  const accessorySize = Math.round(size * 0.27);
  const badgeSize = Math.round(size * 0.163);

  // 아바타 전용 seed — 카테고리형 값만 조합해 같은 포트폴리오는 항상 같은 아바타가 나온다.
  const avatarSeed = `${spec.themeKey}|${spec.regionKey}|${spec.accountKey}|${spec.concentration}|${spec.stockTypeKey}`;
  const eyeKind = pick(EYE_POOL_BY_CONCENTRATION[spec.concentration], `eye:${avatarSeed}`);
  const mouthKind = pick(MOUTH_POOL_BY_STOCK_TYPE[spec.stockTypeKey], `mouth:${avatarSeed}`);
  const outerBg = pick(OUTER_BG_PALETTE, `bg:${avatarSeed}`);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${outerBg.light} 0%, ${outerBg.mid} 55%, ${outerBg.deep} 100%)`,
          boxShadow: "inset 0 -10px 24px rgba(0,0,0,.18), inset 0 8px 18px rgba(255,255,255,.16)",
        }}
      />
      <svg viewBox="0 0 208 208" width={size} height={size} className="relative">
        <ellipse cx="104" cy="128" rx="56" ry="50" fill={visual.light} stroke={visual.mid} strokeWidth={2} />
        <Eyes kind={eyeKind} mid={visual.mid} />
        <Mouth kind={mouthKind} />
        <circle cx="72" cy="134" r="6" fill={visual.mid} opacity={0.35} />
        <circle cx="136" cy="134" r="6" fill={visual.mid} opacity={0.35} />
      </svg>

      <div
        className="absolute rounded-2xl flex items-center justify-center shadow-md"
        style={{
          width: accessorySize,
          height: accessorySize,
          top: -size * 0.03,
          left: "50%",
          transform: "translateX(-50%) rotate(-8deg)",
          background: visual.mid,
        }}
      >
        <AccessoryIcon className="text-white" />
      </div>

      <div
        className="absolute rounded-full bg-white dark:bg-black flex items-center justify-center text-[10px] font-bold px-2 shadow-sm"
        style={{ height: badgeSize, top: size * 0.02, right: size * 0.02 }}
      >
        {spec.regionKey === "KR" ? "국내" : "해외"}
      </div>

      <div
        className="absolute rounded-full bg-white dark:bg-black flex items-center justify-center shadow-sm"
        style={{ width: badgeSize, height: badgeSize, bottom: size * 0.03, left: 0 }}
      >
        <AccountIcon style={{ color: visual.mid }} />
      </div>
    </div>
  );
}
