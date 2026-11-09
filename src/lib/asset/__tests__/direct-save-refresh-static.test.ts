// #93 p2-2: 현금·대출·주식·코인 직접 추가·수정 저장 성공 시 해당 카테고리 최신화 기록 — 컴포넌트 DOM 테스트가 없어 소스 정적 검사로 고정
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../../app/(main)/_components/forms/asset-update/input");

describe("직접 저장 성공 분기의 markCategoryRefreshed", () => {
  for (const cat of ["cash", "loan", "stock", "crypto"] as const) {
    it(`${cat}-input: 추가·수정 성공 2곳 모두 기록, 실패 분기(else)에는 없음`, () => {
      const src = readFileSync(path.join(DIR, `${cat}-input.tsx`), "utf8");
      const hits = src.match(new RegExp(`if \\(success\\) \\{\\s*markCategoryRefreshed\\("${cat}"\\);`, "g")) ?? [];
      expect(hits).toHaveLength(2);
      expect(src.match(/markCategoryRefreshed\(/g)).toHaveLength(2);
    });
  }
});
