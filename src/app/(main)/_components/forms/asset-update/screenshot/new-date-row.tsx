"use client";

// 스크린샷으로 새로 생기는 종목·코인의 매수일 일괄 입력 줄(#146, 4.77). 맞추기·첫 등록(주식·코인) 공용 — 미리보기 안에서 1회만 보여준다.
// 셸은 `새 해외 종목 매입 환율` 줄과 같다(bg-muted/40 rounded-lg px-3 py-2.5, 테두리 없음). 신규 0개면 호출부가 렌더하지 않는다.
import { InfoHint } from "@/app/(main)/_components/layout/ui/info-hint";
import { Input } from "@/components/ui/input";
import { isValidNewPurchaseDate } from "@/lib/asset/resync/import-inherit";

interface NewDateRowProps {
  /** testId 접두: 맞추기 `resync`, 첫 등록 `import` */
  prefix: "resync" | "import";
  /** 주식만 배당 영향 InfoHint를 보인다(코인은 배당 없음) */
  kind: "stock" | "crypto";
  /** 실제 신규 건수(이어받기·연결 제외) */
  count: number;
  value: string;
  onChange: (v: string) => void;
  /** KST 오늘 — max·오류 판정 */
  today: string;
}

export function NewDateRow({ prefix, kind, count, value, onChange, today }: NewDateRowProps) {
  const title = kind === "stock" ? "새 종목 매수일" : "새 코인 매수일";
  const invalid = !isValidNewPurchaseDate(value, today);
  const errId = `${prefix}-new-date-error`;
  return (
    <div
      data-testid={`${prefix}-new-date`}
      data-screenshot-hide
      className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium break-keep">
          {title}
          {kind === "stock" && (
            <span data-testid={`${prefix}-new-date-hint`} className="ml-1 inline-flex align-middle">
              <InfoHint inModal summary="매수일 이전에 지급된 배당은 성과 › 배당의 올해 지급 예상에서 빠져요">
                <p className="text-pretty break-keep">올해 1월 1일로 두면 올해 배당이 모두 들어가요. 나중에 종목 수정에서 바꿀 수 있어요</p>
              </InfoHint>
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground text-pretty break-keep">
          새로 들어가는 <span className="tabular-nums">{count}</span>개에 모두 적용돼요
        </p>
      </div>
      <div className="min-w-0 sm:w-40">
        <Input
          type="date"
          data-testid={`${prefix}-new-date-input`}
          aria-label={title}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errId : undefined}
          className="h-10 tabular-nums"
          value={value}
          max={today}
          onChange={(e) => onChange(e.target.value)}
        />
        {invalid && (
          <p id={errId} data-testid={errId} role="alert" className="mt-1 text-sm text-destructive text-pretty break-keep">
            오늘이나 그 이전 날짜를 골라 주세요
          </p>
        )}
      </div>
    </div>
  );
}
