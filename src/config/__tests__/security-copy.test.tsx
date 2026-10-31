// #61 보안 안내 문구 정정 — node 환경(jsdom 없음): 정적 마크업·grep으로 검사.
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 다이얼로그는 포털이라 정적 렌더가 비어 나온다 → 자식만 그대로 렌더하는 대체 모듈
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
  return { Dialog: Pass, DialogContent: Pass, DialogHeader: Pass, DialogTitle: Pass, DialogDescription: Pass };
});
// 동기화 메뉴: preview에서는 cs.enabled=false라 렌더되지 않음 → enabled=true mock으로 문구 확인(알려진 한계 대체 검증)
vi.mock("@/lib/cloud-sync/cloud-sync-provider", () => ({
  useCloudSync: () => ({ enabled: true, status: "none", assetId: null, syncLink: null, setShowConnectDialog: () => {} }),
}));
vi.mock("@/app/(main)/_components/pwa/pwa-guide-illustrations", () => ({ SyncSetupAnimation: () => null }));

import {
  SECURITY_COPY,
  APP_GUIDE_SECURITY_DESC,
  SYNC_MENU_SECURITY_DESC,
  SCREENSHOT_UPLOAD_NOTICE,
} from "../security-copy";
import { AppGuideContent } from "@/app/(main)/_components/header-menu/app-guide";
import { CloudSyncMenuEntry } from "@/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry";

const ROOT = path.resolve(__dirname, "../../..");
const MAIN = "src/app/(main)/_components";
const UPLOAD_FILES = ["stock", "crypto", "cash", "loan"].map((k) => `${MAIN}/forms/asset-update/screenshot/${k}-screenshot-import.tsx`);
const EDITED_FILES = [
  `${MAIN}/layout/onboarding/welcome-guide.tsx`,
  `${MAIN}/header-menu/app-guide.tsx`,
  `${MAIN}/functions/cloud-sync/cloud-sync-menu-entry.tsx`,
  ...UPLOAD_FILES,
  "src/config/security-copy.ts",
];
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// 문자열 리터럴·JSX 텍스트만 남긴다(주석 제거). 코드 식별자 blob·pubKey 오탐을 피하려고 대상 파일도 한정한다.
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("구 문구 제거(완료 기준 1)", () => {
  it.each(EDITED_FILES)("%s", (rel) => {
    const src = stripComments(read(rel));
    for (const w of ["절대 벗어나지", "원천 불가", "문제없습니다", "(blob)", "(pubKey)", "E2EE 암호학적", "영지식", "PBKDF2"]) {
      expect(src).not.toContain(w);
    }
  });
});

describe("'이중 암호화' 문장은 security-copy.ts 한 블록에만(완료 기준 8)", () => {
  it("src/ 다른 파일 UI 문자열에 0건", () => {
    const hits = walk(path.join(ROOT, "src"))
      .filter((p) => !p.endsWith(path.join("config", "security-copy.ts")))
      .filter((p) => /이중 암호화|이중으로 암호화/.test(stripComments(readFileSync(p, "utf8"))));
    expect(hits).toEqual([]);
  });
  it("security-copy.ts 안에서는 대표 확인 대기 블록 1개에 5문장", () => {
    const src = read("src/config/security-copy.ts");
    const blockStart = src.indexOf("const DUAL_ENCRYPTION_COPY");
    const blockEnd = src.indexOf("} as const;", blockStart);
    expect(src).toContain("// 대표 확인 대기: '이중 암호화' 표현");
    const block = src.slice(blockStart, blockEnd);
    const outside = src.slice(0, blockStart) + src.slice(blockEnd);
    expect(block.match(/이중 암호화|이중으로 암호화/g)?.length).toBe(5);
    expect(stripComments(outside)).not.toMatch(/이중 암호화|이중으로 암호화/);
  });
});

describe("새 문구 규칙(완료 기준 4)", () => {
  const all = [...SECURITY_COPY.flatMap((c) => [c.title, c.desc]), APP_GUIDE_SECURITY_DESC, SYNC_MENU_SECURITY_DESC, SCREENSHOT_UPLOAD_NOTICE];
  it("'서버'가 주어로 나오는 문장 없음", () => {
    for (const s of all) expect(s).not.toMatch(/서버(는|가|에서)/);
  });
  it("카드2 '저장·전송'은 가운뎃점 앞뒤 WORD JOINER로 묶음(C25)", () => {
    expect(SECURITY_COPY[1].desc).toContain("저장⁠·⁠전송되지 않아요.");
    expect(SECURITY_COPY[1].desc).not.toContain("저장·전송");
  });
  it("카드 3개 순서·id 고정", () => {
    expect(SECURITY_COPY.map((c) => c.id)).toEqual(["local", "sync", "admin"]);
    expect(SECURITY_COPY.map((c) => c.title)).toEqual(["내 기기에 저장", "이중 암호화 동기화", "관리자도 알 수 없어요"]);
  });
});

describe("앱가이드 카드 = SECURITY_COPY(완료 기준 2)", () => {
  const html = renderToStaticMarkup(<AppGuideContent />);
  it("제목·본문 3쌍 모두 렌더, 기술 용어 강조 span 없음", () => {
    for (const c of SECURITY_COPY) {
      expect(html).toContain(c.title);
      expect(html).toContain(c.desc);
    }
    expect(html).not.toContain("text-foreground font-medium");
    expect(html.match(/<h4[^>]*text-balance break-keep/g)?.length).toBe(3);
  });
});

describe("동기화 메뉴 설명(cs.enabled=true mock)", () => {
  it("마지막 문장이 상수이고 break-keep", () => {
    const html = renderToStaticMarkup(<CloudSyncMenuEntry open onOpenChange={() => {}} />);
    expect(html).toContain(SYNC_MENU_SECURITY_DESC);
    expect(html).toMatch(/class="[^"]*break-keep[^"]*">새 기기로 자산을 안전하게 전달하고/);
    // 금고 암호 문장(177행)은 무변경
    expect(html).toContain("저장·전송되지 않습니다.");
  });
});

describe("스크린샷 업로드 박스 4종 동일(완료 기준 3·9)", () => {
  const BOX = '<div className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep">\n              {SCREENSHOT_UPLOAD_NOTICE}\n            </div>';
  it.each(UPLOAD_FILES)("%s — 같은 상수·같은 클래스, 테두리 없음", (rel) => {
    const src = read(rel);
    expect(src).toContain('import { SCREENSHOT_UPLOAD_NOTICE } from "@/config/security-copy";');
    expect(src).toContain(BOX);
  });
});
