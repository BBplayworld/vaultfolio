import { describe, it, expect } from "vitest";
import { allowedUtmQuery } from "@/lib/analytics/utm-allow";

describe("allowedUtmQuery", () => {
  it("허용 3키만 고정 순서로 통과, 그 밖의 키·해시 제거", () => {
    expect(allowedUtmQuery("/ratio", "?utm_campaign=c&foo=1&utm_source=s&utm_medium=m&utm_term=x#h")).toBe(
      "?utm_source=s&utm_medium=m&utm_campaign=c",
    );
  });
  it("값 길이 51·특수문자·인코딩된 <는 거부", () => {
    expect(allowedUtmQuery("/ratio", `?utm_source=${"a".repeat(51)}`)).toBe("");
    expect(allowedUtmQuery("/ratio", `?utm_source=${"a".repeat(50)}`)).not.toBe("");
    expect(allowedUtmQuery("/ratio", "?utm_source=a b")).toBe("");
    expect(allowedUtmQuery("/ratio", "?utm_source=%3Cscript%3E")).toBe("");
    expect(allowedUtmQuery("/ratio", "?utm_source=")).toBe("");
  });
  it("/ratio/는 허용, /ratio-x·/ 는 빈 문자열", () => {
    expect(allowedUtmQuery("/ratio/", "?utm_source=a")).toBe("?utm_source=a");
    expect(allowedUtmQuery("/ratio-x", "?utm_source=a")).toBe("");
    expect(allowedUtmQuery("/", "?utm_source=a")).toBe("");
  });
});
