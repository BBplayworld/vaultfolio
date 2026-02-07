"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { RealEstate, realEstateSchema } from "@/types/asset";
import { useAssetData } from "@/hooks/use-asset-data";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";

const realEstateTypes = [
  { value: "apartment", label: "아파트" },
  { value: "house", label: "주택" },
  { value: "land", label: "토지" },
  { value: "commercial", label: "상가" },
  { value: "other", label: "기타" },
] as const;

// 부동산 가격 빠른 입력 버튼 (천만원, 억 단위)
const realEstateQuickButtons = [
  { label: "1천만", value: 10000000 },
  { label: "5천만", value: 50000000 },
  { label: "1억", value: 100000000 },
  { label: "5억", value: 500000000 },
];

interface RealEstateFormProps {
  editData?: RealEstate;
  onClose: () => void;
}

function RealEstateForm({ editData, onClose }: RealEstateFormProps) {
  const { addRealEstate, updateRealEstate } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Input placeholder="예: 강남 아파트" {...field} />
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
                <Input placeholder="예: 서울시 강남구..." {...field} />
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
                <FormLabel>매입가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentValue"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>현재가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원</FormDescription>
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
                <Input type="date" {...field} />
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
              <CardTitle>부동산 자산</CardTitle>
              <CardDescription>보유하고 있는 부동산 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  부동산 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                <p className="text-muted-foreground text-xs">위의 버튼을 눌러 부동산을 추가하세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {assetData.realEstate.map((item) => {
                const profit = item.currentValue - item.purchasePrice;
                const profitRate = (profit / item.purchasePrice) * 100;
                const holdingDays = calculateHoldingDays(item.purchaseDate);

                return (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            {getTypeLabel(item.type)}
                          </span>
                          <h3 className="font-semibold">{item.name}</h3>
                        </div>
                        {item.address && <p className="text-muted-foreground mb-2 text-sm">{item.address}</p>}
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">매입가:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{formatCurrencyDisplay(item.purchasePrice)}</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">현재가:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{formatCurrencyDisplay(item.currentValue)}</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">평가손익:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {formatCurrencyDisplay(profit)} ({profit > 0 ? "+" : ""}
                              {profitRate.toFixed(2)}%)
                            </span>
                          </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">보유일수:</span>{" "}
                      <span className="font-medium text-right sm:text-left">{holdingDays.toLocaleString()}일</span>
                    </div>
                          {item.tenantDeposit && item.tenantDeposit > 0 && (
                            <div className="flex justify-between gap-2 sm:block">
                              <span className="text-muted-foreground whitespace-nowrap">임차인보증금:</span>{" "}
                              <span className="font-medium text-right text-amber-600 dark:text-amber-400 sm:text-left">{formatCurrencyDisplay(item.tenantDeposit)}</span>
                            </div>
                          )}
                          <div className="col-span-1 flex justify-between gap-2 sm:col-span-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">매입일:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{item.purchaseDate}</span>
                          </div>
                        </div>
                        {item.description && (
                          <p className="text-muted-foreground mt-2 text-sm">{item.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
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
