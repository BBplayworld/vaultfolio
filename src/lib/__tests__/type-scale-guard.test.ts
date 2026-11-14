import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// #215 타이포 스케일 재유입 방지 — 크기 클래스에 `sm:`·`lg:` 접두와 임의 px를 다시 쓰지 못하게 막는다.
// 규칙 정본: .claude/_knowledge/design-system.md §2 (타입 경계는 md·xl뿐, 환경별 값은 globals.css 토큰이 맡는다)
const SRC = resolve(__dirname, "../..");
const SIZE = "(?:2xs|xs|sm|base|lg|xl|[2-9]xl|\\[[^\\]]+\\])";
const RESPONSIVE = new RegExp(`(?<![\\w-])(?:sm|lg):text-${SIZE}(?![\\w-])`, "g");
const ARBITRARY = /(?<![\w-])(?:[\w[\]-]+:)*text-\[[0-9.]+(?:px|rem|em)\](?![\w-])/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") walk(p, out);
    } else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function hits(re: RegExp): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replaceAll("\\", "/");
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(re)) out.push(`${rel}:${i + 1} ${m[0]}`);
    });
  }
  return out;
}

const SHARE = "app/(main)/_components/header-menu/share/";
/** theme.ts의 인증카드 고정 블록(ASSET_THEME_SHOT ~ ASSET_THEME_SHOT_BIG 끝) 줄 범위 */
const shotRange = (() => {
  const lines = readFileSync(join(SRC, "config/theme.ts"), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("export const ASSET_THEME_SHOT = {")) + 1;
  const bigStart = lines.findIndex((l) => l.startsWith("export const ASSET_THEME_SHOT_BIG = {"));
  const end = bigStart + lines.slice(bigStart).findIndex((l) => l.startsWith("}")) + 1;
  return { start, end };
})();
const inShot = (hit: string) => {
  const m = hit.match(/^config\/theme\.ts:(\d+) /);
  return !!m && Number(m[1]) >= shotRange.start && Number(m[1]) <= shotRange.end;
};

describe("타이포 금지 패턴 가드", () => {
  it("인증카드 고정 블록 범위를 찾는다", () => {
    expect(shotRange.start).toBeGreaterThan(0);
    expect(shotRange.end).toBeGreaterThan(shotRange.start);
  });

  it("크기 클래스의 sm:·lg: 접두는 인증카드(SHOT·share) 10곳뿐", () => {
    const all = hits(RESPONSIVE);
    const outside = all.filter((h) => !h.startsWith(SHARE) && !inShot(h));
    expect(outside).toEqual([]);
    // 인증카드 쪽도 늘리지 않는다(프리뷰 분기 — type-fixed 안에서 지금과 같은 값)
    expect(all).toHaveLength(10);
  });

  it("임의 px 크기는 인증카드·PWA 삽화·아이콘 이니셜 2곳뿐", () => {
    const outside = hits(ARBITRARY).filter((h) => !h.startsWith(SHARE) && !inShot(h) && !h.startsWith("app/(main)/_components/pwa/pwa-guide-illustrations.tsx:"));
    expect(outside.map((h) => h.replace(/:\d+ /, " ")).sort()).toEqual([
      "app/(main)/_components/views/detail/tabs/crypto-tab.tsx text-[10px]",
      "app/(main)/_components/views/detail/tabs/stock-tab.tsx text-[10px]",
    ]);
  });

  it("font-extrabold는 인증카드 1곳뿐", () => {
    const all = hits(/(?<![\w-])font-extrabold(?![\w-])/g).map((h) => h.replace(/:\d+ .*/, ""));
    expect([...new Set(all)]).toEqual([`${SHARE}share-card.tsx`]);
  });
});
