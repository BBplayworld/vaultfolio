"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { SHOT_BIG_SCALE } from "@/config/theme";
import { BrandMark } from "./brand-mark";
import { usePcPreview } from "./use-pc-preview";

// 인증카드 "포트폴리오" 타입 — 금액 없이 종목 구성 비중만 원형 링으로 표현.
// 데이터는 ShareCard에서 계산해 props(segments)로 주입한다(훅 중복 호출 금지).

export interface RingSegment {
  key: string;
  name: string;
  ticker: string;
  isForeign: boolean;
  truePct: number; // 실제 비중(%) — 라벨에 항상 이 값 표기
  color: string; // 조각 fill — 링 밖 % 텍스트에도 같은 색을 쓴다
  etfBrand?: string | null; // 국내 ETF면 브랜드명 — 로고 대신 텍스트 배지
  subLogos?: SubLogo[]; // "그 외" 조각에 담을 상위 종목들(최대 3) — 있으면 미니 칩 여러 개
}

/** "그 외" 조각 안에 작게 표시할 구성 종목 */
export interface SubLogo {
  key: string;
  ticker: string;
  name: string;
  isForeign: boolean;
  etfBrand?: string | null;
}

// ── 튜닝 상수 ────────────────────────────────────────────────────────────────
// 조각별 최소 각도(°). 모든 종목이 최소한 이 각도는 확보해 링이 한 조각에 먹히지 않게 한다.
const MIN_ARC_DEG = 22;
// 프리뷰 좌우 최소 공백(px) — 9/3시 방향 라벨이 화면 끝에 붙어 짤리지 않게 스케일 링을 이만큼 좁힌다.
const PREVIEW_SIDE_INSET = 8;
// 프리뷰 전용 좌우 라벨 여유(px, 링 좌표 기준·각 쪽) — 모바일은 링을 축소하고 폰트를 키우므로 9/3시 방향
// 라벨이 쓸 수 있는 폭이 좁아 종목명이 잘린다. 캔버스를 이만큼 넓혀(=링이 더 작아짐) 좌우 폭을 확보한다.
const PREVIEW_SIDE_EXTRA = 64;
// 좌/우 라벨 박스 "모서리"가 링에서 최소 14px 떨어지도록 밀어내는 기준(PUSH_R = R_OUTER + 14)의 이동 상한(px).
const PUSH_MAX = 24;
// 링 상단 근처(중심에서 세로 150px 초과) 좌/우 라벨을 위로 올리는 기준·이동량(px) — 조각과 위치를 맞춘다.
const UPPER_LABEL_DY = 150;
const UPPER_SHIFT_UP = 20;
// 실제 비중 구간별 최대 호(arc, °) 상한 — 내림차순 매칭, 구간(<50%)은 상한 없음.
const MAX_ARC_BY_PCT: readonly (readonly [number, number])[] = [
  [90, 110],
  [80, 100],
  [70, 92],
  [60, 84],
  [50, 76],
];

// ── 링 기하 상수(캡처 DOM이므로 뷰포트 반응형 금지 · 고정 px) ──────────────────
// 링 크기(R_OUTER)와 캔버스 높이(VIEW_H)는 독립 — 링을 작게, 캔버스를 크게 잡으면
// 링 밖 종목명 라벨의 여백·간격이 넉넉해진다.
const VIEW_W = 656; // 카드 안쪽 폭 (CARD_WIDTH 680 − p-3 좌우 24)
const VIEW_H = 664; // 캔버스(=카드) 높이 — 링 + 상하 라벨 여백
const CX = 328;
const CY = 322;
const R_OUTER = 240; // 도넛 바깥 반경 — 중앙 홀(R_INNER) 축소분 + 확대
const R_INNER = 66; // 중앙 홀(비움) — 밴드 174px로 두껍게, 중앙 검정 영역 축소
const PUSH_R = R_OUTER + 14; // 좌/우 라벨 박스 모서리 기준 반경(pushOutside)
const LABEL_R = 264; // 라벨 앵커 반경(링 바깥) — R_OUTER와의 간격 24px(도넛↔종목명 살짝 더 벌림).
                     // 264 이상이면 3/9시 라벨 박스가 VIEW_W를 넘어 짤리므로 상한(labelMaxW 하한 64 기준)
// 로고 반경은 밴드 중앙(=153)이 아니라 **바깥쪽 0.6 지점**(≈170). 중앙 홀을 줄이면서
// 밴드 중앙에 두면 반경이 안쪽으로 당겨져 같은 각도의 현(chord)이 짧아지고,
// 최소 조각(22°)의 칩이 CHIP_HIDE_BELOW 아래로 떨어져 로고가 통째로 생략된다.
const LOGO_R = R_INNER + (R_OUTER - R_INNER) * 0.6;
// 조각 안 로고 칩(이미지 로고 + ETF 텍스트 배지)은 조각 각도(비중)와 무관하게 항상 이 크기로
// 고정된다(2026-09, 사용자 요청 — 도넛 밴드 물리 크기가 고정 상수라 "조각이 커도 로고가 더 커질
// 공간"의 실익이 없다고 판단, 조각 크기는 차등이되 그 안 로고·라벨은 통일감 있게 동일 크기).
// 목표값 50은 실사용 최소 비중대(0.7~1%대, 실제 계산되는 각도는 MIN_ARC_DEG=22°보다 살짝 큰
// 23~24° 수준)에서 chord 안전 상한이 48~50px대라 거의 그대로 나오고, 그보다 더 극단적으로 좁은
// (거의 0%) 조각만 `chipSizeFor()`의 chord 안전장치로 방어적으로 축소되며, 그 결과가
// `CHIP_HIDE_BELOW`보다 작아지면 로고 자체를 생략한다(2026-09 — 44→50로 확대 요청 반영, 목표
// 크기와 "너무 작으면 생략" 기준을 분리해 확대해도 극단값에서 로고가 갑자기 사라지지 않게 함).
const CHIP_MIN = 50; // 메인 조각 로고 칩 고정 지름(px, 목표값)
const CHIP_HIDE_BELOW = 32; // 안전장치로 이보다 작아지면 로고 생략(극단적으로 좁은 조각만 해당)
// 메인 조각 ETF 브랜드 라벨(BrandMark) 고정 폰트 크기(px) — 조각 각도(칩 지름)와 무관하게 모든
// 메인 조각 브랜드 라벨을 이 크기로 통일해 조각마다 글자 크기가 들쭉날쭉해 보이지 않게 한다
// (2026-09 — 이전엔 size 비례 계산이라 큰 조각일수록 라벨이 과도하게 커졌다).
const ETF_LABEL_FONT_SIZE = 14;
// "그 외" 조각 안 미니 로고 칩 지름(px)·간격(px) — 세로(반지름) 배치 도입으로 확대(2026-09,
// 사용자 요청). 근거: ETC_MIN_ARC=40° 최소각 기준, 반지름 배치 중 가장 안쪽 위치(LOGO_R-45≈125.4)
// 에서 40° 현(chord)≈85.8px → 안전 상한(×0.7)≈60px로 38px에 여유 있음. 가장 바깥 위치
// (LOGO_R+45≈215.4)의 칩 외곽(+19)도 R_OUTER(240)보다 5.6px 안쪽, 가장 안쪽 위치의 칩 내곽(-19)도
// R_INNER(66)보다 40.4px 바깥이라 밴드를 벗어나지 않는다.
const SUB_CHIP = 38;
const SUB_CHIP_GAP = 7; // 미니 칩 사이 간격(px)
const ETC_MIN_ARC = 40; // "그 외" 조각 최소 각도(°) — 미니 칩 3개 + 간격이 들어가도록
const MIN_LABEL_GAP = 66; // 같은 쪽(좌/우) 인접 라벨의 세로 최소 간격(px)
const GAP_DEG = 0; // 각도 간극 없음 — 분리는 카드 배경색 stroke(--ring-divider)가 담당

const RADIAN = Math.PI / 180;

// ── name-split start ──
// 공백 없는 긴 한글 종목명("테슬라밸류체인액티브")을 단어 단위로 나누기 위한 어휘 사전(2자 이상, ETF 마스터
// 빈출 어휘 + 지수·테마·대표 기업). 사전으로 **전부** 덮일 때만 분할(all-or-nothing) — 하나라도 모르는 조각이
// 남으면 원형 유지라 오분할이 없다. 어휘 추가는 자유(최장 일치, 조각 수 최소 우선).
const NAME_LEXICON: ReadonlySet<string> = new Set([
  // 국가·지수·시장
  "미국", "미국채", "글로벌", "코리아", "차이나", "중국", "일본", "인도", "베트남", "유럽", "신흥국", "선진국", "대만", "한국", "다우존스", "나스닥", "필라델피아", "코스피", "코스닥", "지수", "종합",
  // 테마·섹터
  "반도체", "전기차", "배터리", "이차전지", "전지", "밸류체인", "데이터센터", "헬스케어", "바이오", "로봇", "인공지능", "소프트웨어", "게임", "농업", "경제", "에너지", "인프라", "리츠", "리얼티", "리얼티인컴", "부동산", "원자재", "소부장", "테크", "전략기술", "산업", "기업", "그룹", "포커스", "성장", "가치", "주주가치", "우량", "대형주", "중소형", "모멘텀", "퀀트", "저변동", "핵심", "카카오",
  // 상품 유형·전략
  "액티브", "인버스", "레버리지", "커버드콜", "타겟", "위클리", "데일리", "단기", "만기", "자동연장", "선물", "채권", "채권혼합", "혼합", "국채", "국고채", "회사채", "특수채", "통안채", "머니마켓", "고배당", "배당", "단일종목", "코어", "플러스",
  // 보강(미분할 빈출 조각 — 검증 스크립트로 추출)
  "달러", "밸류업", "알파", "은행채", "국공채", "금융채", "비만", "수소", "원자력", "클린", "테크놀로지", "자산배분", "주식", "분산", "사회책임투자", "중기",
  "바이오시밀러", "양극재", "차전지", "셀렉트", "다이나믹", "미래", "내수주", "네트워크", "월만기", "년국채", "년선물", "년물", "단일종", "고배당주", "다우", "존스", "종목", "전략", "금리", "합성", "원유", "천연가스", "골드", "실버", "리츠", "미디어", "콘텐츠", "금융", "은행", "증권", "보험", "자동차", "조선", "방산", "우주항공", "화장품", "소비재", "필수소비", "경기소비", 
  // 대표 기업
  "테슬라", "삼성", "하이닉스", "엔비디아", "애플", "마이크로소프트", "구글", "아마존", "현대차", "네이버",
]);
const NAME_SPLIT_MIN_LEN = 6; // 이보다 짧은 한글 토큰("미국나스닥")은 그대로 둔다

/** 한글 토큰을 사전으로 전부 덮어 분할(조각 수 최소). 덮을 수 없으면 null. */
function segmentByLexicon(tok: string): string[] | null {
  const n = tok.length;
  const best: (string[] | null | undefined)[] = new Array(n + 1);
  const solve = (i: number): string[] | null => {
    if (i === n) return [];
    if (best[i] !== undefined) return best[i] ?? null;
    let res: string[] | null = null;
    for (let j = i + 2; j <= n; j++) {
      const w = tok.slice(i, j);
      if (!NAME_LEXICON.has(w)) continue;
      const rest = solve(j);
      if (rest && (!res || rest.length + 1 < res.length)) res = [w, ...rest];
    }
    best[i] = res;
    return res;
  };
  return solve(0);
}

/**
 * 종목명 → 단어별 토큰(줄바꿈 후보). 공백으로 나누고, 각 단어를 한글 ↔ 영문·숫자 경계에서 추가 분리한 뒤,
 * 긴 한글 토큰은 어휘 사전으로 단어 단위 분할한다.
 * `word-break: keep-all`은 한글↔영문·숫자 경계를 분리 기회로 취급하지 않아 "미국나스닥100"이 폭을 넘으면
 * 글자 중간("…1/00")에서 잘리므로, 경계에 직접 줄바꿈 기회를 둔다.
 * 예) "ACE 미국나스닥100" → [["ACE"], ["미국나스닥", "100"]]
 */
export function splitNameWords(name: string): string[][] {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w
        .replace(/([가-힣])(?=[A-Za-z0-9])/g, "$1\0")
        .replace(/([A-Za-z0-9)])(?=[가-힣])/g, "$1\0")
        .replace(/([가-힣])(?=\()/g, "$1\0") // "…혼합(합성)" — 괄호 앞도 분리 기회
        .split("\0")
        .flatMap((t) => (/^[가-힣]+$/.test(t) && t.length >= NAME_SPLIT_MIN_LEN ? (segmentByLexicon(t) ?? [t]) : [t])),
    );
}
// ── name-split end ──

const tokenEm = (t: string) => [...t].reduce((s, ch) => s + (/[가-힣]/.test(ch) ? 1 : 0.62), 0);

/** 토큰 그리디 줄바꿈 시뮬레이션 → 줄 수(≤3, line-clamp-3와 동일). 폭보다 긴 토큰은 마지막 수단으로 글자 분리. */
function wrappedLineCount(name: string, fontPx: number, maxW: number): number {
  let lines = 1;
  let cur = 0;
  splitNameWords(name).forEach((word, wi) => {
    word.forEach((tok, ti) => {
      const w = tokenEm(tok) * fontPx;
      const gap = ti === 0 && wi > 0 ? 0.3 * fontPx : 0; // 단어 사이 공백만 폭을 가진다
      if (w > maxW) {
        if (cur > 0) lines++;
        const rows = Math.ceil(w / maxW);
        lines += rows - 1;
        cur = w - (rows - 1) * maxW;
      } else if (cur > 0 && cur + gap + w > maxW) {
        lines++;
        cur = w;
      } else {
        cur += (cur > 0 ? gap : 0) + w;
      }
    });
  });
  return Math.min(3, lines);
}

/**
 * 조각 각도(=비중) → 로고 칩 지름. 고정 타깃(`CHIP_MIN`)을 그대로 쓰되, 조각 안에 물리적으로
 * 들어가도록 로고 반경에서의 현(chord) 길이로 상한만 건다(정상 범위에선 항상 CHIP_MIN 그대로).
 */
function chipSizeFor(arcDeg: number): number {
  const chord = 2 * LOGO_R * Math.sin((arcDeg / 2) * RADIAN);
  return Math.round(Math.min(CHIP_MIN, chord * 0.7));
}

function maxArcForPct(pct: number): number {
  for (const [threshold, maxArc] of MAX_ARC_BY_PCT) {
    if (pct >= threshold) return maxArc;
  }
  return Infinity;
}

/**
 * 실제 비중 배열 → 링에 그릴 각도(°) 배열. 합계 360.
 * 1) 최소각 + 나머지를 비중 비례로 배분
 * 2) 구간별 최대 호 상한 초과분은 미고정 조각에 비중 비례 재분배(수렴까지 반복)
 * 3) 부동소수 오차를 합 360으로 정규화
 * 4) `minArcs`가 주어지면 세그먼트별 최소각을 후처리로 보장("그 외"에 미니 로고 3개를 넣기 위함)
 */
export function computeRingArcs(pcts: number[], minArcs?: number[]): number[] {
  const n = pcts.length;
  if (n === 0) return [];
  if (n === 1) return [360];

  const TOTAL = 360;
  const distributable = Math.max(0, TOTAL - MIN_ARC_DEG * n);
  const sum = pcts.reduce((s, p) => s + p, 0) || 1;

  let arcs = pcts.map((p) => MIN_ARC_DEG + distributable * (p / sum));
  const caps = pcts.map(maxArcForPct);
  const fixed = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter < 20; iter++) {
    let surplus = 0;
    for (let i = 0; i < n; i++) {
      if (!fixed[i] && arcs[i] > caps[i]) {
        surplus += arcs[i] - caps[i];
        arcs[i] = caps[i];
        fixed[i] = true;
      }
    }
    if (surplus <= 1e-6) break;

    const freeWeight = pcts.reduce((s, p, i) => s + (fixed[i] ? 0 : p), 0);
    if (freeWeight <= 0) {
      const add = surplus / n;
      arcs = arcs.map((a) => a + add);
      break;
    }
    for (let i = 0; i < n; i++) {
      if (!fixed[i]) arcs[i] += surplus * (pcts[i] / freeWeight);
    }
  }

  // 실제 비중 내림차순에서 각도가 단조 비증가하도록 clamp — 상한 재분배로 인해
  // 더 큰 비중 조각이 더 작게 보이는 역전(rank inversion)을 막는다.
  const order = pcts.map((_, i) => i).sort((a, b) => pcts[b] - pcts[a]);
  for (let k = 1; k < n; k++) {
    if (arcs[order[k]] > arcs[order[k - 1]]) arcs[order[k]] = arcs[order[k - 1]];
  }

  const total = arcs.reduce((s, a) => s + a, 0) || 1;
  return enforceMinArcs(arcs.map((a) => (a / total) * TOTAL), minArcs);
}

/**
 * 세그먼트별 지정 최소각 보장 — 부족분을 다른 조각에서 비례 회수한다.
 * 회수는 각 조각의 `MIN_ARC_DEG` 바닥을 침범하지 않는 범위에서만 이뤄지므로
 * 기존 각도 압축·단조 clamp 결과를 크게 흔들지 않는다(합 360 유지).
 */
function enforceMinArcs(arcs: number[], minArcs?: number[]): number[] {
  if (!minArcs) return arcs;
  const out = [...arcs];
  const raised = new Array<boolean>(out.length).fill(false);
  let deficit = 0;
  for (let i = 0; i < out.length; i++) {
    const need = minArcs[i] ?? 0;
    if (need > out[i]) {
      deficit += need - out[i];
      out[i] = need;
      raised[i] = true;
    }
  }
  if (deficit <= 1e-6) return out;

  const donors = out.map((a, i) => (raised[i] ? 0 : Math.max(0, a - MIN_ARC_DEG)));
  const pool = donors.reduce((sum, d) => sum + d, 0);
  if (pool <= 0) return out; // 회수 여력 없음 — 최소각을 우선한다
  const take = Math.min(deficit, pool);
  for (let i = 0; i < out.length; i++) out[i] -= donors[i] * (take / pool);
  return out;
}

// 극좌표(0°=12시 방향, 시계방향)
function polar(r: number, angleDeg: number): [number, number] {
  return [CX + r * Math.sin(angleDeg * RADIAN), CY - r * Math.cos(angleDeg * RADIAN)];
}

// 도넛 웨지 path
function wedgePath(a0: number, a1: number): string {
  const [x0o, y0o] = polar(R_OUTER, a0);
  const [x1o, y1o] = polar(R_OUTER, a1);
  const [x1i, y1i] = polar(R_INNER, a1);
  const [x0i, y0i] = polar(R_INNER, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}

type Zone = "top" | "bottom" | "right" | "left";
function zoneOf(mid: number): Zone {
  if (mid <= 20 || mid >= 340) return "top";
  if (mid >= 160 && mid <= 200) return "bottom";
  return mid < 180 ? "right" : "left";
}

type Placed = { seg: RingSegment; a0: number; a1: number; mid: number; lx: number; ly: number; zone: Zone };

/**
 * 같은 쪽(좌/우)에 몰린 라벨의 세로 위치(ly)를 최소 간격(MIN_LABEL_GAP)만큼 벌린다.
 * 링 기하상 작은 조각들이 최소각(MIN_ARC_DEG)으로 붙으면 라벨이 겹치므로,
 * 겹침을 아래로 밀어 해소한 뒤 그룹 전체를 원래 중심으로 되돌려 쏠림을 막는다.
 * lx(가로 위치)는 건드리지 않는다 — 조각과의 근접성으로 식별.
 */
function spreadVertically(items: Placed[], gap: number = MIN_LABEL_GAP): Placed[] {
  if (items.length < 2) return items;
  const sorted = [...items].sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < sorted.length; i++) {
    const min = sorted[i - 1].ly + gap;
    if (sorted[i].ly < min) sorted[i] = { ...sorted[i], ly: min };
  }
  const origCenter = items.reduce((s, it) => s + it.ly, 0) / items.length;
  const newCenter = sorted.reduce((s, it) => s + it.ly, 0) / sorted.length;
  const shift = origCenter - newCenter;
  const min = gap / 2;
  const max = VIEW_H - gap / 2;
  return sorted.map((it) => ({ ...it, ly: Math.min(max, Math.max(min, it.ly + shift)) }));
}

export function PortfolioRingCard({ segments, responsive }: { segments: RingSegment[]; responsive?: boolean }) {
  // responsive=true(화면용 프리뷰)면 링을 컨테이너 폭에 맞춰 fit-to-width 스케일(가로 스크롤 없이 도넛이 폭을 꽉 채움).
  // responsive 미전달(캡처 인스턴스)이면 VIEW_W 고정 — 저장 PNG 구도 불변.
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const sideExtra = responsive ? PREVIEW_SIDE_EXTRA : 0;
  const canvasW = VIEW_W + sideExtra * 2;
  useEffect(() => {
    if (!responsive) return;
    const el = outerRef.current;
    if (!el) return;
    const update = () =>
      setScale(Math.min(1, Math.max(0, Math.floor(el.clientWidth) - PREVIEW_SIDE_INSET * 2) / (VIEW_W + PREVIEW_SIDE_EXTRA * 2)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive]);

  // PC 프리뷰(뷰포트 ≥640px)는 도넛 라벨(종목명·%)도 나머지 본문 텍스트(ASSET_THEME_SHOT.bodyText)와
  // 같이 text-sm(14px)로, 모바일은 기존 text-xs(12px) 유지.
  const isPcPreview = usePcPreview(responsive ?? false);

  if (segments.length === 0) return null;

  // "그 외"(subLogos 보유)는 미니 칩 3개가 들어가도록 더 큰 최소각을 요구한다
  const arcs = computeRingArcs(
    segments.map((s) => s.truePct),
    segments.map((s) => (s.subLogos?.length ? ETC_MIN_ARC : MIN_ARC_DEG)),
  );

  // responsive 프리뷰: 링 전체가 transform:scale(<1)로 축소돼 text-[Npx] 라벨이 더 작게 렌더 → 폰트를
  //   floor/scale로 키워 상쇄(실효 항상 floor px). floor는 모바일 12(text-xs)·PC 14(text-sm) —
  //   나머지 프리뷰 본문(ASSET_THEME_SHOT.bodyText="text-xs sm:text-sm")과 같은 기준(2026-09).
  //   scale≤1이 보장되므로 floor/scale은 항상 ≥floor — Math.max(floor, …)는 부동소수 안전장치일 뿐.
  // 캡처(저장 PNG, !responsive): SHOT_BIG_SCALE에서 파생(계수 12 → 1.46에서 18, 1.42에서 17). 도넛 라벨은
  //   좁은 존 짤림 때문에 본문(계수 14)보다 조금 작게. 나머지 짤림 방지는 아래 labelMaxW·line-clamp-3.
  const previewFloor = isPcPreview ? 14 : 12;
  const rLabelFont = responsive ? Math.max(previewFloor, previewFloor / scale) : Math.round(12 * SHOT_BIG_SCALE);
  const rGap = responsive
    ? Math.max(MIN_LABEL_GAP, Math.round(rLabelFont * 4.5))
    : Math.max(MIN_LABEL_GAP, Math.round(rLabelFont * 5));
  const labelClampCls = "line-clamp-3";

  let acc = 0;
  const drawn: Placed[] = segments.map((seg, i) => {
    const a0 = acc;
    const a1 = acc + arcs[i];
    acc = a1;
    const mid = (a0 + a1) / 2;
    const [lx, ly] = polar(LABEL_R, mid);
    return { seg, a0, a1, mid, lx, ly, zone: zoneOf(mid) };
  });

  // 라벨 최대폭(존별) — 라벨 렌더와 아래 캔버스 높이 추정이 같은 값을 쓰도록 함수로 공유
  const labelMaxWOf = (zone: Zone, lx: number) =>
    zone === "right" ? Math.max(64, VIEW_W + sideExtra - lx - 4)
      : zone === "left" ? Math.max(64, lx + sideExtra - 4)
        : 208;
  // 단어(토큰) 단위 줄바꿈 시뮬레이션으로 줄 수(≤3)를 구해 라벨(이름+%) 높이를 추정 — 렌더의 줄바꿈과 동일 규칙
  const estLabelHeight = (name: string, maxW: number) =>
    (wrappedLineCount(name, rLabelFont, maxW) + 1) * rLabelFont * 1.15;

  // spreadVertically가 ly만 옮기면 앵커가 LABEL_R 원주 안쪽으로 들어오고, 박스(세로 중앙 정렬)의 링 쪽
  // 모서리는 앵커보다 링에 더 가깝다 → 박스에서 CY에 가장 가까운 세로 변이 LABEL_R 원 밖에 오도록 lx를 바깥으로 민다.
  const pushOutside = (items: Placed[]): Placed[] =>
    items.map((it) => {
      const h = estLabelHeight(it.seg.name, labelMaxWOf(it.zone, it.lx));
      // 링 상단 근처(|ly − CY| > UPPER_LABEL_DY) 좌/우 라벨은 조금 위로 올려 하단 변을 링에서 멀리 → 왼/오른쪽 밀림 감소.
      // 박스 상단이 캔버스 위로 나가지 않도록 상한(ly − h/2 ≥ 0).
      const isUpper = it.ly < CY && CY - it.ly > UPPER_LABEL_DY;
      const ly = isUpper ? it.ly - Math.min(UPPER_SHIFT_UP, Math.max(0, it.ly - h / 2)) : it.ly;
      const pushR = isUpper ? R_OUTER + 10 : PUSH_R;
      const nearEdge = ly < CY ? Math.min(CY, ly + h / 2) : Math.max(CY, ly - h / 2);
      const edgeX = Math.sqrt(Math.max(0, pushR * pushR - (nearEdge - CY) ** 2));
      // 이동량은 원래 위치 대비 PUSH_MAX 이내로 제한 — 줄 수(h)가 늘어도 라벨이 조각에서 멀리 튀거나
      // 이동으로 가용폭이 줄어 줄 수가 더 늘어나는 악순환을 막는다.
      const lx = it.zone === "left"
        ? Math.max(68 - sideExtra, it.lx - PUSH_MAX, Math.min(it.lx, CX - edgeX))
        : Math.min(VIEW_W + sideExtra - 68, it.lx + PUSH_MAX, Math.max(it.lx, CX + edgeX));
      return { ...it, lx, ly };
    });

  // 좌/우로 몰린 라벨은 세로 간격을 벌려 겹침 해소(top/bottom은 그대로)
  const labels: Placed[] = [
    ...pushOutside(spreadVertically(drawn.filter((d) => d.zone === "left"), rGap)),
    ...pushOutside(spreadVertically(drawn.filter((d) => d.zone === "right"), rGap)),
    ...drawn.filter((d) => d.zone === "top" || d.zone === "bottom"),
  ];
  // 캔버스 높이 — 라벨이 실제로 차지하는 최하단(링 하단 포함)까지만. 6시 방향 라벨이 없으면 링 아래
  // 빈 공간(VIEW_H가 항상 하단 라벨 자리를 잡던 ≈100px)이 회수된다. 데이터로만 결정돼 기기 무관(R32).
  const labelsBottom = Math.max(
    ...labels.map(({ seg, lx, ly, zone }) => {
      const h = estLabelHeight(seg.name, labelMaxWOf(zone, lx));
      return zone === "bottom" ? ly + h : zone === "top" ? ly : ly + h / 2;
    }),
  );
  // 하단 여백 40px: 16px로 줄였더니 "분야 구성"과 너무 붙어 보여(2026-09) 조금 되돌림(원래 ≈100px은 과했음)
  // 프리뷰는 폰트가 floor/scale로 커져 하단 라벨(이름 2줄+%)이 VIEW_H 상한을 넘으므로 상한을 두지 않는다
  // (캡처는 기존 상한 유지 — 저장 PNG 구도 불변).
  const ringNeed = Math.ceil(Math.max(CY + R_OUTER, labelsBottom) + 40);
  const ringH = responsive ? ringNeed : Math.min(VIEW_H, ringNeed);
  // 프리뷰 전용 상단 여유 — 12시 방향 라벨은 앵커(ly) 위로 자라는데, 프리뷰는 폰트가 floor/scale로
  // 커져 줄 수가 늘어 앵커 위 여백을 넘으면 바깥 overflow-hidden 에 상단이 짤린다. 초과분만큼 링을 아래로 민다.
  // 캡처(!responsive)는 0 고정 — 저장 PNG 구도 불변.
  const topInset = responsive
    ? Math.max(
        0,
        ...labels.filter((l) => l.zone === "top").map((l) => Math.ceil(estLabelHeight(l.seg.name, labelMaxWOf(l.zone, l.lx)) - l.ly) + 4),
      )
    : 0;
  const viewH = ringH + topInset;

  // 링 본체(svg + HTML 라벨/로고 오버레이). responsive면 transform:scale로 폭 맞춤.
  const ring = (
    <div
      className="relative"
      style={{
        width: canvasW,
        height: viewH,
        ...(responsive ? { transform: `scale(${scale})`, transformOrigin: "top left" } : {}),
      }}
    >
      <div className="absolute" style={{ top: topInset, left: sideExtra, width: VIEW_W, height: ringH }}>
        <svg
          width={VIEW_W}
          height={ringH}
          viewBox={`0 0 ${VIEW_W} ${ringH}`}
          className="absolute inset-0 [&_*]:outline-none [&_path]:outline-none"
        >
          {drawn.map(({ seg, a0, a1 }) => {
            const pad = a1 - a0 > GAP_DEG * 2 ? GAP_DEG : 0;
            return (
              <path
                key={seg.key}
                d={wedgePath(a0 + pad, Math.max(a1 - pad, a0 + pad + 0.0001))}
                fill={seg.color}
                stroke="var(--ring-divider)"
                strokeWidth={5}
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {/* 조각 안 기업 로고 — 조각색 원형 칩, 비중(각도)에 비례한 크기.
            좁은 조각·로고 없는 조각("그 외")은 생략 */}
        {drawn.map(({ seg, a0, a1, mid }) => {
          // "그 외" — 구성 상위 종목 미니 칩을 조각 각도 범위에 균등 배치
          if (seg.subLogos?.length) {
            const subs = seg.subLogos;
            // 가로(원주) 오프셋 대신 세로(반지름) 오프셋 — 밴드 두께가 최소 조각각 기준 원주
            // 방향 여유폭보다 넓어 더 큰 칩을 안전하게 세로로 쌓을 수 있다(2026-09, 사용자 요청).
            const rStep = SUB_CHIP + SUB_CHIP_GAP;
            return subs.map((sub, i) => {
              const rOffset = (i - (subs.length - 1) / 2) * rStep;
              const [sx, sy] = polar(LOGO_R + rOffset, mid);
              return (
                <div
                  key={`logo-${seg.key}-${sub.key}`}
                  className="absolute"
                  style={{ left: sx, top: sy, transform: "translate(-50%, -50%)" }}
                >
                  <BrandMark
                    ticker={sub.ticker}
                    name={sub.name}
                    isForeign={sub.isForeign}
                    etfBrand={sub.etfBrand}
                    size={SUB_CHIP}
                    bgColor={seg.color}
                    fontSize={ETF_LABEL_FONT_SIZE}
                  />
                </div>
              );
            });
          }

          const chip = chipSizeFor(a1 - a0);
          if (chip < CHIP_HIDE_BELOW) return null; // 하한도 못 채우는 좁은 조각은 생략
          const [gx, gy] = polar(LOGO_R, mid);
          return (
            <div
              key={`logo-${seg.key}`}
              className="absolute"
              style={{ left: gx, top: gy, transform: "translate(-50%, -50%)" }}
            >
              <BrandMark
                ticker={seg.ticker}
                name={seg.name}
                isForeign={seg.isForeign}
                etfBrand={seg.etfBrand}
                size={chip}
                bgColor={seg.color}
                fontSize={ETF_LABEL_FONT_SIZE}
              />
            </div>
          );
        })}

        {/* 링 바깥 라벨 — 이름(해외=티커/국내=종목명) + 비중%. 아이콘은 조각 안으로 이동 */}
        {labels.map(({ seg, lx, ly, zone }) => {
          const transform =
            zone === "right" ? "translate(0, -50%)"
              : zone === "left" ? "translate(-100%, -50%)"
                : zone === "top" ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)";
          // 라벨 폭 하한 64 — 9/3시 방향(가용폭 ≈68)에서 하한이 가용폭을 넘으면 박스가 링 좌표계
          // (0..VIEW_W)를 벗어나 화면 밖으로 짤린다. 좁은 존은 line-clamp-3 + 말줄임으로 수렴.
          const labelMaxW = labelMaxWOf(zone, lx);
          const alignCls =
            zone === "right" ? "items-start text-left"
              : zone === "left" ? "items-end text-right"
                : "items-center text-center";
          // 이름으로 통일(주식 현황 범례·투자 유형 설명과 동일) — 티커는 로고(BrandMark)에만 사용
          const label = seg.name;
          return (
            <div
              key={seg.key}
              className={`absolute flex flex-col ${alignCls} overflow-hidden`}
              style={{ left: lx, top: ly, transform, maxWidth: labelMaxW }}
            >
              {/* min-w-0 + max-w-full 로 상위 maxWidth 가 텍스트 노드까지 전파되게 하고, 단어(토큰) 경계에만
                  <wbr>를 둬 줄바꿈이 단어 단위로 일어나게 한다. 한 토큰이 폭보다 길 때만 overflow-wrap:break-word
                  로 글자 분리 + line-clamp(3) 말줄임 — 가로 오버플로우(카드 밖 짤림) 차단 */}
              <div className="flex flex-col leading-tight min-w-0 max-w-full">
                <span
                  className={`font-semibold tracking-tight text-foreground ${labelClampCls} [word-break:keep-all] [overflow-wrap:break-word] max-w-full`}
                  style={rLabelFont ? { fontSize: rLabelFont, lineHeight: 1.15 } : undefined}
                >
                  {splitNameWords(label).map((toks, wi) => (
                    <Fragment key={wi}>
                      {wi > 0 && " "}
                      {toks.map((t, ti) => (
                        <Fragment key={ti}>
                          {ti > 0 && <wbr />}
                          {t}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </span>
                <span
                  className="font-bold tabular-nums whitespace-nowrap"
                  style={{ color: seg.color, ...(rLabelFont ? { fontSize: rLabelFont, lineHeight: 1.15 } : {}) }}
                >
                  {seg.truePct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // 캡처 인스턴스: VIEW_W 고정 그대로(저장 PNG 구도 불변)
  if (!responsive) {
    return <div className="flex flex-col items-center">{ring}</div>;
  }
  // 화면용 프리뷰: 링을 컨테이너 폭에 맞춰 축소(레이아웃 박스도 스케일된 크기로 잡아 가로 넘침 없음)
  return (
    <div ref={outerRef} className="w-full flex justify-center overflow-hidden" style={{ height: viewH * scale }}>
      <div className="shrink-0" style={{ width: canvasW * scale, height: viewH * scale }}>
        {ring}
      </div>
    </div>
  );
}
