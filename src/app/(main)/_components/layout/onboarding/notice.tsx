"use client";

import React from "react";
import { Sparkles, Cloud, Smartphone, MessageSquareText } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export const NOTICE_ID = "20260624";
export const NOTICE_TITLE = "핵심 기능 업데이트 & 앱 설치 (PWA)";

export function NoticeContent() {
  const { isStandalone } = usePWAInstall();

  return (
    <div className="space-y-4 pointer-events-none select-none">
      {/* 핵심 기능 업데이트 강조 배너 */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-2.5">
        <Sparkles className="size-5 text-primary shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">핵심 기능 업데이트 안내</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            시크릿에셋의 주요 핵심 기능들이 대폭 보완되고 새로워졌습니다! 아래 새로운 업데이트 항목들을 확인해 보세요.
          </p>
        </div>
      </div>

      {/* 피처 요약 */}
      <div className="space-y-3">
        {/* 1. 클라우드 동기화 */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Cloud className="size-4 text-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-foreground">기기 동기화</h4>
              <span className="rounded bg-amber-500/10 dark:bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-500 border border-amber-500/20">Plus</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-1">
            기존의 1회성 공유 URL과 달리, <strong className="text-foreground">연동된 여러 기기 간에 데이터가 실시간으로 자동 양방향 동기화</strong>됩니다. 금고 암호 기반의 종단간 암호화(E2EE) 기술을 사용하여 서버 관리자를 포함한 그 누구도 자산을 열람할 수 없어 안전합니다. <strong className="text-foreground">복구 링크</strong>를 백업해 두면 기기 분실·초기화 시에도 금고 암호로 자산을 되살릴 수 있습니다.
          </p>
          {/* 접근 가이드 */}
          <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1 border">
            <p className="font-semibold text-foreground text-xs">💡 기기 동기화 설정 방법</p>
            <p className="leading-relaxed">
              • <strong className="text-foreground">모바일</strong>: 하단 탭 바의 <strong className="text-foreground">더보기 ⋯</strong> 터치 → <strong className="text-foreground">자산 공유 · 동기화</strong> 선택
            </p>
            <p className="leading-relaxed">
              • <strong className="text-foreground">PC 웹</strong>: 우측 상단의 <strong className="text-foreground">더보기 ⋯</strong> 클릭 → <strong className="text-foreground">자산 공유 · 동기화</strong> 선택
            </p>
            <p className="leading-relaxed">
              • <strong className="text-foreground">새 기기 연결</strong>: 위 메뉴의 <strong className="text-foreground">기기 동기화</strong>에서 <strong className="text-foreground">복구 링크</strong> 또는 <strong className="text-foreground">동기화 코드</strong>를 새 기기에서 열고 금고 암호 입력
            </p>
          </div>
        </div>

        {/* 2. 앱 설치 (미설치 상태에서만 표시) */}
        {!isStandalone && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Smartphone className="size-4 text-primary" />
              </div>
              <h4 className="text-sm font-bold text-foreground">홈 화면 앱 설치 (PWA)</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-1">
              PWA(프로그레시브 웹앱) 기술을 적용하여 스마트폰 홈 화면에 바로가기 앱을 설치해 보세요. 브라우저 세션 만료나 쿠키 삭제로 인한 자산 데이터 유실 위험 없이 네이티브 앱처럼 안정적으로 사용 가능합니다.
            </p>
            {/* 접근 가이드 */}
            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1 border">
              <p className="font-semibold text-foreground text-xs">💡 앱 설치 및 데이터 복원 방법</p>
              <p className="leading-relaxed">
                • <strong className="text-foreground">설치</strong>: PC / 모바일 웹 접속 시 첫 화면의 <strong className="text-foreground">앱 설치하기</strong> 배너 터치 또는 상단의 설치 아이콘(📥) 터치
              </p>
              <p className="leading-relaxed">
                • <strong className="text-foreground">복원</strong>: 앱 최초 실행 시 첫 화면에 복사된 코드를 붙여넣고 — 기기 동기화 사용 시 <strong className="text-foreground">금고 암호</strong>, 일반 설치 시 <strong className="text-foreground">PIN 4자리</strong> — 를 입력하면 자산이 복원됩니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 의견 보내기 부탁 배너 */}
      <div className="rounded-xl border border-muted bg-muted/20 p-3.5 flex items-start gap-2.5">
        <MessageSquareText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">소중한 피드백을 기다립니다</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            더 나은 시크릿에셋 서비스를 위해, 우측 상단 더보기 메뉴의 <span className="font-semibold text-primary">의견 보내기</span>를 활용하여 버그 제보나 의견을 자유롭게 보내주시면 적극 반영하겠습니다!
          </p>
        </div>
      </div>
    </div>
  );
}
