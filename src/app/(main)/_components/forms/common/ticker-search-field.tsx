"use client";

// 종목명·종목코드 검색 입력 + 결과 — 검색·드롭다운·키보드(↑↓·Enter·Esc)만 소유한다(#258).
// 선택 결과는 onSelect로 올리고, 시세 조회·토스트는 호출부 몫(주식 추가와 거래 입력의 동작이 달라 공용화하지 않는다).
// resultsMode "popover" = 주식 추가(입력 아래 떠 있는 목록), "inline" = 거래 입력(패널 안 인라인 목록·로딩·0건·오류 문구)
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type Ref } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { nextSearchKey, shouldBlockEnter } from "@/lib/ticker-search-nav";
import type { TickerMarket } from "@/lib/trade/new-stock";

export interface TickerSearchResult {
  ticker: string;
  name: string;
  market?: string;
}

type SearchState = "idle" | "loading" | "results" | "empty" | "error";

interface TickerSearchFieldProps {
  /** 검색 시장. null이면 검색하지 않는다(비상장) */
  market: TickerMarket | null;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (result: TickerSearchResult) => void;
  /** 검색만 끈다(수정 모드) — 입력 자체는 계속 쓸 수 있다 */
  searchDisabled?: boolean;
  /** 값이 바뀌면 검색 상태를 초기화(주식 추가의 카테고리 전환 등, market이 같아도) */
  resetKey?: string;
  resultsMode?: "popover" | "inline";
  inputRef?: Ref<HTMLInputElement>;
  /** name·onBlur·placeholder·maxLength 등 입력 속성(폼 필드 연결용) */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onKeyDown" | "onFocus">;
  /** inline 모드 testId 접두(기본 trade-stock-search) */
  testIdPrefix?: string;
}

const DEBOUNCE_MS = 250;

export function TickerSearchField({
  market,
  value,
  onValueChange,
  onSelect,
  searchDisabled = false,
  resetKey,
  resultsMode = "popover",
  inputRef,
  inputProps,
  testIdPrefix = "trade-stock-search",
}: TickerSearchFieldProps) {
  const inline = resultsMode === "inline";
  const listId = useId();
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [noResult, setNoResult] = useState(false);
  const [state, setState] = useState<SearchState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const runSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (!market || searchDisabled || !q.trim()) {
      setResults([]);
      setShowDropdown(false);
      setNoResult(false);
      setState("idle");
      return;
    }
    if (inline) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setResults([]);
        setState("error");
        return;
      }
      setState("loading");
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(q.trim())}&market=${market}`, { signal: ctrl.signal });
        if (!res.ok) {
          if (inline) { setResults([]); setState("error"); }
          return;
        }
        const data = await res.json();
        const list = (data.results ?? []) as TickerSearchResult[];
        setResults(list);
        setShowDropdown(list.length > 0);
        setNoResult(list.length === 0);
        setActiveIndex(inline && list.length > 0 ? 0 : -1);
        setState(list.length > 0 ? "results" : "empty");
      } catch {
        // 취소(abort)는 무시, 그 밖의 실패는 inline에서만 오류 문구로 알린다
        if (inline && !ctrl.signal.aborted) { setResults([]); setState("error"); }
      }
    }, DEBOUNCE_MS);
  };

  // 시장(또는 resetKey) 변경 시 검색 상태 초기화 — inline은 같은 검색어로 재검색
  useEffect(() => {
    setResults([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    setNoResult(false);
    setState("idle");
    if (inline && value.trim()) runSearch(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, resetKey]);

  // 언마운트 시 대기 중 요청 정리
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  // 바깥 클릭 시 드롭다운 닫기(popover)
  useEffect(() => {
    if (inline || !showDropdown) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [inline, showDropdown]);

  const select = (r: TickerSearchResult) => {
    setShowDropdown(false);
    setResults([]);
    setNoResult(false);
    setState("idle");
    onSelect(r);
  };

  const listOpen = inline ? results.length > 0 : showDropdown && results.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const marketFallback = market === "us" ? "해외" : "국내";

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        {inline && <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
        <Input
          autoComplete="off"
          inputMode="text"
          {...inputProps}
          ref={inputRef}
          value={value}
          data-testid={inline ? `${testIdPrefix}-input` : undefined}
          className={inline ? `pl-9 ${inputProps?.className ?? ""}` : inputProps?.className}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onChange={(e) => {
            onValueChange(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => { if (!inline && results.length > 0) setShowDropdown(true); }}
          onKeyDown={(e) => {
            if (shouldBlockEnter(e.key, listOpen, inline)) { e.preventDefault(); return; }
            if (!listOpen) return;
            const action = nextSearchKey(e.key, activeIndex, results.length);
            if (action.type === "move") {
              e.preventDefault();
              setActiveIndex(action.index);
            } else if (action.type === "select") {
              e.preventDefault();
              select(results[action.index]);
            } else if (action.type === "close" && !inline) {
              // 인라인은 Esc를 가로채지 않는다 — 다이얼로그 닫기에 맡긴다
              setShowDropdown(false);
            }
          }}
        />
      </div>

      {/* popover — 주식 추가(기존 마크업 그대로) */}
      {!inline && noResult && !searchDisabled && market && value.trim() && !showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-popover p-3 text-sm text-muted-foreground shadow-2xl">
          검색 결과가 없습니다. 티커(종목코드)를 직접 입력한 뒤 &lsquo;조회&rsquo;를 눌러주세요.
        </div>
      )}
      {!inline && showDropdown && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md bg-popover p-1 shadow-2xl scrollbar-themed">
          {results.map((r, i) => (
            <li key={`${r.ticker}-${i}`} id={optionId(i)} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(r); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm ${i === activeIndex ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <span className="truncate text-foreground">{r.name}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.ticker}</span>
                  {r.market && <span className="text-2xs text-muted-foreground">{r.market}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* inline — 거래 입력(패널 안 목록·로딩·0건·오류) */}
      {inline && (
        <div className="mt-3 empty:hidden" data-state={state} data-testid={`${testIdPrefix}-results`}>
          {state === "loading" && results.length === 0 && (
            <div aria-busy="true" data-testid={`${testIdPrefix}-loading`} className="space-y-0.5">
              <div className="h-12 rounded-sm bg-muted/70 motion-safe:animate-pulse" />
              <div className="h-12 rounded-sm bg-muted/70 motion-safe:animate-pulse" />
              <div className="h-12 rounded-sm bg-muted/70 opacity-40 motion-safe:animate-pulse" />
            </div>
          )}
          {results.length > 0 && (
            <ul id={listId} role="listbox" aria-busy={state === "loading"} className={`max-h-60 space-y-0.5 overflow-y-auto scrollbar-themed ${state === "loading" ? "opacity-60" : ""}`}>
              {results.map((r, i) => (
                <li key={r.ticker} id={optionId(i)} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-result`}
                    data-ticker={r.ticker}
                    onClick={() => select(r)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex min-h-12 w-full flex-col justify-center rounded-sm px-3 py-1.5 text-left motion-safe:animate-in motion-safe:fade-in duration-150 motion-safe:active:scale-[0.98] ${i === activeIndex ? "bg-muted" : "hover:bg-muted/60"}`}
                  >
                    <span className="block truncate text-sm font-medium text-foreground" title={r.name}>{r.name}</span>
                    <span className="block truncate text-xs tabular-nums text-muted-foreground">{r.ticker} · {r.market || marketFallback}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state === "empty" && (
            <p role="status" data-testid={`${testIdPrefix}-empty`} data-state="empty" className="text-sm text-muted-foreground break-keep text-pretty">
              찾는 종목이 없어요. 이름이나 종목코드를 다시 확인해 주세요.
            </p>
          )}
          {state === "error" && (
            <p role="status" data-testid={`${testIdPrefix}-empty`} data-state="error" className="text-sm text-muted-foreground break-keep text-pretty">
              검색하지 못했어요. 연결을 확인해 주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
