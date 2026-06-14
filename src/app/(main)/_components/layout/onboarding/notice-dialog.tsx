"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getNoticeConfig, type NoticeItem } from "@/lib/notice-config";
import { STORAGE_KEY_PREFIXES, cleanExpiredNoticeKeys } from "@/lib/local-storage";

function NoticeImage({ url, priority }: { url: string; priority?: boolean }) {
  return url.startsWith("/") ? (
    <Image
      src={url}
      alt="업데이트 미리보기"
      width={960}
      height={320}
      className="h-auto w-full rounded-md border bg-background"
      priority={priority}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="업데이트 미리보기"
      className="h-auto w-full rounded-md border bg-background"
    />
  );
}

function NoticeItemCard({ item, imageUrl, isFirstImage }: { item: NoticeItem; imageUrl?: string; isFirstImage: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
      <p className="text-sm font-semibold">{item.headline}</p>
      {item.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      )}
      {imageUrl && (
        <div className="rounded-md overflow-hidden mt-2">
          <NoticeImage url={imageUrl} priority={isFirstImage} />
        </div>
      )}
    </div>
  );
}

export function UpdateNoticeDialog() {
  const [open, setOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});

  const config = getNoticeConfig();

  useEffect(() => {
    if (!config) { setIsHydrated(true); return; }
    cleanExpiredNoticeKeys();
    const key = `${STORAGE_KEY_PREFIXES.notice}${config.id}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      setOpen(true);
      // 이미지 매핑이 필요한 항목이 있을 때만 fetch
      const hasImages = config.items.some((it) => it.image);
      if (hasImages) {
        fetch("/api/notice/images")
          .then((r) => r.json())
          .then((data) => setImageMap(data.images ?? {}))
          .catch(() => {});
      }
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

  let firstImageRendered = false;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-4 sm:p-6">
        <DialogHeader className="gap-3 text-left">
          <div className="inline-flex items-center gap-2 text-primary">
            <BellRing className="size-5" />
            <span className="text-sm font-semibold">업데이트 공지</span>
          </div>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription className="sr-only">앱 업데이트 내용</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {config.items.map((item, i) => {
            const imageUrl = item.image ? imageMap[item.image] : undefined;
            const isFirstImage = !firstImageRendered && !!imageUrl;
            if (isFirstImage) firstImageRendered = true;
            return (
              <NoticeItemCard key={i} item={item} imageUrl={imageUrl} isFirstImage={isFirstImage} />
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="brand" onClick={handleClose} className="w-full sm:w-auto">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
