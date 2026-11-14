import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// #215 타이포 스케일 — globals.css의 환경별 토큰 값이 design-system.md §2 표와 같은지 고정한다.
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

/** `머리 {` 뒤 첫 중괄호 블록(중첩 포함)의 본문 */
function block(head: string): string {
  const start = css.indexOf(head);
  expect(start, head).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`닫히지 않은 블록: ${head}`);
}

function tokens(body: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of body.matchAll(/--text-([0-9a-z]+):\s*([0-9.]+)rem/g)) out[m[1]] = Math.round(Number(m[2]) * 16 * 100) / 100;
  return out;
}

const MOBILE = { "2xs": 11, xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 };
const TABLET = { "2xs": 12, xs: 13, sm: 15, base: 17, lg: 19, xl: 22, "2xl": 27, "3xl": 33, "4xl": 40 };
const PC = { "2xs": 12, xs: 14, sm: 16, base: 18, lg: 20, xl: 24, "2xl": 30, "3xl": 36, "4xl": 44 };

describe("타이포 토큰(globals.css)", () => {
  it("text-2xs는 @theme(inline 아님)에 11px로 정의된다", () => {
    expect(css).toMatch(/@theme \{[^}]*--text-2xs: 0\.6875rem;[^}]*--text-2xs--line-height: calc\(1 \/ 0\.6875\);/);
    expect(block("@theme inline")).not.toMatch(/--text-/);
  });

  it("태블릿(48rem)·PC(80rem) 값이 표와 같다", () => {
    expect(tokens(block("@media (min-width: 48rem)"))).toEqual(TABLET);
    expect(tokens(block("@media (min-width: 80rem)"))).toEqual(PC);
  });

  it(".type-fixed는 모바일 값으로 고정한다", () => {
    expect(tokens(block(".type-fixed"))).toEqual(MOBILE);
  });

  it("타입 경계는 48rem·80rem 두 곳뿐이고 줄높이 변수는 덮어쓰지 않는다", () => {
    const withText = [...css.matchAll(/@media \(([^)]+)\)\s*\{\s*:root\s*\{[^}]*--text-/g)].map((m) => m[1]);
    expect(withText).toEqual(["min-width: 48rem", "min-width: 80rem"]);
    expect(css.match(/--text-[0-9a-z]+--line-height/g)).toEqual(["--text-2xs--line-height"]);
  });

  it("인증카드 프리뷰·캡처 래퍼 두 곳에 type-fixed가 붙어 있다", () => {
    const menu = readFileSync(resolve(__dirname, "../../app/(main)/_components/header-menu/share/share-menu.tsx"), "utf8");
    expect(menu.match(/className="type-fixed /g)?.length).toBe(2);
    expect(menu).toContain('className="type-fixed fixed left-[-9999px] top-0 pointer-events-none"');
  });
});
