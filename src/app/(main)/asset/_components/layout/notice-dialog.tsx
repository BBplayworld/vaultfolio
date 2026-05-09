"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getNoticeConfig } from "@/lib/notice-config";
import { STORAGE_KEY_PREFIXES, cleanExpiredNoticeKeys } from "@/lib/local-storage";

export function UpdateNoticeDialog() {
  const [open, setOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const config = getNoticeConfig();

  useEffect(() => {
    if (!config) { setIsHydrated(true); return; }
    cleanExpiredNoticeKeys();
    const key = `${STORAGE_KEY_PREFIXES.notice}${config.id}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      setOpen(true);
      fetch("/api/notice/images")
        .then((r) => r.json())
        .then((data) => setImageUrls(data.urls ?? []))
        .catch(() => {});
    }
    setIsHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isHydrated || !config) return null;

  const handleClose = () => {
    const key = `${STORAGE_KEY_PREFIXES.notice}${config.id}`;
    localStorage.setItem(key, JSON.stringify({ seenAt: Date.now(), expiresAt: config.expiresAt }));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-md w-[calc(100%-1.5rem)] sm:w-full p-4 sm:p-6">
        <DialogHeader className="gap-3">
          <div className="inline-flex items-center gap-2 text-primary">
            <BellRing className="size-5" />
            <span className="text-sm font-semibold">업데이트 공지</span>
          </div>
          <DialogTitle>{config.title}</DialogTitle>
          {config.body && (
            <DialogDescription asChild>
              <ul className="space-y-1 list-disc list-inside">
                {config.body.split("#").filter(Boolean).map((line, i) => (
                  <li key={i} className="leading-relaxed">{line.trim()}</li>
                ))}
              </ul>
            </DialogDescription>
          )}
        </DialogHeader>

        {imageUrls.length > 0 && (
          <div className="space-y-2">
            {imageUrls.map((url, i) => (
              <div key={i} className="rounded-md border bg-muted/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">업데이트 미리보기</p>
                {url.startsWith("/") ? (
                  <Image
                    src={url}
                    alt="업데이트 미리보기"
                    width={960}
                    height={320}
                    className="h-auto w-full rounded-md border bg-background"
                    priority={i === 0}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt="업데이트 미리보기"
                    className="h-auto w-full rounded-md border bg-background"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
