"use client";

import React from "react";
import { Sparkles, IdCard, ScanSearch, MessageSquareText } from "lucide-react";
import { APP_VERSION } from "@/config/app-version";

export const NOTICE_ID = "20260905";
export const NOTICE_TITLE = "포트폴리오 인증카드 · 종목 유형 분석 업데이트";
// 홈 "새 공지" 팁 박스용 한 줄 요약(home-tip-box.tsx) — 다이얼로그 본문(FEATURES)과 별개로 짧게 유지.
export const NOTICE_SUMMARY = "포트폴리오 인증카드가 원형 차트+로고로 강화되고, 종목 유형(성장/배당/지수 등) 분석이 추가됐어요.";

// 이번 릴리스 핵심 — 아이콘 + 한두 문장으로만. 스크롤 없이 훑히는 분량을 상한으로 둔다.
const FEATURES = [
  {
    icon: IdCard,
    title: "포트폴리오 인증카드 강화",
    body: (
      <>
        보유 종목 구성을 <strong className="text-foreground">원형 차트 + 종목 로고</strong>로 한눈에 보여주고,
        아래에 <strong className="text-foreground">분야 구성·보유 유형(계좌) 구성</strong> 막대바까지 함께 담았습니다.
        <strong className="text-foreground">인증카드 &gt; 포트폴리오</strong>에서 확인해 보세요.
      </>
    ),
  },
  {
    icon: ScanSearch,
    title: "종목 유형 분석(X-Ray)",
    body: (
      <>
        보유 종목이 <strong className="text-foreground">성장주·배당주·지수투자·가치주</strong> 중 어떤 성격인지
        자동으로 분류해 비중을 보여줍니다. <strong className="text-foreground">주식 X-Ray</strong>에서 새 탭으로 확인하세요.
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
            이번 업데이트는 <strong className="text-foreground">포트폴리오를 더 보기 좋게 공유하고 분석</strong>하는 데 집중했습니다. 아래 내용을 확인해 보세요.
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
        그 외 인증카드 “보유 유형 구성”에서 IRP·연금저축펀드를 하나로 합쳐 보여주도록 다듬었고, 국내 ETF 로고가 흰 배경으로 어색하게 뜨던 문제도 함께 고쳤습니다.
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
