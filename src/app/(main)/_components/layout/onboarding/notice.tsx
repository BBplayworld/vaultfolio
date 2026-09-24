"use client";

import React from "react";
import { Sparkles, IdCard, Share2, MessageSquareText } from "lucide-react";
import { APP_VERSION } from "@/config/app-version";

export const NOTICE_ID = "20260924";
export const NOTICE_TITLE = "투자 유형 인증카드 · 공유 개선 업데이트";
// 홈 "새 공지" 팁 박스용 한 줄 요약(home-tip-box.tsx) — 다이얼로그 본문(FEATURES)과 별개로 짧게 유지.
export const NOTICE_SUMMARY = "인증카드에 내 투자 유형이 추가되고, 카카오톡·PC로 이미지 공유가 쉬워졌어요.";

// 이번 릴리스 핵심 — 아이콘 + 한두 문장으로만. 스크롤 없이 훑히는 분량을 상한으로 둔다.
const FEATURES = [
  {
    icon: IdCard,
    title: "투자 유형 인증카드",
    body: (
      <>
        보유 종목을 분석해 <strong className="text-foreground">나만의 투자 유형(캐릭터·제목·설명·해시태그)</strong>을 만들어 드립니다.
        <strong className="text-foreground">인증카드 &gt; 투자 유형</strong>에서 확인하고 친구에게 공유해 보세요.
      </>
    ),
  },
  {
    icon: Share2,
    title: "이미지 공유가 쉬워졌어요",
    body: (
      <>
        모바일은 <strong className="text-foreground">카카오톡 등으로 이미지가 바로 공유</strong>되고, PC는{" "}
        <strong className="text-foreground">이미지 복사 후 붙여넣기(Ctrl+V)</strong>로 카카오톡 PC에 보낼 수 있습니다.
      </>
    ),
  },
];

export function NoticeContent() {
  return (
    <div className="space-y-4 pointer-events-none select-none">
      {/* 핵심 기능 업데이트 강조 배너 */}
      <div className="rounded-xl bg-primary/5 p-3.5 flex items-start gap-2.5">
        <Sparkles className="size-5 text-primary shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          {/* 버전은 설정 > 정보와 동일한 단일 소스(APP_VERSION) — 공지에 항상 명시한다 */}
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            핵심 기능 업데이트 안내
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary tabular-nums">v{APP_VERSION}</span>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이번 업데이트는 <strong className="text-foreground">나만의 투자 유형을 확인하고 공유</strong>하는 데 집중했습니다. 아래 내용을 확인해 보세요.
          </p>
        </div>
      </div>

      {/* 피처 요약 */}
      <div className="space-y-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl bg-card shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Icon className="size-4 text-primary" />
              </div>
              <h4 className="text-sm font-bold text-foreground">{title}</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pl-1">{body}</p>
          </div>
        ))}
      </div>

      {/* 나머지 개선 — 카드로 세울 만큼 크지 않아 한 문단으로.
          text-pretty 제외: 모바일에서 마지막 줄 균형 맞추기가 줄 길이를 줄여 우측 공백이 생겨, 전폭 greedy 줄바꿈을 우선한다(§2 국소 예외). */}
      <p className="text-sm text-muted-foreground leading-relaxed px-1">
        그 외 포트폴리오 인증카드의 종목 표기를 이름으로 통일하고 도넛 여백·범례를 정리했습니다. 종목 유형(성장/배당/지수 등) 분석은 주식 X-Ray에서 계속 확인할 수 있어요.
      </p>

      {/* 의견 보내기 부탁 배너 */}
      <div className="rounded-xl bg-muted/20 p-3.5 flex items-start gap-2.5">
        <MessageSquareText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">소중한 피드백을 기다립니다</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            더 나은 시크릿에셋 서비스를 위해, 우측 상단 더보기 메뉴의 <span className="font-semibold text-primary">의견 보내기</span>를 활용하여 버그 제보나 의견을 자유롭게 보내주시면 적극 반영하겠습니다!
          </p>
        </div>
      </div>
    </div>
  );
}
