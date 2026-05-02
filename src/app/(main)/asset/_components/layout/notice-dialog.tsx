"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STORAGE_KEYS } from "@/lib/local-storage";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function MajorUiUpdateNoticeDialog() {
  const [open, setOpen] = useState(false);
  const [hideForWeek, setHideForWeek] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const rawHideUntil = localStorage.getItem(STORAGE_KEYS.noticeHideUntil);
    const hideUntil = rawHideUntil ? Number(rawHideUntil) : 0;
    const shouldOpen = !Number.isFinite(hideUntil) || hideUntil <= Date.now();

    setOpen(shouldOpen);
    setIsHydrated(true);
  }, []);

  const handleClose = () => {
    if (hideForWeek) {
      localStorage.setItem(STORAGE_KEYS.noticeHideUntil, String(Date.now() + ONE_WEEK_MS));
    } else {
      localStorage.removeItem(STORAGE_KEYS.noticeHideUntil);
    }

    setOpen(false);
  };

  if (!isHydrated) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-md w-[calc(100%-1.5rem)] sm:w-full p-4 sm:p-6">
        <DialogHeader className="gap-3">
          <div className="inline-flex items-center gap-2 text-primary">
            <BellRing className="size-5" />
            <span className="text-sm font-semibold">업데이트 공지</span>
          </div>
          <DialogTitle>대대적인 UI 업데이트를 준비 중입니다</DialogTitle>
          <DialogDescription className="leading-relaxed">
            더 직관적인 화면 구성과 입력 흐름 개선을 포함한 UI 개편을 진행하고 있습니다.
            곧 더 편한 사용 경험으로 찾아오겠습니다.
          </DialogDescription>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 1.8 }}>
            <li style={{ marginBottom: 6 }}>
              <span style={{ marginRight: 6 }}>🏠</span>
              <strong>홈 탭</strong> - 자산·금융·부동산·부채 비율 도넛 차트 및 비중 UI 고도화
            </li>

            <li style={{ marginBottom: 6 }}>
              <span style={{ marginRight: 6 }}>📈</span>
              <strong>상세 탭</strong> - 종목 비중과 수익 현황을 통합한 '주식 특화 탭' 업데이트
            </li>

            <li style={{ marginBottom: 6 }}>
              <span style={{ marginRight: 6 }}>📊</span>
              <strong>성과 탭</strong> - 순자산 추이, 기간별 수익, 예상 배당 차트 기능 신규 도입
            </li>

            <li style={{ marginBottom: 6 }}>
              <span style={{ marginRight: 6 }}>📸</span>
              <strong>인증샷</strong> - 자산 현황 및 손익 요약 이미지 복사·공유 기능 추가
            </li>

            <hr style={{ border: 0, borderTop: "1px dashed #ccc", margin: "12px 0" }} />
            <li style={{ color: "#555" }}>
              <span style={{ marginRight: 8 }}>📅</span>
              <strong>업데이트 예정일:</strong> 2026년 5월 초
            </li>
          </ul>
        </DialogHeader>

        <div className="rounded-md border bg-muted/20 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            예정 업데이트 화면
          </p>
          <Image
            src="/images/00.jpg"
            alt="예정 업데이트 화면"
            width={960}
            height={320}
            className="h-auto w-full rounded-md border bg-background"
            priority
          />
        </div>

        <label className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <Checkbox
            id="hide-major-ui-update-for-week"
            checked={hideForWeek}
            onCheckedChange={(checked) => setHideForWeek(checked === true)}
          />
          <span className="text-sm text-muted-foreground">일주일간 보지 않기</span>
        </label>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
