"use client";

import React from "react";
import {
  Cpu, Code, Zap, Bot, Car, Landmark, FlaskConical, ShoppingBag, Truck, Rocket,
  Link2, Shield, Sparkles, Home, Globe, PiggyBank, ShieldCheck, Gem,
  type LucideIcon,
} from "lucide-react";
import type { Sector } from "@/lib/xray/classification-store";
import type { InvestorAvatarSpec, RegionKey, AccountKey } from "@/lib/xray/investor-type";

// 인증카드 "투자 유형 테스트" 캐릭터 — 외부 이미지 없이 SVG로 직접 그린다.
// 색상(테마별 13색, 초록 포함 무지개 스펙트럼)·표정(눈/입 조합)·소품 아이콘이 전부
// 테마(SECTOR_ENUM) 축으로 갈리고, 코너 배지 2개가 지역·계좌 축을 더해 조합을 늘린다.

type EyeKind = "dot" | "dotBig" | "sparkle" | "surprised" | "halfmoon" | "wink" | "slant" | "sleepy";
type MouthKind = "smile" | "grin" | "open" | "flat" | "smirk" | "gentle" | "tongue";

interface ThemeVisual {
  light: string;
  mid: string;
  deep: string;
  eye: EyeKind;
  mouth: MouthKind;
  icon: LucideIcon;
}

const THEME_VISUAL: Record<Sector, ThemeVisual> = {
  "AI 및 반도체": { light: "#cfe6ff", mid: "#4f8de0", deep: "#1f4f9e", eye: "sparkle", mouth: "grin", icon: Cpu },
  "AI 및 소프트웨어": { light: "#e6d9fb", mid: "#9a5fe0", deep: "#5c2fa0", eye: "dot", mouth: "smile", icon: Code },
  "AI 인프라 및 전력": { light: "#ffe6a8", mid: "#f2a83c", deep: "#b8730f", eye: "surprised", mouth: "open", icon: Zap },
  "로봇 및 산업 자동화": { light: "#dde2f0", mid: "#7d8ab0", deep: "#454f70", eye: "slant", mouth: "flat", icon: Bot },
  "자율주행 및 모빌리티": { light: "#ffd6b8", mid: "#ff7a3c", deep: "#c8480f", eye: "wink", mouth: "smirk", icon: Car },
  "금융 및 핀테크": { light: "#c8f2ee", mid: "#3fbdb5", deep: "#1f7a74", eye: "sleepy", mouth: "gentle", icon: Landmark },
  "바이오 및 헬스케어": { light: "#ffd6dc", mid: "#ff5c78", deep: "#c22a48", eye: "halfmoon", mouth: "smile", icon: FlaskConical },
  "소비재 및 유통": { light: "#ffd0f0", mid: "#e85fc4", deep: "#a82f8e", eye: "dotBig", mouth: "smirk", icon: ShoppingBag },
  "인프라 및 물류": { light: "#cdeed4", mid: "#4cae66", deep: "#256b39", eye: "sleepy", mouth: "flat", icon: Truck },
  "방산 및 우주항공": { light: "#ffd0d0", mid: "#f04444", deep: "#a81f1f", eye: "slant", mouth: "grin", icon: Rocket },
  "블록체인 및 디지털자산": { light: "#dcd6fb", mid: "#6f5fea", deep: "#3d2fa0", eye: "sparkle", mouth: "smirk", icon: Link2 },
  "ETF/펀드": { light: "#cdeef7", mid: "#38b6dd", deep: "#1a6f92", eye: "halfmoon", mouth: "gentle", icon: Shield },
  기타: { light: "#fff0b8", mid: "#f2cf3c", deep: "#b8930f", eye: "surprised", mouth: "tongue", icon: Sparkles },
};

const REGION_LABEL_KO: Record<RegionKey, string> = {
  KR: "국내", US: "미국", JP: "일본", CN: "중국", HK: "홍콩", Other: "해외",
};

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

/** 인증카드 "투자 유형 테스트" 캐릭터 — 얼굴/배경(테마 13색) + 코너 배지 2개(지역·계좌). */
export function InvestorAvatar({ spec, size = 208 }: InvestorAvatarProps) {
  const visual = THEME_VISUAL[spec.themeKey] ?? THEME_VISUAL["기타"];
  const AccessoryIcon = visual.icon;
  const AccountIcon = ACCOUNT_ICON[spec.accountKey] ?? Home;
  const accessorySize = Math.round(size * 0.27);
  const badgeSize = Math.round(size * 0.163);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${visual.light} 0%, ${visual.mid} 55%, ${visual.deep} 100%)`,
          boxShadow: "inset 0 -10px 24px rgba(0,0,0,.18), inset 0 8px 18px rgba(255,255,255,.16)",
        }}
      />
      <svg viewBox="0 0 208 208" width={size} height={size} className="relative">
        <ellipse cx="104" cy="128" rx="56" ry="50" fill={visual.light} stroke={visual.mid} strokeWidth={2} />
        <Eyes kind={visual.eye} mid={visual.mid} />
        <Mouth kind={visual.mouth} />
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
        {REGION_LABEL_KO[spec.regionKey]}
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
