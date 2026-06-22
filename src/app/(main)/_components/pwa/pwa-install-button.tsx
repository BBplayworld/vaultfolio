"use client";

import { Download } from "lucide-react";
import { MAIN_PALETTE } from "@/config/theme";
import { PwaInstallFlow } from "./pwa-install-flow";

const ICON_BTN = "inline-flex items-center justify-center h-10 sm:h-11 w-10 sm:w-11 rounded-lg shrink-0 transition-opacity hover:opacity-85";

/** 헤더의 다운로드 아이콘 설치 버튼. 설치 흐름은 PwaInstallFlow(웰컴가이드와 공용)에 위임. */
export function PwaInstallButton() {
  return (
    <PwaInstallFlow>
      {({ onClick }) => (
        <button
          onClick={onClick}
          className={`${ICON_BTN} border-none text-white`}
          style={{ backgroundColor: MAIN_PALETTE[0] }}
          aria-label="앱 설치"
          title="앱 설치"
        >
          <Download className="size-5 sm:size-6" />
        </button>
      )}
    </PwaInstallFlow>
  );
}
