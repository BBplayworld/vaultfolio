"use client";

import type { ReactNode } from "react";
import { Copy, MoreHorizontal } from "lucide-react";

interface InAppExternalGuideProps {
  /** 3단계(이동 후) 문구. 설치 흐름은 '앱 설치', 게이트는 '접속하면 이어짐' 등 맥락별로 주입. */
  lastStep?: ReactNode;
}

/**
 * 인앱 브라우저 → 외부 브라우저 수동 이동 안내 (3단계).
 * iOS는 자동 이동 스킴이 없어 이 가이드로 폴백한다. 진입 전 현재 주소를 클립보드에 복사해 둔다.
 * PWA 설치 흐름(inAppStep)·인앱 브라우저 게이트에서 공용 재사용한다.
 */
export function InAppExternalGuide({ lastStep }: InAppExternalGuideProps = {}) {
  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 leading-relaxed">
        <Copy className="size-4 shrink-0 mt-0.5" />
        <div>
          <strong>현재 웹페이지 주소가 복사되었습니다!</strong>
          <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            카카오톡, 인스타그램 등의 브라우저에서는 앱 설치 기능이 지원되지 않으므로 Chrome, Safari 등 외부 브라우저로 접속해 주세요.
          </p>
        </div>
      </div>

      <ol className="space-y-3.5 py-1">
        <li className="flex items-start gap-3.5 text-sm leading-relaxed">
          <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
          <span>
            화면 우측 상단 또는 하단의{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              메뉴 <MoreHorizontal className="size-3.5" />
            </span>{" "}
            를 누릅니다.
          </span>
        </li>
        <li className="flex items-start gap-3.5 text-sm leading-relaxed">
          <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
          <span>
            <span className="font-semibold text-foreground">&ldquo;다른 브라우저로 열기&rdquo;</span>(또는 Safari/Chrome으로 열기)를 선택합니다.
          </span>
        </li>
        <li className="flex items-start gap-3.5 text-sm leading-relaxed">
          <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
          <span>
            {lastStep ?? "이동한 기본 브라우저에서 복사된 주소로 접속하면 그대로 이어집니다."}
          </span>
        </li>
      </ol>
      <div className="rounded-lg bg-muted/40 p-2.5 text-sm text-muted-foreground">
        메뉴에 위 항목이 보이지 않는다면, 복사된 주소를 복사하여 스마트폰의 기본 브라우저(Safari 또는 크롬) 주소창에 직접 붙여넣어 접속해 주세요.
      </div>
    </div>
  );
}
