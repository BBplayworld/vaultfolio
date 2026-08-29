"use client";

import React from "react";
import { Sparkles, Calculator, Lightbulb, MessageSquareText } from "lucide-react";
import { APP_VERSION } from "@/config/app-version";

export const NOTICE_ID = "20260829";
export const NOTICE_TITLE = "연말 절세 시뮬레이션 · 기능 추천 업데이트";

// 이번 릴리스 핵심 — 아이콘 + 한두 문장으로만. 스크롤 없이 훑히는 분량을 상한으로 둔다.
const FEATURES = [
  {
    icon: Calculator,
    title: "연말 절세 시뮬레이션",
    body: (
      <>
        해외주식을 <strong className="text-foreground">지금 팔면 세금이 얼마인지</strong> 실시간으로 계산합니다.
        손실 종목을 함께 선택하면 <strong className="text-foreground">손익통산으로 얼마나 아끼는지</strong>까지 바로 보여줍니다.
        <strong className="text-foreground">세금 관리 &gt; 절세 시뮬레이션</strong>에서 체크박스로 종목을 골라보세요.
      </>
    ),
  },
  {
    icon: Lightbulb,
    title: "홈 기능 추천 팁",
    body: (
      <>
        새로 나온 기능이나 그동안 안 써본 기능을 <strong className="text-foreground">홈 화면이 알아서 추천</strong>합니다.
        카드를 누르면 바로 그 기능으로 이동합니다.
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
            이번 업데이트는 <strong className="text-foreground">세금까지 챙기는 자산관리</strong>에 집중했습니다. 아래 내용을 확인해 보세요.
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
        그 외 세금 계산을 증권사가 아닌 종목 단위로 정확히 통산하도록 다듬었고, 세금 관리 화면의 원화 표기 오류와 PWA 앱에서 스크롤 버튼이 하단 메뉴에 가려지던 문제도 함께 고쳤습니다.
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
