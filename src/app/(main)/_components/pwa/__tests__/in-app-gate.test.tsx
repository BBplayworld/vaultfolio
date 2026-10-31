// #60 인앱 게이트 판정·0건 헬퍼·iOS 가이드 notice — node 환경(jsdom 없음): 순수 함수·정적 마크업만 검사.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveInAppGate, hasRestoreHash } from "../in-app-browser-gate";
import { InAppExternalGuide } from "../in-app-external-guide";
import { hasAnyAssets } from "@/lib/asset/asset-storage";

const empty = { realEstate: [], stocks: [], crypto: [], cash: [], loans: [] };

describe("hasAnyAssets — 교체 3곳(page·use-share-artifacts·preview-gate) 기존 판정과 동일", () => {
  // 기존 3곳의 원래 식(5배열 길이 합 > 0)
  const legacy = (d: typeof empty) =>
    d.realEstate.length + d.stocks.length + d.crypto.length + d.cash.length + d.loans.length > 0;
  it("0건 → false", () => {
    expect(hasAnyAssets(empty)).toBe(false);
    expect(hasAnyAssets(empty)).toBe(legacy(empty));
  });
  it.each(Object.keys(empty))("%s 1건만 → true", (k) => {
    const d = { ...empty, [k]: [{}] } as unknown as typeof empty;
    expect(hasAnyAssets(d)).toBe(true);
    expect(hasAnyAssets(d)).toBe(legacy(d));
  });
});

describe("hasRestoreHash", () => {
  it.each([
    ["#share=abc", true],
    ["#share=abc&k=1", true],
    ["#sync=aid", true],
    ["#asset=aid", true],
    ["#vault=aid", true],
    ["", false],
    ["#", false],
    ["#top", false],
    ["#shared=1", false],
  ])("%s → %s", (hash, expected) => {
    expect(hasRestoreHash(hash)).toBe(expected);
  });
});

describe("resolveInAppGate (spec 5절 경계 표)", () => {
  const base = {
    mounted: true, isStandalone: false, isInApp: true, isDataLoaded: true,
    hasAssets: false, isSharePending: false, syncAssetId: null as string | null, restoreHash: false,
  };
  it("마운트 전·standalone·일반 브라우저 → none", () => {
    expect(resolveInAppGate({ ...base, mounted: false })).toBe("none");
    expect(resolveInAppGate({ ...base, isStandalone: true })).toBe("none");
    expect(resolveInAppGate({ ...base, isStandalone: true, isDataLoaded: false })).toBe("none");
    expect(resolveInAppGate({ ...base, isInApp: false, hasAssets: true })).toBe("none");
  });
  it("데이터 로드 전 → cover(0건·1건 모두, 경고·웰컴 문구 없음)", () => {
    expect(resolveInAppGate({ ...base, isDataLoaded: false })).toBe("cover");
    expect(resolveInAppGate({ ...base, isDataLoaded: false, hasAssets: true })).toBe("cover");
  });
  it("인앱 0건·동기화 없음·해시 없음 → welcome", () => {
    expect(resolveInAppGate(base)).toBe("welcome");
  });
  it("1건 이상 / 공유 대기 / 동기화 assetId / 복원 해시 → gate(현행)", () => {
    expect(resolveInAppGate({ ...base, hasAssets: true })).toBe("gate");
    expect(resolveInAppGate({ ...base, isSharePending: true })).toBe("gate");
    expect(resolveInAppGate({ ...base, syncAssetId: "aid" })).toBe("gate");
    expect(resolveInAppGate({ ...base, restoreHash: true })).toBe("gate");
  });
});

describe("InAppExternalGuide notice", () => {
  it("미전달 시 기존 문구 그대로(설치 흐름·1건 이상 게이트 회귀)", () => {
    const html = renderToStaticMarkup(<InAppExternalGuide />);
    expect(html).toContain("현재 웹페이지 주소가 복사되었습니다!");
    expect(html).toContain("앱 설치 기능이 지원되지 않으므로");
    expect(html).toContain("이동한 기본 브라우저에서 복사된 주소로 접속하면 그대로 이어집니다.");
  });
  it("전달 시 앰버 블록 안쪽만 대체, 단계·하단 안내 유지", () => {
    const html = renderToStaticMarkup(<InAppExternalGuide notice={<p>캡션</p>} lastStep="마지막" />);
    expect(html).toContain("캡션");
    expect(html).not.toContain("현재 웹페이지 주소가 복사되었습니다!");
    expect(html).not.toContain("앱 설치 기능");
    expect(html).toContain("bg-amber-500/10");
    expect(html).toContain("다른 브라우저로 열기");
    expect(html).toContain("마지막");
    expect(html).toContain("메뉴에 위 항목이 보이지 않는다면");
  });
});
