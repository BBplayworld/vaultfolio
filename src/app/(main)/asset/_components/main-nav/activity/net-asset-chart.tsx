"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Area, AreaChart,
  Bar, BarChart,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LabelList, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatShortCurrencyDecimal, formatCurrency } from "@/lib/number-utils";
import { YearlyNetAsset, yearlyNetAssetSchema, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { STORAGE_KEYS } from "@/lib/asset-storage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME, getProfitLossColor, MAIN_PALETTE } from "@/config/theme";

const NET_COLOR = "#ffffffff";

const CAT_LIST = ASSET_THEME.tabList3 + " mb-4";
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

const chartConfig = {
  netAsset: {
    label: "순자산",
    color: NET_COLOR,
  },
  financialAsset: {
    label: "금융자산",
    color: NET_COLOR,
  },
} as ChartConfig;

const yearlyNetAssetQuickButtons = [
  { label: "1천만", value: 10000000 },
  { label: "5천만", value: 50000000 },
  { label: "1억", value: 100000000 },
  { label: "5억", value: 500000000 },
  { label: "10억", value: 1000000000 },
];

interface YearlyNetAssetFormProps {
  editData?: YearlyNetAsset;
  onClose: () => void;
}

function YearlyNetAssetForm({ editData, onClose }: YearlyNetAssetFormProps) {
  const { addYearlyNetAsset, updateYearlyNetAsset } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<YearlyNetAsset>({
    resolver: zodResolver(yearlyNetAssetSchema),
    defaultValues: editData || {
      year: new Date().getFullYear() - 1,
      netAsset: 0,
      note: "",
    },
  });

  const onSubmit = async (data: YearlyNetAsset) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateYearlyNetAsset(editData.year, data);
        if (success) {
          toast.success("년도별 순자산이 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const success = addYearlyNetAsset(data);
        if (success) {
          toast.success("년도별 순자산이 추가되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      }
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>년도 *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="예: 2023"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                  disabled={!!editData}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="netAsset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>순자산 *</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0"
                  quickButtons={yearlyNetAssetQuickButtons}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>메모</FormLabel>
              <FormControl>
                <Textarea placeholder="추가 메모..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function useDailySnapshots(snapshotVersion: number): DailyAssetSnapshot[] {
  const [snapshots, setSnapshots] = useState<DailyAssetSnapshot[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      if (!raw) return;
      const all: DailyAssetSnapshot[] = JSON.parse(raw);
      const currentMonth = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0].substring(0, 7);
      setSnapshots(
        all.filter(s => s.date.startsWith(currentMonth)).sort((a, b) => a.date.localeCompare(b.date))
      );
    } catch { /* 무시 */ }
  }, [snapshotVersion]);
  return snapshots;
}

function useMonthlySnapshots(snapshotVersion: number): MonthlyAssetSnapshot[] {
  const [snapshots, setSnapshots] = useState<MonthlyAssetSnapshot[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
      if (!raw) return;
      const all: MonthlyAssetSnapshot[] = JSON.parse(raw);
      const currentYear = new Date().getFullYear().toString();
      setSnapshots(
        all.filter(s => s.month.startsWith(currentYear)).sort((a, b) => a.month.localeCompare(b.month))
      );
    } catch { /* 무시 */ }
  }, [snapshotVersion]);
  return snapshots;
}


export function YearlyNetAssetChart() {
  const { assetData, getAssetSummary, deleteYearlyNetAsset, snapshotVersion } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<YearlyNetAsset | undefined>();
  const openAddDialog = useCallback(() => {
    setEditingItem(undefined);
    setIsDialogOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("trigger-add-yearly-net-asset", openAddDialog);
    return () => window.removeEventListener("trigger-add-yearly-net-asset", openAddDialog);
  }, [openAddDialog]);

  const summary = getAssetSummary();
  const dailySnapshots = useDailySnapshots(snapshotVersion);
  const monthlySnapshots = useMonthlySnapshots(snapshotVersion);

  const handleDelete = (year: number) => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      const success = deleteYearlyNetAsset(year);
      if (success) toast.success("년도별 순자산이 삭제되었습니다.");
      else toast.error("삭제에 실패했습니다.");
    }
  };

  const handleEdit = (item: YearlyNetAsset) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  const currentYear = new Date().getFullYear();

  const allYearlyData = [
    ...assetData.yearlyNetAssets,
    { year: currentYear, netAsset: summary.netAsset, note: "현재" },
  ].sort((a, b) => a.year - b.year);
  const last5YearsData = allYearlyData.slice(-5);

  const monthlyData = monthlySnapshots.map(s => ({
    month: `${parseInt(s.month.split("-")[1])}월`,
    netAsset: s.netAsset,
    financialAsset: s.financialAsset,
  }));

  const dailyChartData = dailySnapshots.map(s => ({
    date: s.date.slice(5).replace("-", "/"),
    netAsset: s.netAsset,
    financialAsset: s.financialAsset,
  }));

  const commonAxisProps = {
    tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
    tickLine: false,
    axisLine: false,
  };

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>순자산 변화</CardTitle>
              <CardDescription>순자산 추이 및 올해 월별·일별 변화</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingItem ? "년도별 순자산 수정" : "년도별 순자산 추가"}</DialogTitle>
                  <DialogDescription>
                    {editingItem
                      ? "년도별 순자산 정보를 수정합니다."
                      : "과거 년도의 순자산을 입력하세요. (올해는 자동 계산됩니다)"}
                  </DialogDescription>
                </DialogHeader>
                <YearlyNetAssetForm editData={editingItem} onClose={handleDialogClose} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="yearly">
            <TabsList className={CAT_LIST}>
              <TabsTrigger className={CAT_TRIGGER} value="yearly">년도별</TabsTrigger>
              <TabsTrigger className={CAT_TRIGGER} value="monthly">월별</TabsTrigger>
              <TabsTrigger className={CAT_TRIGGER} value="daily">일별</TabsTrigger>
            </TabsList>

            {/* ── 년도별 탭 ── */}
            <TabsContent value="yearly">
              {last5YearsData.length === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">등록된 년도별 데이터가 없습니다.</p>
                    <p className="text-muted-foreground text-xs">위의 버튼을 눌러 과거 순자산을 추가하세요.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={last5YearsData} margin={{ top: 28, right: 20, bottom: 5, left: 10 }}>
                        <defs>
                          <linearGradient id="gradNetAsset" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={NET_COLOR} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={NET_COLOR} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="year" {...commonAxisProps} />
                        <YAxis
                          {...commonAxisProps}
                          tickFormatter={(v) => formatShortCurrency(v)}
                          width={55}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => formatShortCurrency(value as number)}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="netAsset"
                          strokeWidth={3}
                          fill="url(#gradNetAsset)"
                          stroke={MAIN_PALETTE[0]}
                          dot={{
                            fill: MAIN_PALETTE[0],
                            r: 5,
                            stroke: MAIN_PALETTE[0],
                            strokeWidth: 2,
                          }}
                          activeDot={{
                            fill: MAIN_PALETTE[0],
                            r: 5,
                            stroke: MAIN_PALETTE[0],
                            strokeWidth: 2,
                          }}
                        >
                          <LabelList
                            dataKey="netAsset"
                            position="top"
                            offset={13}
                            formatter={(v: number) => formatShortCurrency(v)}
                            style={{ fill: NET_COLOR, fontSize: 11, fontWeight: 600 }}
                          />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">년도별 순자산</h4>
                    <div className="space-y-2">
                      {allYearlyData.map((item, idx) => {
                        const isCurrentYear = item.year === currentYear;
                        const prev = allYearlyData[idx - 1];
                        const diff = prev ? item.netAsset - prev.netAsset : null;
                        const diffPct = prev && prev.netAsset !== 0
                          ? ((diff! / Math.abs(prev.netAsset)) * 100).toFixed(1)
                          : null;
                        return (
                          <div
                            key={item.year}
                            className={`flex items-center justify-between rounded-lg border p-3 ${isCurrentYear ? "border-primary bg-primary/5" : ""}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-muted-foreground font-semibold">{item.year}년</span>
                                {isCurrentYear && (
                                  <Badge variant="outline" className={ASSET_THEME.categoryBox}>
                                    올해
                                  </Badge>
                                )}
                                {diff !== null && diffPct !== null && (
                                  <span className={`text-xs font-medium ${getProfitLossColor(diff)}`}>
                                    {diff >= 0 ? "+" : ""}{formatShortCurrency(diff)} ({diff >= 0 ? "+" : ""}{diffPct}%)
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm font-bold ${isCurrentYear ? ASSET_THEME.important : ASSET_THEME.text.default}`}>
                                {formatCurrency(item.netAsset)}
                              </p>
                            </div>
                            {!isCurrentYear && (
                              <div className="flex gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                                  <Pencil className="size-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(item.year)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── 월별 탭 (바 차트) ── */}
            <TabsContent value="monthly">
              {monthlyData.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">올해 월별 데이터가 없습니다.</p>
                    <p className="text-muted-foreground text-xs">페이지 접속 시 자동으로 기록됩니다.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 46, right: 10, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis dataKey="month" {...commonAxisProps} />
                        <YAxis
                          {...commonAxisProps}
                          tickFormatter={(v) => formatShortCurrency(v)}
                          width={55}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0]?.payload;
                            const idx = monthlyData.findIndex(d => d.month === row.month);
                            const prev = idx > 0 ? monthlyData[idx - 1] : null;
                            const diff = prev ? row.netAsset - prev.netAsset : null;
                            return (
                              <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1 min-w-[130px]">
                                <p className="font-semibold text-foreground">{row.month}</p>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">순자산</span>
                                  <span className={`font-bold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrencyDecimal(row.netAsset)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">금융자산</span>
                                  <span className={`font-medium tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrencyDecimal(row.financialAsset)}</span>
                                </div>
                                {diff !== null && (
                                  <div className="flex justify-between gap-3 border-t pt-1">
                                    <span className="text-muted-foreground">전월대비</span>
                                    <span className={`font-semibold tabular-nums ${getProfitLossColor(diff)}`}>{diff >= 0 ? "+" : ""}{formatShortCurrency(diff)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="netAsset" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {monthlyData.map((_, idx) => (
                            <Cell key={idx} fill={MAIN_PALETTE[idx % MAIN_PALETTE.length]} />
                          ))}
                          <LabelList
                            dataKey="netAsset"
                            position="top"
                            offset={20}
                            formatter={(v: number) => formatShortCurrencyDecimal(v)}
                            style={{ fill: ASSET_THEME.importantHex, fontSize: 10, fontWeight: 700 }}
                          />
                          <LabelList
                            dataKey="financialAsset"
                            position="top"
                            offset={6}
                            formatter={(v: number) => formatShortCurrencyDecimal(v)}
                            style={{ fill: NET_COLOR, fontSize: 9, fontWeight: 500 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>

                  {/* 전월대비 표 */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-[3rem_1fr_1fr_1fr] gap-x-2 px-3 py-1.5 bg-muted/50 text-[10px] font-medium text-muted-foreground border-b">
                      <span>월</span>
                      <span className="text-right">순자산</span>
                      <span className="text-right">금융자산</span>
                      <span className="text-right">전월대비</span>
                    </div>
                    <div className="divide-y">
                      {monthlyData.map((row, idx, arr) => {
                        const prev = arr[idx - 1];
                        const diff = prev ? row.netAsset - prev.netAsset : null;
                        return (
                          <div key={row.month} className="grid grid-cols-[3rem_1fr_1fr_1fr] gap-x-2 px-3 py-2 items-center">
                            <span className="text-xs font-semibold text-muted-foreground">{row.month}</span>
                            <span className={`text-xs font-bold tabular-nums text-right ${ASSET_THEME.important}`}>{formatShortCurrencyDecimal(row.netAsset)}</span>
                            <span className={`text-xs tabular-nums text-right ${ASSET_THEME.text.default}`}>{formatShortCurrencyDecimal(row.financialAsset)}</span>
                            <span className={`text-xs font-semibold tabular-nums text-right ${diff !== null ? getProfitLossColor(diff) : "text-muted-foreground"}`}>
                              {diff !== null ? `${diff >= 0 ? "+" : ""}${formatShortCurrency(diff)}` : "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── 일별 탭 (7×5 달력 그리드) ── */}
            <TabsContent value="daily">
              {(() => {
                const currentMonthStr = new Date(Date.now() + 9 * 60 * 60 * 1000)
                  .toISOString().split("T")[0].substring(0, 7);
                const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000)
                  .toISOString().split("T")[0].slice(5).replace("-", "/");
                const firstDayOfWeek = new Date(`${currentMonthStr}-01`).getDay();
                const cells = Array.from({ length: 35 }, (_, i) => {
                  const dayNum = i - firstDayOfWeek + 1;
                  if (dayNum < 1 || dayNum > 31) return null;
                  const dateStr = `${currentMonthStr.slice(5)}/${String(dayNum).padStart(2, "0")}`;
                  const found = dailyChartData.find(d => d.date === dateStr);
                  return found ?? { date: dateStr, netAsset: null as unknown as number, financialAsset: null as unknown as number };
                });

                if (dailyChartData.length === 0) {
                  return (
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">올해 일별 데이터가 없습니다.</p>
                        <p className="text-muted-foreground text-xs">페이지 접속 시 자동으로 기록됩니다.</p>
                      </div>
                    </div>
                  );
                }

                const [yearStr, monthStr] = currentMonthStr.split("-");
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">{yearStr}년 {parseInt(monthStr)}월</p>
                    <div className="grid grid-cols-7 gap-1">
                      {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                        <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                      ))}
                      {cells.map((cell, i) => {
                        if (!cell) {
                          return <div key={`empty-${i}`} className="rounded-lg bg-muted/20 h-14 sm:h-24" />;
                        }
                        const hasData = cell.netAsset !== null;
                        const isToday = cell.date === todayStr;
                        const dataIdx = dailyChartData.findIndex(d => d.date === cell.date);
                        const prev = dataIdx > 0 ? dailyChartData[dataIdx - 1] : null;
                        const diff = hasData && prev ? cell.netAsset - prev.netAsset : null;
                        return (
                          <div
                            key={cell.date}
                            className={`rounded-lg border p-1 sm:p-1.5 flex flex-col transition-colors relative h-22 sm:h-24 ${isToday ? "border-primary bg-primary/5" : hasData ? "border-border hover:bg-muted/30" : "border-transparent bg-muted/10"
                              }`}
                          >
                            <p className={`absolute top-1 left-1 text-[11px] sm:text-[13px] font-semibold tabular-nums leading-none ${isToday ? "text-foreground" : "text-muted-foreground"}`}>
                              {parseInt(cell.date.split("/")[1])}
                            </p>
                            {hasData ? (
                              <div className="flex flex-col items-center gap-[3px] sm:gap-[5px] pt-[14px] sm:pt-[18px]">
                                <p className={`text-[9px] sm:text-[13px] font-bold truncate leading-none ${ASSET_THEME.important}`}>
                                  {formatShortCurrencyDecimal(cell.netAsset)}
                                </p>
                                <p className="text-[9px] sm:text-[13px] truncate leading-none text-foreground">
                                  {formatShortCurrencyDecimal(cell.financialAsset)}
                                </p>
                                {diff !== null ? (
                                  <p className={`text-[9px] sm:text-[13px] font-medium leading-none ${getProfitLossColor(diff)}`}>
                                    {diff > 0 ? "+" : ""}{formatShortCurrency(diff)}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      총 {dailyChartData.length}일 기록됨
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
