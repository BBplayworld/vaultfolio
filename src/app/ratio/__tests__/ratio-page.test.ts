import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import * as copy from "../ratio-copy";

// /ratio 정적 규칙 검증 — 컴포넌트 렌더 없이 소스·문구 대상(vitest node 환경)
const dir = join(__dirname, "..");
const read = (f: string) => readFileSync(join(dir, f), "utf8");

describe("/ratio 페이지 규칙(#63)", () => {
  const page = read("page.tsx");
  const preview = read("ratio-preview.tsx");

  it("metadata: canonical·og:url=/ratio, og/twitter images 재선언, summary_large_image", () => {
    expect(page).toContain("canonical: URL_PATH");
    expect(page).toContain('URL_PATH = `${APP_CONFIG.siteUrl}/ratio`');
    expect(page).toContain("url: URL_PATH");
    expect(page).toContain("images: [{ url: OG_IMAGE.url");
    expect(page).toContain("images: [OG_IMAGE.url]");
    expect(page).toContain('card: "summary_large_image"');
  });
  it("(main) 의존 금지: useAssetData·react-query·toast 미사용, SCREENSHOT_UPLOAD_NOTICE 미렌더", () => {
    for (const src of [page, preview]) {
      expect(src).not.toMatch(/useAssetData|useQuery|from "sonner"|SCREENSHOT_UPLOAD_NOTICE/);
    }
  });
  it("업로드 본문은 image·assetType=stock·entry=ratio만", () => {
    const appended = [...preview.matchAll(/form\.append\("(\w+)"/g)].map((m) => m[1]);
    expect(appended).toEqual(["image", "assetType", "entry"]);
    expect(preview).toContain('form.append("entry", "ratio")');
  });
  it("screenshot_parse·pwa_install 이벤트를 보내지 않는다", () => {
    expect(preview).not.toMatch(/trackParse|pwa_install|screenshot_parse/);
  });
  it("결과에 금액(원·$)을 쓰지 않는다", () => {
    expect(preview).not.toMatch(/formatCurrency|toLocaleString|\$\{.*원/);
  });
  it("문구: 투자 조언·서버 단정 표현 없음", () => {
    const all = [copy.RATIO_TITLE, copy.RATIO_DESC, ...Object.values(copy.RATIO_ERROR), copy.RATIO_INAPP_NOTICE, copy.RATIO_INAPP_BOX, copy.RATIO_INAPP_LAST_STEP, copy.RATIO_NOTES.fx, copy.RATIO_NOTES.saveCaption, copy.deviceLimitMessage(15)];
    for (const s of all) expect(s).not.toMatch(/쏠림|분산|위험|안전하게|서버에 저장하지 않|즉시 삭제|추천|매수|매도/);
  });
  it("인앱 lastStep은 '그대로 이어집니다'를 쓰지 않고 재업로드를 안내한다", () => {
    expect(copy.RATIO_INAPP_LAST_STEP).toContain("한 번 더 올려");
    expect(copy.RATIO_INAPP_LAST_STEP).not.toContain("이어집니다");
  });
});
