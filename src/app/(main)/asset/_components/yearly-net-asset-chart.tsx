"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatCurrency } from "@/lib/number-utils";
import { YearlyNetAsset, yearlyNetAssetSchema } from "@/types/asset";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME } from "@/config/theme";

const chartConfig = {
  netAsset: {
    label: "순자산",
    color: "var(--chart-1)",
  },
} as ChartConfig;

// 년도별 순자산 빠른 입력 버튼
const yearlyNetAssetQuickButtons = [
  { label: "1천만", value: 10000000 },
  { label: "5천만", value: 50000000 },
  { label: "1억", value: 100000000 },
  { label: "5억", value: 500000000 },
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
    } catch (error) {
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
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function YearlyNetAssetChart() {
  const { assetData, getAssetSummary, deleteYearlyNetAsset } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<YearlyNetAsset | undefined>();
  const summary = getAssetSummary();

  const handleDelete = (year: number) => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      const success = deleteYearlyNetAsset(year);
      if (success) {
        toast.success("년도별 순자산이 삭제되었습니다.");
      } else {
        toast.error("삭제에 실패했습니다.");
      }
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

  // 현재 년도의 순자산을 자동으로 추가
  const currentYear = new Date().getFullYear();
  const allYearlyData = [
    ...assetData.yearlyNetAssets,
    { year: currentYear, netAsset: summary.netAsset, note: "현재" },
  ].sort((a, b) => a.year - b.year);

  // 최근 5년 데이터만 표시
  const last5YearsData = allYearlyData.slice(-5);

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>년도별 순자산 변화</CardTitle>
              <CardDescription>최근 5년간 순자산 추이 (올해는 자동 계산)</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  과거 순자산 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "년도별 순자산 수정" : "년도별 순자산 추가"}
                  </DialogTitle>
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
          {last5YearsData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">등록된 년도별 데이터가 없습니다.</p>
                <p className="text-muted-foreground text-xs">위의 버튼을 눌러 과거 순자산을 추가하세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 차트 */}
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={last5YearsData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatShortCurrency(value)}
                      className="text-xs"
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatShortCurrency(value as number)}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="netAsset"
                      stroke="var(--color-netAsset)"
                      strokeWidth={3}
                      dot={{ fill: "var(--color-netAsset)", r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* 데이터 리스트 */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">등록된 년도별 데이터</h4>
                <div className="space-y-2">
                  {allYearlyData.map((item) => {
                    const isCurrentYear = item.year === currentYear;
                    return (
                      <div
                        key={item.year}
                        className={`flex items-center justify-between rounded-lg border p-3 ${isCurrentYear ? "border-primary/50 bg-primary/5" : ""
                          }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{item.year}년</span>
                            {isCurrentYear && (
                              <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                현재
                              </span>
                            )}
                          </div>
                          <p className={`text-sm font-bold ${isCurrentYear ? ASSET_THEME.important : ASSET_THEME.primary.text}`}>{formatCurrency(item.netAsset)}</p>
                        </div>
                        {
                          !isCurrentYear && (
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(item.year)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div >
  );
}
