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
import PREVIEW_IMAGE from "public/images/00.jpg";

const HIDE_UNTIL_KEY = "secretasset-major-ui-notice-hide-until";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function MajorUiUpdateNoticeDialog() {
  const [open, setOpen] = useState(false);
  const [hideForWeek, setHideForWeek] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const rawHideUntil = localStorage.getItem(HIDE_UNTIL_KEY);
    const hideUntil = rawHideUntil ? Number(rawHideUntil) : 0;
    const shouldOpen = !Number.isFinite(hideUntil) || hideUntil <= Date.now();

    setOpen(shouldOpen);
    setIsHydrated(true);
  }, []);

  const handleClose = () => {
    if (hideForWeek) {
      localStorage.setItem(HIDE_UNTIL_KEY, String(Date.now() + ONE_WEEK_MS));
    } else {
      localStorage.removeItem(HIDE_UNTIL_KEY);
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
          <ul className="space-y-1 text-sm text-foreground">
            <li>📢 분포 탭 - 자산, 금융자산, 부동산, 부채 비율 시각화 및 직관적 UI 개선</li>
            <li>📢 상세 탭 - 보유 종목 비중 차트와 상세 수익 현황을 결합한 주식 특화 탭 업데이트</li>
            <li>📢 차트 탭 - 순자산 변화, 기간별 수익, 예상 배당 차트 기능 추가</li>
            <li>✉️ 의견 : <a href="mailto:bbplayworld@gmail.com" className="text-primary underline">bbplayworld@gmail.com</a></li>
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
