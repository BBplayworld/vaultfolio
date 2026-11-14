import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

// C26 — 보안 문구는 사실 서술만(5.113). '안전하게 전송·전달' 같은 보증형 표현을 되돌리지 않는다.
const read = (p: string) => readFileSync(p, "utf8");

describe("C26 문구", () => {
  it("PWA 설치 PIN 안내: 보증형 표현 없이 용도만 서술", () => {
    const s = read("src/app/(main)/_components/pwa/pwa-install-flow.tsx");
    expect(s).not.toContain("안전하게 전송");
    expect(s).toContain("웹 데이터를 설치할 앱에서 열기 위한 1회성 비밀번호");
  });
  it("기기 동기화 메뉴 설명: 암호화 사실 서술", () => {
    const s = read("src/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx");
    expect(s).not.toContain("안전하게 전달");
    expect(s).toContain("새 기기로 자산을 암호화해 옮기고(공유)");
  });
});
