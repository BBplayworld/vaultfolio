"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// 동기화 링크 QR — 다른 기기 카메라로 스캔해 연결(비숙련자용 가장 쉬운 경로).
export function SyncQr({ value, size = 180 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (alive) setDataUrl(url); })
      .catch(() => { if (alive) setDataUrl(null); });
    return () => { alive = false; };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="rounded-lg bg-muted animate-pulse" style={{ width: size, height: size }} />;
  }
  // QR은 흰 배경 고정(스캔 정확도) — 라이트/다크 무관
  return (
    <img
      src={dataUrl}
      alt="동기화 링크 QR"
      width={size}
      height={size}
      className="rounded-lg bg-white p-2"
    />
  );
}
