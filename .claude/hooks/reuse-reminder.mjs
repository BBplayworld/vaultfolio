#!/usr/bin/env node
// PreToolUse(Write) 비차단 훅 — src/ 하위 "신규" 파일 생성 시에만 재사용 리마인더를 컨텍스트로 주입.
// 기존 파일 수정·비-src 경로는 무소음 통과. 절대 차단하지 않는다(exit 0, deny 없음).
// 참조 정책: CLAUDE.md "재사용 우선 · 작업 최소화" / dev-rules.md "재사용 우선 체크리스트".

import { existsSync } from "node:fs";

const REMINDER =
  "신규 src 파일 생성 감지 — 만들기 전에 같은 역할의 기존 컴포넌트/유틸/패턴을 " +
  "components.md · state-and-utils.md · design-system.md 에서 먼저 확인하고, " +
  "재사용(래핑/파라미터화)으로 대체 가능한지 재검토하세요. " +
  "재사용 불가로 신규 생성한다면 공용 자산 여부를 판단하고, 공용이면 해당 카탈로그 등록이 필수입니다 " +
  "(CLAUDE.md 재사용 우선 정책 · dev-rules.md 재사용 우선 체크리스트).";

function emit(raw) {
  let filePath = "";
  try {
    filePath = (JSON.parse(raw)?.tool_input?.file_path ?? "").toString();
  } catch {
    return; // JSON 파싱 실패 → 무소음 통과
  }
  if (!filePath) return;

  const norm = filePath.replace(/\\/g, "/");
  const inSrc = /(^|\/)src\//.test(norm); // 프로젝트 src/ 하위
  const isNew = !existsSync(filePath); // 이미 있으면 수정 → 무소음

  if (inSrc && isNew) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: REMINDER,
        },
      }) + "\n",
    );
  }
}

// stdin을 모두 읽고 처리. process.exit를 부르지 않고 자연 종료해 stdout flush를 보장.
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (buf += c));
process.stdin.on("end", () => emit(buf));
// 파이프가 없을 때(수동 실행 등) 무한 대기 방지 — 타이머는 unref로 이벤트루프를 잡지 않음
setTimeout(() => {
  emit(buf);
  buf = null;
}, 1500).unref();
