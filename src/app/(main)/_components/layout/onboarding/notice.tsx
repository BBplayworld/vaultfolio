"use client";

import React from "react";
import { Sparkles, Trophy, RefreshCw, Building2, IdCard, MessageSquareText, Link2 } from "lucide-react";
import { APP_VERSION } from "@/config/app-version";

export const NOTICE_ID = "20260722";
export const NOTICE_TITLE = "자산 성적표 · 실거래가 · 자산 카드 업데이트";

// 이번 릴리스 핵심 4가지 — 아이콘 + 한두 문장으로만. 스크롤 없이 훑히는 분량을 상한으로 둔다.
const FEATURES = [
  {
    icon: Trophy,
    title: "자산 성적표",
    body: (
      <>
        장기 성장·수익의 질·레버리지·분산·투자 습관 <strong className="text-foreground">5개 축을 별점과 트로피 등급으로 채점</strong>합니다.
        넣은 돈이 이자를 내고도 남는지 <strong className="text-foreground">모든 자산 · 실투자금 · 금융투자 레버리지 세 기준으로 한눈에 비교</strong>하도록 재구성했고,
        AI 평가 프롬프트(진단·증식·리스크)도 더 정교해졌습니다. <strong className="text-foreground">성과 탭</strong>에서 확인하세요.
      </>
    ),
  },
  {
    icon: RefreshCw,
    title: "암호화폐 시세 자동 갱신",
    body: (
      <>
        직접 입력해야 했던 코인 현재가가 이제 <strong className="text-foreground">1시간 단위로 자동 갱신</strong>됩니다.
        손대지 않아도 순자산과 수익률이 최신 시세로 계산됩니다.
      </>
    ),
  },
  {
    icon: Building2,
    title: "부동산 실거래가 추정",
    body: (
      <>
        주소만 입력하면 <strong className="text-foreground">국토교통부 실거래 기반 추정 시세</strong>를 내 입력값과 함께 보여줍니다.
        어떤 단지·층·평형의 거래를 근거로 삼았는지와 신뢰도 등급을 함께 표기하며, 근거가 약하면 아예 표시하지 않습니다.
      </>
    ),
  },
  {
    icon: IdCard,
    title: "자산 카드 개편",
    body: (
      <>
        순자산과 수익률이 가장 먼저 보이도록 <strong className="text-foreground">한 장으로 재구성</strong>했습니다.
        포트폴리오 구성 비중과 핵심 자산 Top 8을 담고, 금액은 가린 채로도 공유할 수 있습니다. 상단 카드 아이콘에서 만들어 보세요.
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
            이번 업데이트는 <strong className="text-foreground">내 자산을 평가하고 검증하는 기능</strong>에 집중했습니다. 아래 네 가지를 확인해 보세요.
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

      {/* 행동 요청 — 기존 사용자가 직접 해줘야 계산이 맞아떨어지는 항목이라 기능 카드와 톤을 분리 */}
      <div className="rounded-xl bg-amber-500/10 p-3.5 flex items-start gap-2.5">
        <Link2 className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">확인해 주세요 · 신용대출로 부동산을 사셨다면</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            그 대출에 <strong className="text-foreground">연계 부동산</strong>을 지정해 주세요. 지정하지 않으면 자산 성적표가 그 이자와 잔액을 주식 레버리지로 계산해 수치가 부풀려집니다.
            <strong className="text-foreground"> 성과 → 자산 성적표 → 레버리지 → 계산 근거</strong>에서 대출을 누르면 바로 연결할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 나머지 개선 — 카드로 세울 만큼 크지 않아 한 문단으로.
          text-pretty 제외: 모바일에서 마지막 줄 균형 맞추기가 줄 길이를 줄여 우측 공백이 생겨, 전폭 greedy 줄바꿈을 우선한다(§2 국소 예외). */}
      <p className="text-sm text-muted-foreground leading-relaxed px-1">
        그 외 순자산 변화의 원인을 시세·환율·부채 등 이름으로 더 자세히 보여주고, 홈 헤더의 전일 순자산 대비 증감과 종목별 오늘 등락을 한 줄로 확인할 수 있습니다.
        데이터 백업 날짜 표기와 성과 화면의 지표 기준도 정확하게 다듬었습니다.
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
