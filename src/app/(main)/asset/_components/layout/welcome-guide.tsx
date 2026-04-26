"use client";

import React from "react";
import { Building2, TrendingUp, Shield, Sparkles, Activity, ArrowRight, FolderInput, Bitcoin, Wallet, CreditCard, Globe, ImageUp, Pencil, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatShortCurrency } from "@/lib/number-utils";

// ── 예시 데이터 (example-portfolio.json 기준, USD 환율 1,420원)
const USD = 1420;

const PREVIEW_REAL_ESTATE = 400_000_000;

const PREVIEW_STOCKS_FOREIGN =
  150 * 213.49 * USD +   // AAPL
  280 * 183.91 * USD +   // NVDA
  80 * 345.62 * USD +    // TSLA
  55 * 391.85 * USD +    // MSFT
  35 * 560.72 * USD +    // META
  260 * 130.49 * USD +   // PLTR
  55 * 193.61 * USD;     // AMZN

const PREVIEW_STOCKS_PENSION =
  1000 * 25200 +   // ACE S&P500
  700 * 28100 +    // ACE 나스닥100
  100 * 49715;     // KODEX

const PREVIEW_STOCKS_ISA = 200 * 57800; // 삼성전자
const PREVIEW_STOCK_TOTAL = PREVIEW_STOCKS_FOREIGN + PREVIEW_STOCKS_PENSION + PREVIEW_STOCKS_ISA;

const PREVIEW_CRYPTO = 0.03 * 103_012_000 + 1.2 * 4_950_000; // BTC + ETH
const PREVIEW_CASH = 50_000_000 + 200_000_00 + 8_000_000 + 3000 * USD; // 통장+예금+CMA+달러
const PREVIEW_FINANCIAL = PREVIEW_STOCK_TOTAL + PREVIEW_CRYPTO + PREVIEW_CASH;

const PREVIEW_LOAN = 80_000_000 + 15_000_000; // 주담대 + 신용
const PREVIEW_TOTAL_ASSET = PREVIEW_REAL_ESTATE + PREVIEW_FINANCIAL;
const PREVIEW_NET = PREVIEW_TOTAL_ASSET - PREVIEW_LOAN;

// ── 도넛 차트 데이터
const DONUT_ITEMS = [
  { name: "부동산", value: PREVIEW_REAL_ESTATE, color: MAIN_PALETTE[0] },
  { name: "금융자산", value: PREVIEW_FINANCIAL, color: MAIN_PALETTE[3] },
  { name: "부채", value: PREVIEW_LOAN, color: MAIN_PALETTE[1] },
].map((d) => ({ ...d, pct: (d.value / (PREVIEW_TOTAL_ASSET + PREVIEW_LOAN)) * 100 }));

// ── 금융자산 분포 바 항목
const FIN_BAR = [
  { key: "stocks", label: "주식", value: PREVIEW_STOCK_TOTAL, color: MAIN_PALETTE[0] },
  { key: "crypto", label: "암호화폐", value: PREVIEW_CRYPTO, color: MAIN_PALETTE[3] },
  { key: "cash", label: "현금성", value: PREVIEW_CASH, color: MAIN_PALETTE[4] },
];

// ── 해외주식 예시 카드 데이터
const PREVIEW_STOCKS_DETAIL = [
  {
    ticker: "NVDA",
    name: "엔비디아",
    category: "해외주식",
    quantity: 280,
    avgPrice: 74.2,
    currentPrice: 183.91,
    purchaseRate: 1265,
    pct: (280 * 183.91 * USD) / PREVIEW_STOCK_TOTAL * 100,
  },
  {
    ticker: "AAPL",
    name: "애플",
    category: "해외주식",
    quantity: 150,
    avgPrice: 158.4,
    currentPrice: 213.49,
    purchaseRate: 1310,
    pct: (150 * 213.49 * USD) / PREVIEW_STOCK_TOTAL * 100,
  },
];

const RADIAN = Math.PI / 180;

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct, value }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number;
  name: string; pct: number; value: number;
}) {
  if (pct < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
      <tspan x={x} dy="-14" fontSize={10} fontWeight={700} fill="white">{name}</tspan>
      <tspan x={x} dy="15" fontSize={11} fontWeight={700} fill="rgba(255,255,255,1)">{formatShortCurrency(value)}</tspan>
      <tspan x={x} dy="15" fontSize={11} fontWeight={700} fill="rgba(255,255,255,0.7)">{pct.toFixed(1)}%</tspan>
    </text>
  );
}

function SectionBar({ items, total }: { items: { key: string; label: string; value: number; color: string }[]; total: number }) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
              {pct > 10 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-foreground">{label}</span>
              <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">({formatShortCurrency(value)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockIconPreview({ ticker, color }: { ticker: string; color: string }) {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div className="size-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
      {!imgError ? (
        <img
          src={`https://img.logo.dev/ticker/${ticker}?token=pk_I3rhtineRSqYNMtDKQM1zw`}
          alt={ticker}
          className="size-6 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-[10px] font-bold text-white">{ticker.slice(0, 2)}</span>
      )}
    </div>
  );
}

function PreviewStockCard({ stock }: { stock: typeof PREVIEW_STOCKS_DETAIL[0] }) {
  const currentVal = stock.quantity * stock.currentPrice * USD;
  const cost = stock.quantity * stock.avgPrice * stock.purchaseRate;
  const profit = currentVal - cost;
  const profitRate = (profit / cost) * 100;
  const currencyGain = (USD - stock.purchaseRate) * stock.quantity * stock.avgPrice;
  const currencyGainRate = ((USD - stock.purchaseRate) / stock.purchaseRate) * 100;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`flex items-center gap-3 px-3 py-2.5 ${ASSET_THEME.primary.bgLight}`}>
        <StockIconPreview ticker={stock.ticker} color={MAIN_PALETTE[0]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{stock.name}</span>
            <span className="text-[11px] text-muted-foreground font-mono">{stock.ticker}</span>
            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{stock.category}</Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-foreground">{stock.quantity.toLocaleString()}주</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-semibold text-primary">{stock.pct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums text-foreground">{formatShortCurrency(currentVal)}</p>
          <p className={`text-xs mt-0.5 tabular-nums ${getProfitLossColor(profit)}`}>
            {profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))} ({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
          </p>
        </div>
      </div>
      <div className="h-0.5 w-full bg-muted">
        <div className="h-full transition-all" style={{ width: `${Math.min(stock.pct, 100)}%`, backgroundColor: MAIN_PALETTE[0] }} />
      </div>
      <div className="border-t divide-y divide-border/50">
        <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
          <div>
            <p className="text-xs text-muted-foreground">평균단가</p>
            <p className="text-sm font-medium">${stock.avgPrice.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">₩{(stock.avgPrice * USD).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">현재가</p>
            <p className="text-sm font-semibold" style={{ color: MAIN_PALETTE[2] }}>${stock.currentPrice.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">₩{(stock.currentPrice * USD).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/5">
          <div>
            <p className="text-xs text-muted-foreground">환차손익</p>
            <p className={`text-sm font-semibold ${getProfitLossColor(currencyGain)}`}>
              {formatShortCurrency(Math.round(currencyGain))}
              <span className="text-xs ml-1">({currencyGainRate >= 0 ? "+" : ""}{currencyGainRate.toFixed(2)}%)</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">매입환율</p>
            <p className="text-xs text-foreground">$1 = ₩{stock.purchaseRate.toLocaleString()}</p>
          </div>
        </div>
        <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
          <span className="flex items-center gap-1"><Clock className="size-3" /><span className="font-medium text-foreground">약 2년 보유</span></span>
          <span className="flex items-center gap-1"><Calendar className="size-3" /><span className="font-medium text-foreground">2023-01-15 매수</span></span>
        </div>
      </div>
    </div>
  );
}

export function WelcomeGuide() {
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);

  const handleImport = () => {
    window.dispatchEvent(new CustomEvent("trigger-import"));
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 md:p-10 space-y-8">

      {/* 헤로 섹션 */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-primary/40 text-primary px-3 py-1 text-xs font-medium">
          시작하기
        </Badge>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          나만의 비밀 자산 금고
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          로그인 없이, 서버 저장 없이.<br className="hidden sm:block" />
          내 자산은 오직 내 브라우저에만 보관됩니다.
        </p>
      </div>

      {/* 특징 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FeatureCard
          icon={Shield}
          title="영지식(Zero-Knowledge) 이중 암호화"
          desc="자산 데이터는 이 기기에만 저장됩니다. '짧은 공유 URL' 사용 시 서버를 거치더라도, 암호화 열쇠의 절반(URL)과 PIN 번호(4자리)가 완벽히 분리되어 서버 관리자조차 복호화가 100% 불가능한 원천 봉쇄 구조입니다."
        />
        <FeatureCard
          icon={Sparkles}
          title="AI 자산 분석"
          desc="상단 자산 관리 메뉴에서 Grok·Gemini·GPT에 바로 붙여넣을 수 있는 AI 평가용 프롬프트를 생성할 수 있습니다. 데이터 내보내기·가져오기를 지원합니다."
        />
        <FeatureCard
          icon={Activity}
          title="매일 자동 업데이트"
          desc="보유 주식 현재가와 환율(USD·JPY)을 매일 최신 정보로 자동 반영합니다."
        />
      </div>

      {/* 예시 미리보기: PC는 2컬럼, 모바일은 1컬럼 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">포트폴리오 미리보기</p>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 왼쪽: 자산 분포 도넛 + 금융자산 분포 바 */}
          <div className={`rounded-xl ${ASSET_THEME.distributionCard.bg} border border-zinc-500/60 p-5 space-y-5`}>
            {/* 순자산 요약 */}
            <div className={`flex items-center justify-between rounded-lg ${ASSET_THEME.distributionCard.sectionBg} border ${ASSET_THEME.distributionCard.sectionBorder} px-4 py-3`}>
              <div>
                <p className={`text-xs font-semibold ${ASSET_THEME.distributionCard.muted}`}>순자산</p>
                <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(PREVIEW_NET)}</p>
                <p className={`text-[11px] ${ASSET_THEME.text.default}`}>{PREVIEW_NET.toLocaleString("ko-KR")}원</p>
              </div>
              <div className="text-right space-y-1.5">
                <div className="text-xs">
                  <span className={ASSET_THEME.distributionCard.muted}>총 자산 </span>
                  <span className={`font-bold ${ASSET_THEME.primary.text}`}>{formatShortCurrency(PREVIEW_TOTAL_ASSET)}</span>
                </div>
                <div className="text-xs">
                  <span className={ASSET_THEME.distributionCard.muted}>총 부채 </span>
                  <span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(PREVIEW_LOAN)}</span>
                </div>
              </div>
            </div>

            {/* 도넛 차트 */}
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={DONUT_ITEMS}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={115}
                  strokeWidth={2}
                  stroke="var(--card)"
                  labelLine={false}
                  label={({ key, ...props }) => <DonutLabel key={key} {...props} />}
                >
                  {DONUT_ITEMS.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                  <tspan x="50%" dy="-10" fontSize={11} fill="var(--muted-foreground)">순자산</tspan>
                  <tspan x="50%" dy="22" fontSize={15} fontWeight={700} fill="var(--foreground)">{formatShortCurrency(PREVIEW_NET)}</tspan>
                </text>
                <Tooltip
                  formatter={(value: number, _: string, entry: { payload?: { name?: string; pct?: number } }) => [
                    `${formatShortCurrency(value)} (${entry.payload?.pct?.toFixed(1)}%)`,
                    entry.payload?.name ?? "",
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* 범례 */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
              {DONUT_ITEMS.map(({ name, value, color, pct }) => (
                <div key={name} className="flex items-center gap-1.5 min-w-0">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground truncate">{name}</span>
                  <span className="text-xs font-bold text-muted-foreground ml-auto">{pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>

            {/* 금융자산 분포 바 */}
            <div className="space-y-2 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${ASSET_THEME.distributionCard.muted}`}>금융자산 구성</span>
                <span className={`font-bold tabular-nums ${ASSET_THEME.primary.text}`}>{formatShortCurrency(PREVIEW_FINANCIAL)}</span>
              </div>
              <SectionBar items={FIN_BAR} total={PREVIEW_FINANCIAL} />
            </div>
          </div>

          {/* 오른쪽: 해외주식 카드 2개 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold ${ASSET_THEME.distributionCard.muted}`}>해외주식 상세 (예시)</p>
              <p className="text-[10px] text-muted-foreground">환율 $1 = ₩{USD.toLocaleString()}</p>
            </div>
            {/* 종목 비중 바 */}
            <div className="space-y-1.5">
              <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
                {PREVIEW_STOCKS_DETAIL.map((s, i) => (
                  <div
                    key={s.ticker}
                    className="flex items-center justify-center overflow-hidden transition-all"
                    style={{ width: `${s.pct}%`, backgroundColor: i === 0 ? MAIN_PALETTE[0] : MAIN_PALETTE[3] }}
                    title={`${s.name}: ${s.pct.toFixed(1)}%`}
                  >
                    {s.pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5">{s.pct.toFixed(0)}%</span>}
                  </div>
                ))}
                <div className="flex-1 bg-muted/40" title="기타 종목" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
                {PREVIEW_STOCKS_DETAIL.map((s, i) => (
                  <div key={s.ticker} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: i === 0 ? MAIN_PALETTE[0] : MAIN_PALETTE[3] }} />
                    <span className="text-xs text-foreground">{s.name}</span>
                    <span className="text-xs font-bold text-muted-foreground">{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {PREVIEW_STOCKS_DETAIL.map((s) => (
              <PreviewStockCard key={s.ticker} stock={s} />
            ))}
          </div>
        </div>
      </div>
      <p className={`text-[11px] text-center ${ASSET_THEME.distributionCard.muted}`}>
        실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.
      </p>

      {/* CTA 섹션 */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">첫 번째 자산을 추가해보세요</h2>
          <p className="text-sm text-muted-foreground">
            부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button size="lg" className="gap-2" onClick={() => window.dispatchEvent(new CustomEvent("trigger-add-real-estate"))}>
            <Building2 className="size-4" />
            부동산 추가
            <ArrowRight className="size-4" />
          </Button>
          <Popover open={isStockMenuOpen} onOpenChange={setIsStockMenuOpen}>
            <PopoverTrigger asChild>
              <Button size="lg" variant="outline" className="gap-2" style={{ backgroundColor: MAIN_PALETTE[0] }}>
                <TrendingUp className="size-4" />
                주식 추가
                <ArrowRight className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-52 p-1.5 space-y-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setIsStockMenuOpen(false);
                  window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode: "screenshot" } }));
                }}
              >
                <ImageUp className="size-4 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">스크린샷 가져오기</p>
                  <p className="text-xs text-muted-foreground">스크린샷 화면 자동 인식</p>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setIsStockMenuOpen(false);
                  window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode: "manual" } }));
                }}
              >
                <Pencil className="size-4 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">직접 입력</p>
                  <p className="text-xs text-muted-foreground">수동으로 종목 추가</p>
                </div>
              </button>
            </PopoverContent>
          </Popover>
          <Button size="lg" variant="outline" className="gap-2 text-muted-foreground hover:text-foreground" onClick={handleImport}>
            <FolderInput className="size-4" />
            기존 데이터 가져오기
          </Button>
        </div>
      </div>

      {/* For international visitors */}
      <div className="rounded-xl border border-border/40 bg-muted/30 px-5 py-4 flex items-start gap-3">
        <Globe className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/70">For international visitors</span>
          {" — "}
          This app is designed exclusively for the Korean financial ecosystem (KRX).
          It supports Korean stocks (6-digit KRX tickers), KRW-based exchange rates (USD · JPY),
          Korean real estate types, and Korea-specific financial products such as IRP, ISA, and pension accounts.
        </p>
      </div>

    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
