"use client";

// 입출금·상환 기록 폼의 '맞춘 잔액에 이미 들어간 금액' 경고(spec 14-2). 노드는 유지하고 grid-rows로 펼침(재마운트 없음).
import { AlertCircle } from "lucide-react";
import { ASSET_THEME } from "@/config/theme";
import { linkResyncWarningText, resyncWarningText, type BalanceCategory } from "@/lib/asset/balance-edits";

export function ResyncTxWarning({ category, show, refreshedAtIso, todayKst, id, linkVariant = false }: {
  category: BalanceCategory;
  show: boolean;
  refreshedAtIso: string | null;
  todayKst: string;
  id: string;
  linkVariant?: boolean; // 거래 입력의 연결 계좌 행: 끝맺음을 '연결 안 함으로 바꿔 주세요'로(체크 문구는 입출금 폼 전용)
}) {
  if (!refreshedAtIso) return null; // 맞춘 기록이 없으면 경고 자체가 불가
  return (
    <div className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${show ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden" aria-hidden={!show}>
        <p
          id={id}
          data-testid={show ? `${category}-tx-resync-warning` : undefined}
          className="flex items-start gap-1.5 text-sm break-keep text-pretty"
          style={{ color: ASSET_THEME.importantHex }}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{linkVariant ? linkResyncWarningText(category, refreshedAtIso, todayKst) : resyncWarningText(category, refreshedAtIso, todayKst)}</span>
        </p>
      </div>
    </div>
  );
}
