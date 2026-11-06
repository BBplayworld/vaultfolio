import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";

describe("manifest (#78)", () => {
  const m = manifest();
  it("아이콘 3항목(192 any, 512 any, 512 maskable)", () => {
    expect(m.icons?.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
  });
  it("lang·categories 추가", () => {
    expect(m.lang).toBe("ko");
    expect(m.categories).toContain("finance");
  });
  it("id·start_url·scope·share_target 불변", () => {
    expect(m.id).toBe("/asset");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.share_target).toEqual({
      action: "/", method: "GET", enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    });
  });
});
