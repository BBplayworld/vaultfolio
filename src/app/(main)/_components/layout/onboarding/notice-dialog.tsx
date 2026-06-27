"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getNoticeWindow } from "@/lib/notice-config";
import { STORAGE_KEY_PREFIXES, cleanExpiredNoticeKeys } from "@/lib/local-storage";
import { NOTICE_ID, NOTICE_TITLE, NoticeContent } from "./notice";

export function UpdateNoticeDialog() {
  const [open, setOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const windowConfig = getNoticeWindow();

  useEffect(() => {
    if (!windowConfig) {
      setIsHydrated(true);
      return;
    }
    cleanExpiredNoticeKeys();
    const key = `${STORAGE_KEY_PREFIXES.notice}${NOTICE_ID}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      setOpen(true);
    }
    setIsHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isHydrated || !windowConfig) return null;

  const handleClose = () => {
    const key = `${STORAGE_KEY_PREFIXES.notice}${NOTICE_ID}`;
    localStorage.setItem(
      key,
      JSON.stringify({ seenAt: Date.now(), expiresAt: windowConfig.expiresAt })
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-4 sm:p-6"
      >
        <DialogHeader className="gap-3 text-left">
          <div className="inline-flex items-center gap-2 text-primary">
            <BellRing className="size-5" />
            <span className="text-sm font-semibold">업데이트 공지</span>
          </div>
          <DialogTitle>{NOTICE_TITLE}</DialogTitle>
          <DialogDescription className="sr-only">앱 업데이트 내용</DialogDescription>
        </DialogHeader>

        <NoticeContent />

        <DialogFooter>
          <Button variant="brand" onClick={handleClose} className="w-full sm:w-auto">
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
