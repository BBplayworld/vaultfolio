// #373(5.182) 투자 유형 PNG 긴 문장 '넘칠 때만 2줄 분할' — 실측 판정·측정 복원·렌더 분기·캡처 대기
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/font/google", () => ({ Leckerli_One: () => ({ className: "" }) }));
import { DESC_FIT_SLACK_PX, fitsOneLine, measureLongLineFit, splitHighlightParts } from "../use-capture-line-fit";
import { groupDescriptionLines, renderDescriptionInLines } from "../share-card";

const BLOCK_W = 511.67; // 캡처 680px · max-w 82% 실측 상한

describe("fitsOneLine — w ≤ blockW − 17px일 때만 한 줄", () => {
  it("경계", () => {
    expect(DESC_FIT_SLACK_PX).toBe(17);
    expect(fitsOneLine(BLOCK_W - 17, BLOCK_W)).toBe(true);
    expect(fitsOneLine(BLOCK_W - 16.99, BLOCK_W)).toBe(false);
    expect(fitsOneLine(511.83, BLOCK_W)).toBe(false); // 0.16px 경계 넘침(38자) → 2줄
    expect(fitsOneLine(480, BLOCK_W)).toBe(true);
  });
  it("측정 실패(0·NaN·블록 0)는 false = 2줄 폴백", () => {
    expect(fitsOneLine(0, BLOCK_W)).toBe(false);
    expect(fitsOneLine(Number.NaN, BLOCK_W)).toBe(false);
    expect(fitsOneLine(300, 0)).toBe(false);
  });
});

// 최소 가짜 DOM — 글자당 px, strong은 글자당 +1px. el은 width:100%일 때만 BLOCK_W
function fakeDom(opts: { throwOnRect?: boolean } = {}) {
  type Node = { tag: string; text: string; className?: string; children: Node[] };
  const textOf = (n: Node): number => n.children.reduce((a, c) => a + textOf(c), n.tag === "#text" ? n.text.length * 13 : n.tag === "strong" ? n.text.length * 14 : 0);
  const appended: unknown[] = [];
  const doc = {
    createElement(tag: string) {
      const node: Node & Record<string, unknown> = { tag, text: "", children: [], style: { cssText: "" } };
      Object.defineProperty(node, "textContent", {
        get: () => node.text,
        set: (v: string) => {
          if (tag === "span") node.children = [];
          node.text = v;
        },
      });
      node.appendChild = (c: Node) => node.children.push(c);
      node.getBoundingClientRect = () => ({ width: textOf(node) });
      node.remove = () => appended.splice(appended.indexOf(node), 1);
      return node;
    },
    createTextNode(text: string) {
      return { tag: "#text", text, children: [] };
    },
  };
  const el = {
    ownerDocument: doc,
    style: { width: "" },
    getBoundingClientRect() {
      if (opts.throwOnRect) throw new Error("layout 없음");
      return { width: el.style.width === "100%" ? BLOCK_W : 300 };
    },
    appendChild(c: unknown) {
      appended.push(c);
    },
  };
  return { el: el as unknown as HTMLElement, appended, doc };
}

describe("measureLongLineFit", () => {
  it("블록 폭은 width:100%로 재고 끝나면 width·측정 span을 되돌린다", () => {
    const { el, appended } = fakeDom();
    const short = "가".repeat(36); // 36×13 = 468 ≤ 494.67 → 한 줄
    const long = "가".repeat(39); // 39×13 = 507 > 494.67 → 2줄
    expect(measureLongLineFit(el, [short, long], [])).toEqual([true, false]);
    expect(el.style.width).toBe("");
    expect(appended).toHaveLength(0);
  });
  it("강조어는 strong(굵은 폭)으로 잰다 — 같은 글자수라도 강조어가 있으면 넘칠 수 있다", () => {
    const { el } = fakeDom();
    const line = "가".repeat(25) + "애플나스닥테크기업주"; // 일반 35×13=455 / 강조 25×13+10×14=465 둘 다 한 줄
    expect(measureLongLineFit(el, [line], ["애플나스닥테크기업주"])).toEqual([true]);
    const edge = "가".repeat(28) + "나스닥백테크기업주"; // 일반 37×13=481 / 강조 28×13+9×14=490 → 한 줄(≤494.67)
    expect(measureLongLineFit(el, [edge], ["나스닥백테크기업주"])).toEqual([true]);
    const over = "가".repeat(27) + "나스닥백테크기업주가가"; // 강조 포함 29×13+9×14=503 → 2줄
    expect(measureLongLineFit(el, [over], ["나스닥백테크기업주"])).toEqual([false]);
  });
  it("측정 중 예외는 전부 false(2줄 폴백)이고 width는 복원된다", () => {
    const { el } = fakeDom({ throwOnRect: true });
    expect(measureLongLineFit(el, ["가".repeat(36), "가".repeat(37)], [])).toEqual([false, false]);
    expect(el.style.width).toBe("");
  });
});

describe("splitHighlightParts — 기존 강조 분할과 같다", () => {
  it("긴 용어 우선·특수문자 이스케이프", () => {
    expect(splitHighlightParts("NASDAQ 100 같은 S&P 500 투자", ["S&P 500", "NASDAQ 100", "NASDAQ"]).filter((p) => p.strong).map((p) => p.text)).toEqual(["NASDAQ 100", "S&P 500"]);
    expect(splitHighlightParts("강조 없음", [])).toEqual([{ text: "강조 없음", strong: false }]);
  });
});

describe("renderDescriptionInLines 캡처 분기", () => {
  const A4 = "한 걸음 더 나아가 해외 증시 문턱이 낮은 글로벌 감각의 소유자."; // 36자(main 한 줄)
  const SHORT = "국내 주식을 차곡차곡 모으는 편."; // 35자 이하
  const text = `${SHORT} ${A4}`;
  const render = (fit?: boolean[] | null) => renderToStaticMarkup(<>{renderDescriptionInLines(text, [], 35, 31, fit)}</>);
  it("묶음 그대로(긴 묶음 1개)", () => {
    expect(groupDescriptionLines(text, 35).filter((l) => l.length > 35)).toEqual([A4]);
  });
  it("한 줄 판정이면 nowrap + 31px 한 줄, 35자 이하 줄은 main 마크업 그대로", () => {
    const html = render([true]);
    expect(html).toContain(`<div style="height:31px">${SHORT}</div>`);
    expect(html).toContain(`<div class="whitespace-nowrap" style="height:31px">${A4}</div>`);
  });
  it("넘침·판정 전(null)·실패(false)는 2줄 분할, 줄마다 31px", () => {
    for (const fit of [[false], null, undefined]) {
      const html = render(fit);
      expect(html).not.toContain(`>${A4}<`);
      expect(html.match(/class="whitespace-nowrap" style="height:31px"/g)).toHaveLength(2);
    }
  });
  it("화면 미리보기(fixedLinePx 없음)는 변경 0 — br 줄바꿈", () => {
    expect(renderToStaticMarkup(<>{renderDescriptionInLines(text, [], 27)}</>)).toBe(`${SHORT}<br/>${A4}`);
  });
});

describe("캡처 시점 — 판정 완료 뒤에만 toPng (소스 고정)", () => {
  const dir = join(__dirname, "..");
  const menu = readFileSync(join(dir, "share-menu.tsx"), "utf8");
  const card = readFileSync(join(dir, "share-card.tsx"), "utf8");
  it("captureImage가 waitDescriptionFit 뒤에 toPng를 부른다", () => {
    const body = menu.slice(menu.indexOf("const captureImage = async"), menu.indexOf("const handleSave = async"));
    expect(body.indexOf("await waitDescriptionFit(")).toBeGreaterThan(0);
    expect(body.indexOf("await waitDescriptionFit(")).toBeLessThan(body.indexOf("return toPng("));
    expect(menu).toContain(`'[data-desc-fit="pending"]'`);
  });
  it("캡처 설명 블록이 판정 상태를 data-desc-fit으로 노출한다", () => {
    expect(card).toContain('data-desc-fit={responsive ? undefined : descFit.ready ? "done" : "pending"}');
  });
});
