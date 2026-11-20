// #249 기준 스냅샷(AC-9) — 체험이 아닌 방문의 웰컴 렌더 diff 0 증명용. 코드 변경 전에 먼저 커밋해 머지 전 마크업을 고정한다.
// node 환경(jsdom 없음): renderToStaticMarkup 초기 마크업만. 보유자 홈은 page 전체 렌더 불가 → 정적 검사 + qa Playwright DOM 비교(한계).
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/hooks/use-asset-import", () => ({
  useAssetImport: () => ({ fileInputRef: { current: null }, isImporting: false, openFilePicker: () => {}, handleFileChange: () => {} }),
}));
vi.mock("@/lib/cloud-sync/cloud-sync-provider", () => ({
  useCloudSync: () => ({ setShowConnectDialog: () => {}, syncLink: null }),
}));
vi.mock("@/hooks/use-share-artifacts", () => ({
  useShareArtifacts: () => ({ generateShareArtifacts: async () => null, hasAssets: false }),
}));

import { WelcomeGuide, WelcomeAssetCta, WelcomeInAppCta } from "../welcome-guide";

describe("체험 아닌 방문 웰컴 마크업 고정(#249 AC-9)", () => {
  it("WelcomeGuide 초기 마크업(체험 링크 허용·불허)", () => {
    expect(renderToStaticMarkup(<WelcomeGuide allowTrial />)).toMatchSnapshot();
    expect(renderToStaticMarkup(<WelcomeGuide />)).toMatchSnapshot();
  });
  it("등록 칸 — 일반·설치 앱·체험 복귀(전달값 없음) 포커스", () => {
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone={false} />)).toMatchSnapshot();
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone />)).toMatchSnapshot();
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone={false} focusOnMount />)).toMatchSnapshot();
  });
  it("인앱 칸 — iOS·Android", () => {
    expect(renderToStaticMarkup(<WelcomeInAppCta isIOS />)).toMatchSnapshot();
    expect(renderToStaticMarkup(<WelcomeInAppCta isIOS={false} />)).toMatchSnapshot();
  });
});
