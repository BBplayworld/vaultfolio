import { describe, expect, it } from "vitest";
import { emptyFailTitle, mapParseErrorTitle, makeScreenshotFail } from "../asset/screenshot-fail";

describe("mapParseErrorTitle (#99 4절 매핑)", () => {
  it("형식 400", () => expect(mapParseErrorTitle(400, "JPG, PNG, WEBP, HEIC 형식만 지원합니다.")).toBe("JPG·PNG·WEBP·HEIC 사진만 읽을 수 있어요"));
  it("크기 400·413", () => {
    expect(mapParseErrorTitle(400, "이미지 크기는 10MB 이하여야 합니다.")).toBe("10MB 이하 사진만 읽을 수 있어요");
    expect(mapParseErrorTitle(413, "요청 본문이 너무 큽니다.")).toBe("10MB 이하 사진만 읽을 수 있어요");
  });
  it("429·혼잡·한도 500", () => {
    expect(mapParseErrorTitle(429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")).toBe("요청이 많아 지금은 읽지 못했어요");
    expect(mapParseErrorTitle(500, "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.")).toBe("요청이 많아 지금은 읽지 못했어요");
    expect(mapParseErrorTitle(500, "AI 요청 한도를 초과했습니다.")).toBe("요청이 많아 지금은 읽지 못했어요");
  });
  it("그 밖·처음 보는 문구·error 없음은 기본값", () => {
    for (const [s, m] of [[422, "파싱 결과를 읽을 수 없습니다."], [500, "AI 인식 중 오류가 발생했습니다."], [500, "AI 분석을 사용할 수 없습니다."], [400, "파일이 없습니다."], [403, "x"], [500, "전혀 새로운 문구"], [500, undefined], [500, 123]] as const) {
      expect(mapParseErrorTitle(s, m)).toBe("읽지 못했어요");
    }
  });
});

describe("빈 결과 제목·seq", () => {
  it("자산별 제목", () => {
    expect(emptyFailTitle("stock")).toBe("인식된 종목이 없어요");
    expect(emptyFailTitle("cash")).toBe("인식된 계좌·예금이 없어요");
  });
  it("seq는 매번 증가", () => {
    expect(makeScreenshotFail("empty", "a").seq).toBeLessThan(makeScreenshotFail("empty", "a").seq);
  });
});
