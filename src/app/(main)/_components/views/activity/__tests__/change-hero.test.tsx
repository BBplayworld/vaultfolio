// 주식 Hero 기준가 없음 상태(ui-review) — 증감 줄 대신 안내 1줄, 이름 줄 유지
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangeHero } from "../change-hero";

describe("ChangeHero 기준가 없음", () => {
  it("delta=null이면 change-hero-delta·시작→끝 없이 안내 문구만", () => {
    const html = renderToStaticMarkup(
      <ChangeHero title="하루 주식 수익" delta={null} start={0} end={0} message="기준가를 불러오지 못했어요. 잠시 후 다시 확인해 주세요" />,
    );
    expect(html).not.toContain("change-hero-delta");
    expect(html).not.toContain("change-hero-start");
    expect(html).toContain("기준가를 불러오지 못했어요");
    expect(html).toContain("하루 주식 수익");
  });
});
