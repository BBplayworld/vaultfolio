"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, ImageUp, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MAIN_PALETTE, SHARE_ETC_COLOR } from "@/config/theme";
import { RATIO_PREVIEW_UPLOAD_NOTICE } from "@/config/security-copy";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { useExternalMove } from "@/hooks/use-external-move";
import { allowedUtmQuery } from "@/lib/analytics/utm-allow";
import { track, trackScreen } from "@/lib/analytics/ga";
import { detectBrowserEnv } from "@/lib/pwa/detect-browser";
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";
import { setHandoff } from "@/lib/ratio-preview/handoff";
import { buildRatioList, FALLBACK_JPY, FALLBACK_USD, type RatioResult, type RatioSplitItem } from "@/lib/ratio-preview/ratio-list";
import { RATIO_SAMPLE_RATES, RATIO_SAMPLE_STOCKS } from "@/lib/ratio-preview/ratio-sample";
import { cn } from "@/lib/utils";
import { InAppExternalGuide } from "@/app/(main)/_components/pwa/in-app-external-guide";
import {
  RATIO_ERROR,
  RATIO_INAPP_BOX,
  RATIO_INAPP_LAST_STEP,
  RATIO_INAPP_NOTICE,
  RATIO_NOTES,
  RATIO_SAMPLE,
  deviceLimitMessage,
} from "./ratio-copy";

type Status = "idle" | "loading" | "result" | "sample" | "error";
type ErrorKind = "empty" | "fail" | "limit" | "device";

const NOTICE_BOX = "rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep";
const SPLIT_LABEL = { domestic: "국내", foreign: "해외", other: "기타" } as const;
const WJ = "⁠";

/** 높이 펼침(#4.35 패턴): 노드를 유지한 채 클래스만 토글해 전환을 인터럽터블하게 */
function Unfold({ open, children, className, ...rest }: { open: boolean; children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <div
      className={cn(
        "grid motion-safe:transition-[grid-template-rows,opacity,visibility] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 invisible",
        className,
      )}
      inert={!open}
      {...rest}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function pctText(n: number): string {
  return `${n.toFixed(1)}%`;
}

function splitColors(split: RatioSplitItem[]): Record<RatioSplitItem["kind"], string> {
  const colors: Record<RatioSplitItem["kind"], string> = { domestic: MAIN_PALETTE[0], foreign: MAIN_PALETTE[0], other: SHARE_ETC_COLOR };
  // 큰 쪽 = MAIN_PALETTE[0], 작은 쪽 = MAIN_PALETTE[5] (국내/해외 고정색 없음)
  split
    .filter((g) => g.kind !== "other")
    .sort((a, b) => b.pct - a.pct)
    .forEach((g, i) => {
      colors[g.kind] = i === 0 ? MAIN_PALETTE[0] : MAIN_PALETTE[5];
    });
  return colors;
}

function rowColor(index: number, isEtc: boolean): string {
  if (isEtc) return SHARE_ETC_COLOR;
  return index === 0 ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + ((index - 1) % 6)];
}

async function fetchRates(): Promise<{ USD: number; JPY: number; estimated: boolean }> {
  try {
    const res = await fetch("/api/finance?type=exchange");
    const data = await res.json();
    if (data && !data.error && Number(data.USD) > 0) {
      return { USD: Number(data.USD), JPY: Number(data.JPY) > 0 ? Number(data.JPY) : FALLBACK_JPY, estimated: !(Number(data.JPY) > 0) };
    }
  } catch {
    // 폴백 사용
  }
  return { USD: FALLBACK_USD, JPY: FALLBACK_JPY, estimated: true };
}

/** Unfold가 열리는 첫 프레임엔 visibility가 hidden이라 focus가 거부된다 → 성공할 때까지 프레임마다 재시도(최대 ~30프레임). 취소 함수를 반환 */
function focusWhenVisible(getEl: () => HTMLElement | null): () => void {
  let raf = 0;
  let tries = 0;
  const attempt = () => {
    const el = getEl();
    el?.focus({ preventScroll: true });
    if (el && document.activeElement !== el && tries++ < 30) raf = requestAnimationFrame(attempt);
  };
  raf = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(raf);
}

function smoothBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function RatioPreview() {
  const router = useRouter();
  const geminiUsage = useGeminiUsage();
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const sampleLabelRef = useRef<HTMLParagraphElement>(null);
  const dropzoneRef = useRef<HTMLButtonElement>(null);
  // 예시 진입 직전의 한도 오류(limit·device) — 복귀 시 복원. empty·fail은 복원하지 않는다
  const restoreErrorRef = useRef<{ kind: ErrorKind; text: string } | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [errorText, setErrorText] = useState("");
  const [result, setResult] = useState<RatioResult | null>(null);
  const [fxEstimated, setFxEstimated] = useState(false);
  const [raw, setRaw] = useState<ParsedStock[] | null>(null);
  const [resultMode, setResultMode] = useState<"real" | "sample">("real");
  const [grown, setGrown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [env, setEnv] = useState({ isInApp: false, isIOS: false });

  // 인앱 훅 onTrack: 설치 퍼널 이벤트 대신 이 페이지 전용 이벤트(#60 판독 오염 방지)
  const onInAppTrack = useCallback(() => track("feature_use", { category: "ratio_preview", method: "open" }), []);
  const { go, iosFallback } = useExternalMove(env.isIOS, onInAppTrack);

  useEffect(() => {
    trackScreen("ratio");
    const e = detectBrowserEnv();
    setEnv({ isInApp: e.isInApp, isIOS: e.platform === "ios" });
  }, []);

  // 결과 진입: 막대 fill을 다음 프레임에 펼친다(reduced-motion은 transition이 없어 즉시 최종값)
  useEffect(() => {
    if (status !== "result" && status !== "sample") {
      setGrown(false);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    // 예시는 결과 맨 위 표시를, 실제 결과는 요약 제목을 포커스 대상으로 삼는다
    const target = status === "sample" ? sampleLabelRef.current : resultRef.current;
    target?.scrollIntoView({ block: "start", behavior: smoothBehavior() });
    const cancelFocus = focusWhenVisible(() => (status === "sample" ? sampleLabelRef.current : resultRef.current));
    return () => {
      cancelAnimationFrame(id);
      cancelFocus();
    };
  }, [status, result]);

  const fail = (kind: ErrorKind, text: string, gaResult?: "fail" | "empty" | "limit") => {
    setErrorKind(kind);
    setErrorText(text);
    setStatus("error");
    if (gaResult) track("feature_use", { category: "ratio_preview", method: "submit", result: gaResult });
  };

  const handleFile = async (file: File) => {
    if (status === "loading") return;
    if (!geminiUsage.canUse()) {
      fail("device", deviceLimitMessage(geminiUsage.limit));
      return;
    }
    setErrorKind(null);
    setStatus("loading");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("assetType", "stock");
      form.append("entry", "ratio");
      const [res, rates] = await Promise.all([fetch("/api/parse-screenshot", { method: "POST", body: form }), fetchRates()]);
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) return fail("limit", RATIO_ERROR.limit, "limit");
      if (!res.ok) return fail("fail", typeof data?.error === "string" ? data.error : RATIO_ERROR.fail, "fail");
      const stocks = (data.stocks ?? []) as ParsedStock[];
      if (stocks.length === 0) return fail("empty", RATIO_ERROR.empty, "empty");
      geminiUsage.increment("stock");
      const built = buildRatioList(stocks, rates);
      if (built.allZero) return fail("empty", RATIO_ERROR.emptyPrice, "empty");
      setRaw(stocks);
      setResult(built);
      setResultMode("real");
      setFxEstimated(rates.estimated && stocks.some((s) => s.section === "해외"));
      setStatus("result");
      track("feature_use", { category: "ratio_preview", method: "submit", result: "success" });
    } catch {
      fail("fail", RATIO_ERROR.network, "fail");
    }
  };

  // 예시 보기: 고정 데이터로 로컬 계산만 한다(서버 호출·한도 소모·인계 저장 없음)
  const handleSample = () => {
    if (status === "loading" || status === "sample") return;
    restoreErrorRef.current = status === "error" && errorKind && (errorKind === "limit" || errorKind === "device") ? { kind: errorKind, text: errorText } : null;
    setErrorKind(null);
    setRaw(null);
    setResult(buildRatioList(RATIO_SAMPLE_STOCKS, RATIO_SAMPLE_RATES));
    setFxEstimated(false);
    setResultMode("sample");
    setStatus("sample");
    track("feature_use", { category: "ratio_preview", method: "sample" });
  };

  // 예시 → 업로드 화면 복귀: 파일 선택창은 열지 않고 dropzone에 포커스만 둔다
  const handleSampleExit = () => {
    const restore = restoreErrorRef.current;
    restoreErrorRef.current = null;
    if (restore) {
      setErrorKind(restore.kind);
      setErrorText(restore.text);
      setStatus("error");
    } else {
      setStatus("idle");
    }
    focusWhenVisible(() => dropzoneRef.current);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: smoothBehavior() }));
  };

  const handleSave = () => {
    if (!raw || saving) return;
    track("feature_use", { category: "ratio_preview", method: "click" });
    setSaving(true);
    setHandoff(raw);
    router.push("/");
  };

  const handleInApp = () => {
    // 인계는 새 브라우저로 넘어가지 않는다 → /ratio로 열고 UTM만 유지
    const url = `${window.location.origin}/ratio${allowedUtmQuery(window.location.pathname, window.location.search)}`;
    void go(url);
  };

  const blocked = errorKind === "limit" || errorKind === "device";
  const loading = status === "loading";
  const isSample = resultMode === "sample";
  const showResult = (status === "result" || status === "sample") && result !== null;
  const dropzoneOpen = !showResult;
  const colors = result ? splitColors(result.split) : null;

  return (
    <div className="flex flex-col break-keep" data-testid="ratio-page-body">
      <input
        ref={fileRef}
        data-testid="ratio-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
      />

      <Unfold open={dropzoneOpen}>
        <div className="flex flex-col gap-3 pb-5">
          <button
            type="button"
            ref={dropzoneRef}
            data-testid="ratio-dropzone"
            disabled={loading || blocked}
            aria-disabled={loading || blocked}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-brand/30 bg-brand/5 p-6 text-center",
              "motion-safe:transition-colors active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none",
              "[@media(hover:hover)]:hover:border-brand/60 [@media(hover:hover)]:hover:bg-brand/10",
              (loading || blocked) && "cursor-not-allowed opacity-50",
            )}
          >
            {loading ? (
              <>
                <Spinner className="size-5 text-brand motion-safe:animate-spin" />
                <span className="text-sm font-semibold">종목을 읽고 있어요</span>
                <span className="text-[11px] text-muted-foreground">잠시만 기다려 주세요</span>
              </>
            ) : (
              <>
                <span className="flex size-10 items-center justify-center rounded-md bg-brand/15 text-brand">
                  <ImageUp className="size-5" />
                </span>
                <span className="text-sm font-semibold">보유 종목 캡처 올리기</span>
                <span className="text-[11px] text-muted-foreground break-keep">
                  <span className="whitespace-nowrap">{`JPG${WJ}·${WJ}PNG${WJ}·${WJ}WEBP${WJ}·${WJ}HEIC`}</span>, 10MB 이하
                </span>
              </>
            )}
          </button>
          <p data-testid="ratio-notice" className={NOTICE_BOX}>
            {RATIO_PREVIEW_UPLOAD_NOTICE}
          </p>
          <Button data-testid="ratio-sample-btn" variant="secondary" className="h-11 w-full text-sm font-medium break-keep" disabled={loading} onClick={handleSample}>
            {RATIO_SAMPLE.button}
          </Button>
        </div>
      </Unfold>

      <div aria-live="polite">
        {status === "error" && errorKind && (
          <div
            data-testid="ratio-error"
            data-kind={errorKind}
            role="alert"
            className={cn(
              "mb-5 flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-relaxed text-pretty break-keep motion-safe:animate-in motion-safe:fade-in duration-150",
              errorKind === "empty" ? "bg-muted/50 text-muted-foreground" : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            )}
          >
            {errorKind === "empty" ? <Info className="mt-0.5 size-4 shrink-0 text-sky-500" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
            <span>{errorText}</span>
          </div>
        )}

        <Unfold open={loading} data-testid="ratio-loading">
          <div className="flex flex-col gap-3 pb-5" aria-hidden>
            <Skeleton className="h-28 w-full rounded-lg" />
            <div className="flex flex-col gap-2 rounded-lg bg-card p-4 shadow-xs">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </div>
        </Unfold>
      </div>

      <Unfold open={showResult} data-testid="ratio-result" data-mode={resultMode}>
        {result && colors && (
          <div className="flex flex-col gap-5 pb-1">
            {isSample && (
              <p
                ref={sampleLabelRef}
                tabIndex={-1}
                role="note"
                data-testid="ratio-sample-label"
                className={cn(NOTICE_BOX, "flex items-start gap-2 outline-none")}
              >
                <Info aria-hidden className="mt-1 size-3.5 shrink-0 text-sky-600/70 dark:text-sky-400/70" />
                <span>{RATIO_SAMPLE.label}</span>
              </p>
            )}
            {/* 요약: 종목 수 + 국내/해외 비율 */}
            <section className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
              <h2 ref={resultRef} tabIndex={-1} className="flex items-baseline gap-1 outline-none" data-testid="ratio-count">
                <span className="text-sm font-medium text-muted-foreground">총</span>
                <span className="text-2xl font-bold tabular-nums">{result.totalCount}</span>
                <span className="text-sm font-medium text-muted-foreground">종목</span>
              </h2>
              <p className="text-sm font-semibold">
                <span className="whitespace-nowrap">국내/해외</span> 비율
              </p>
              <div
                data-testid="ratio-split-bar"
                role="img"
                aria-label={result.split.map((g) => `${SPLIT_LABEL[g.kind]} ${pctText(g.pct)}`).join(", ")}
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
              >
                {result.split.map((g) => (
                  <div key={g.kind} data-testid={`ratio-split-${g.kind}`} className="h-full" style={{ width: `${g.pct}%`, backgroundColor: colors[g.kind] }} />
                ))}
              </div>
              <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1">
                {result.split.map((g) => (
                  <li key={g.kind} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: colors[g.kind] }} />
                    <span className="text-sm font-semibold tabular-nums">{`${SPLIT_LABEL[g.kind]} ${pctText(g.pct)}`}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{`${g.count}종목`}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 종목별 비중 */}
            <section className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
              <p className="text-sm font-semibold">종목별 비중</p>
              <ul role="list" data-testid="ratio-list" className="divide-y divide-border/40">
                {result.rows.map((r, i) => (
                  <li
                    key={r.key}
                    data-testid={r.isEtc ? "ratio-row-etc" : `ratio-row-${i}`}
                    className="min-h-11 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={r.name}>
                        {r.name}
                      </span>
                      {r.ticker && <span className="hidden shrink-0 text-[11px] text-muted-foreground min-[360px]:inline">{r.ticker}</span>}
                      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">{pctText(r.pct)}</span>
                    </div>
                    <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full origin-left rounded-full motion-safe:transition-[scale] duration-500 ease-out motion-reduce:transition-none",
                          grown ? "scale-x-100" : "scale-x-0",
                        )}
                        style={{ width: `${Math.max(r.pct, 2)}%`, backgroundColor: rowColor(i, r.isEtc) }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {!isSample && (result.zeroPriceCount > 0 || fxEstimated) && (
                <div className="flex flex-col gap-1 border-t border-border/40 pt-3 text-sm text-muted-foreground text-pretty break-keep">
                  {result.zeroPriceCount > 0 && <p data-testid="ratio-zero-price-note">{RATIO_NOTES.zeroPrice(result.zeroPriceCount)}</p>}
                  {fxEstimated && <p data-testid="ratio-fx-note">{RATIO_NOTES.fx}</p>}
                </div>
              )}
            </section>

            {/* 액션 */}
            {isSample ? (
              <div className="flex flex-col gap-2">
                <Button data-testid="ratio-sample-cta" variant="brand" className="h-11 w-full text-sm font-semibold break-keep" onClick={handleSampleExit}>
                  {RATIO_SAMPLE.cta}
                </Button>
                <p className="text-center text-sm text-muted-foreground text-pretty break-keep">{RATIO_SAMPLE.caption}</p>
              </div>
            ) : (
            <div className="flex flex-col gap-2">
              {env.isInApp ? (
                <>
                  <p className={NOTICE_BOX}>{RATIO_INAPP_BOX}</p>
                  <Button data-testid="ratio-inapp-btn" variant="brand" className="h-11 w-full text-sm font-semibold break-keep" onClick={handleInApp}>
                    <ExternalLink className="size-4" />
                    브라우저에서 열어 저장하기
                  </Button>
                  <Unfold open={iosFallback} data-testid="ratio-inapp-guide">
                    <div className="break-keep">
                      <InAppExternalGuide notice={RATIO_INAPP_NOTICE} lastStep={RATIO_INAPP_LAST_STEP} />
                    </div>
                  </Unfold>
                </>
              ) : (
                <Button data-testid="ratio-save-btn" variant="brand" className="min-h-11 w-full text-sm font-semibold break-keep" disabled={saving} onClick={handleSave}>
                  내 기기에 저장하고 계속 관리
                </Button>
              )}
              <Button
                data-testid="ratio-retry-btn"
                variant="secondary"
                className="h-11 w-full text-sm"
                disabled={loading || saving}
                onClick={() => fileRef.current?.click()}
              >
                다른 사진으로 다시 보기
              </Button>
              <p className="text-center text-sm text-muted-foreground text-pretty break-keep">{RATIO_NOTES.saveCaption}</p>
            </div>
            )}
          </div>
        )}
      </Unfold>
    </div>
  );
}
