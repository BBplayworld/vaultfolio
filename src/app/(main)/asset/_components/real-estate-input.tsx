"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Building2, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Calendar, Clock, MapPin, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RealEstate, realEstateSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { realEstateTypes, quickButtonPresets } from "@/config/asset-options";

const realEstateQuickButtons = [...quickButtonPresets.realEstate];

interface RealEstateFormProps {
  editData?: RealEstate;
  onClose: () => void;
}

function RealEstateForm({ editData, onClose }: RealEstateFormProps) {
  const { addRealEstate, updateRealEstate } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<RealEstate["type"]>(editData?.type || "apartment");

  const getNamePlaceholder = () => {
    if (selectedType === "apartment") return "예: 래미안 퍼스티지 84㎡";
    if (selectedType === "house") return "예: 성북구 단독주택";
    if (selectedType === "land") return "예: 경기도 양평 전원부지";
    if (selectedType === "commercial") return "예: 강남역 근린상가 101호";
    return "예: 기타 부동산";
  };

  const getAddressPlaceholder = () => {
    if (selectedType === "apartment") return "예: 서울시 서초구 반포동 1234";
    if (selectedType === "house") return "예: 서울시 성북구 정릉동 56";
    if (selectedType === "land") return "예: 경기도 양평군 강상면 000번지";
    if (selectedType === "commercial") return "예: 서울시 강남구 역삼동 123-4";
    return "예: 주소 입력";
  };

  const getCurrentValueLabel = () => {
    if (selectedType === "apartment") return "시세 (실거래가)";
    if (selectedType === "land") return "공시지가 / 시세";
    if (selectedType === "commercial") return "시세";
    return "현재 시세";
  };

  const form = useForm<RealEstate>({
    resolver: zodResolver(realEstateSchema),
    defaultValues: editData || {
      id: "",
      type: "apartment",
      name: "",
      address: "",
      purchasePrice: 0,
      currentValue: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
      tenantDeposit: 0,
      description: "",
    },
  });

  const onSubmit = async (data: RealEstate) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateRealEstate(editData.id, data);
        if (success) {
          toast.success("부동산 정보가 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const newData = {
          ...data,
          id: `re_${Date.now()}`,
        };
        const success = addRealEstate(newData);
        if (success) {
          toast.success("부동산이 추가되었습니다.");
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>유형</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedType(value as RealEstate["type"]);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="부동산 유형 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {realEstateTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이름 *</FormLabel>
              <FormControl>
                <Input placeholder={getNamePlaceholder()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주소</FormLabel>
              <FormControl>
                <Input placeholder={getAddressPlaceholder()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={ASSET_THEME.important}>매입가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원 (취득 당시 실거래가)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentValue"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={ASSET_THEME.important}>{getCurrentValueLabel()} *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원 (현재 기준)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="purchaseDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매입일 *</FormLabel>
              <FormControl>
                <Input type="date" className="w-full max-w-[160px] sm:max-w-full text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tenantDeposit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>임차인 보증금</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value || 0}
                  onChange={field.onChange}
                  placeholder="0"
                  quickButtons={realEstateQuickButtons}
                />
              </FormControl>
              <FormDescription>임대를 주는 경우 임차인 보증금 (순자산 계산 시 차감)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Textarea placeholder="추가 정보 입력..." {...field} />
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

export function RealEstateInput() {
  const { assetData, deleteRealEstate } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealEstate | undefined>();

  useEffect(() => {
    const handler = () => { setEditingItem(undefined); setIsDialogOpen(true); };
    window.addEventListener("trigger-add-real-estate", handler);
    return () => window.removeEventListener("trigger-add-real-estate", handler);
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const success = deleteRealEstate(id);
      if (success) {
        toast.success("삭제되었습니다.");
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    }
  };

  const handleEdit = (item: RealEstate) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  const formatCurrencyDisplay = (value: number) => {
    return formatCurrency(value);
  };

  const getTypeLabel = (type: string) => {
    return realEstateTypes.find((t) => t.value === type)?.label || type;
  };

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="size-5" />
                <CardTitle>부동산 자산</CardTitle>
              </div>
              <CardDescription>보유하고 있는 부동산 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  부동산 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "부동산 수정" : "부동산 추가"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "부동산 정보를 수정합니다." : "새로운 부동산 자산을 추가합니다."}
                  </DialogDescription>
                </DialogHeader>
                <RealEstateForm editData={editingItem} onClose={handleDialogClose} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {assetData.realEstate.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">등록된 부동산이 없습니다.</p>
                <p className="text-muted-foreground mt-1 text-xs">'부동산 추가' 버튼을 눌러 추가해 보세요.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {assetData.realEstate.map((item) => {
                const profit = item.currentValue - item.purchasePrice;
                const profitRate = (profit / item.purchasePrice) * 100;
                const holdingDays = calculateHoldingDays(item.purchaseDate);

                return (
                  <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                    {/* Layer 1: 부동산 헤더 */}
                    <div className={`${ASSET_THEME.inputHeader}`}>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={ASSET_THEME.categoryBox}>
                            {getTypeLabel(item.type)}
                          </Badge>
                          <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        </div>
                        {item.address && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <MapPin className="size-3 shrink-0" />
                            {item.address}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => handleEdit(item)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Layer 2: 핵심 지표 */}
                    <div className="flex flex-row items-start justify-between sm:justify-start gap-4 p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">실거래가</span>
                        <span className={`text-medium font-bold ${ASSET_THEME.important}`}>
                          {formatCurrencyDisplay(item.currentValue)}
                        </span>
                        {(item.tenantDeposit || 0) > 0 && (
                          <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900`}>
                            보증금 {formatCurrencyDisplay(item.tenantDeposit || 0)}
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-border self-center">|</span>
                      <div className="flex flex-col items-end sm:items-start gap-1">
                        <span className="text-xs text-muted-foreground">평가손익</span>
                        <span className={`text-medium font-bold ${getProfitLossColor(profit)}`}>
                          {profit >= 0 ? "+" : ""}{formatCurrencyDisplay(profit)}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${getProfitLossColor(profit)}`}>
                          {profit >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {profitRate >= 0 ? "+" : ""}{profitRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Layer 3: 가격 비교 */}
                    <div className="px-4 py-3 bg-muted/10 border-t">
                      <div className="flex items-start sm:items-center justify-between sm:justify-start gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">매입가</span>
                          <span className="text-sm font-medium text-primary">{formatCurrencyDisplay(item.purchasePrice)}</span>
                        </div>
                        <span className="hidden sm:inline text-border self-center">|</span>
                        <div className="flex flex-col gap-0.5 items-end sm:items-start">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            <span className="text-xs font-semibold text-foreground">{holdingDays.toLocaleString()}일 보유</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            <span className="text-xs font-semibold text-foreground">{item.purchaseDate} 매수</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Layer 4: 보조 정보 */}
                    {item.description && (
                      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t bg-muted/5">
                        <span className="w-full mt-0.5 text-primary truncate">
                          # {item.description}
                        </span>
                      </div>
                    )}

                    {/* Layer 5: 연계 주택담보대출 */}
                    {(() => {
                      const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
                      if (linkedLoans.length === 0) return null;
                      return (
                        <div className="px-4 py-2.5 border-t space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground">주택담보대출</p>
                          {linkedLoans.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between text-xs rounded-md bg-rose-500/5 border border-rose-200/30 dark:border-rose-900/30 px-2.5 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CreditCard className="size-3 text-rose-400 flex-shrink-0" />
                                <span className="text-muted-foreground truncate">{loan.name}</span>
                                {loan.institution && (
                                  <span className="hidden sm:inline text-muted-foreground">({loan.institution})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                                  -{formatCurrency(loan.balance)}
                                </span>
                                <span className="text-muted-foreground">{loan.interestRate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
