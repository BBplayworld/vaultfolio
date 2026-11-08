"use client";

// 실물 자산(#58) 등록·수정 폼 — 금·은·귀금속·수집품·기타를 평가액 방식으로 기록한다.
// 골격은 real-estate-input.tsx(Dialog + react-hook-form)를 따르고, 신규 공용 컴포넌트는 만들지 않는다.
// 이벤트: trigger-add-physical(등록) / trigger-edit-physical{id}(수정).

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { countAssets, trackAssetSave } from "@/lib/analytics/ga";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { PhysicalAsset, physicalAssetInputSchema, type PhysicalAssetType } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { physicalAssetTypes, quickButtonPresets } from "@/config/asset-options";

const quickButtons = [...quickButtonPresets.physical];
const HELP = "text-xs text-muted-foreground break-keep text-pretty";

function PhysicalForm({ editData, onClose }: { editData?: PhysicalAsset; onClose: () => void }) {
  const { addPhysicalAsset, updatePhysicalAsset, assetData } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<PhysicalAssetType>(editData?.type ?? "gold");

  const form = useForm<PhysicalAsset>({
    resolver: zodResolver(physicalAssetInputSchema) as never,
    defaultValues: editData ?? {
      id: "", type: "gold", name: "", currentValue: 0, purchasePrice: 0, purchaseDate: new Date().toISOString().split("T")[0], description: "",
    },
  });

  const onSubmit = async (data: PhysicalAsset) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 매입가를 비우면(0) 현재 평가액으로 채워 손익 0 — 상속·증여
      const values = { ...data, purchasePrice: data.purchasePrice > 0 ? data.purchasePrice : data.currentValue };
      if (editData) {
        if (updatePhysicalAsset(editData.id, values)) {
          trackAssetSave({ asset_type: "physical", method: "manual", result: "update" }, countAssets(assetData));
          toast.success("실물 자산을 수정했어요.");
          onClose();
        } else toast.error("저장에 실패했어요.");
      } else {
        if (addPhysicalAsset({ ...values, id: `ph_${Date.now()}` })) {
          trackAssetSave({ asset_type: "physical", method: "manual", result: "create" }, countAssets(assetData));
          toast.success("실물 자산을 저장했어요.");
          onClose();
        } else toast.error("저장에 실패했어요.");
      }
    } catch {
      toast.error("오류가 발생했어요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const placeholder = physicalAssetTypes.find((t) => t.value === selectedType)?.placeholder;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="physical-form">
        {!editData && (
          <p data-testid="physical-double-count-note" className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground break-keep text-pretty">
            현금·부동산에 금을 넣어 두셨다면 그 항목은 지워 주세요.
          </p>
        )}

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>종류</FormLabel>
              <InlineSelector
                size="md"
                value={selectedType}
                onChange={(v) => { field.onChange(v); setSelectedType(v); }}
                options={physicalAssetTypes.map((t) => ({ value: t.value, label: t.shortLabel, testId: `physical-type-${t.value}` }))}
                ariaLabel="실물 자산 종류 선택"
              />
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
                <Input data-testid="physical-name" autoFocus maxLength={30} placeholder={placeholder} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currentValue"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel style={{ color: "var(--accent-teal)" }}>현재 평가액 *</FormLabel>
              <FormControl>
                <NumberInput data-testid="physical-current-value" value={field.value} onChange={field.onChange} placeholder="0" maxLength={15} quickButtons={quickButtons} />
              </FormControl>
              <FormDescription className={HELP}>직접 확인한 시세나 감정가를 입력해 주세요. 자동으로 바뀌지 않아요.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="purchasePrice"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>매입가</FormLabel>
              <FormControl>
                <NumberInput data-testid="physical-purchase-price" value={field.value} onChange={field.onChange} placeholder="0" maxLength={15} quickButtons={quickButtons} />
              </FormControl>
              <FormDescription className={HELP}>비우면 현재 평가액과 같게 기록돼요(손익 0).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="purchaseDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매입일 *</FormLabel>
              <FormControl>
                <Input data-testid="physical-purchase-date" type="date" className="w-full text-sm" {...field} />
              </FormControl>
              <FormDescription className={HELP}>오래전에 사셨다면 실제 구매일을 골라 주세요. 결산에 반영돼요.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>메모</FormLabel>
              <FormControl>
                <Textarea data-testid="physical-description" rows={2} maxLength={100} placeholder="예: 은행 보관, 2023년 돌반지" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" variant="brand" disabled={isSubmitting} data-testid="physical-submit">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : editData ? "수정" : "저장"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function PhysicalInput() {
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PhysicalAsset | undefined>();
  const physical = assetData.physicalAssets;

  useEffect(() => {
    const handler = () => { setEditingItem(undefined); setIsDialogOpen(true); };
    window.addEventListener("trigger-add-physical", handler);
    return () => window.removeEventListener("trigger-add-physical", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const item = (physical ?? []).find((p) => p.id === id);
      if (item) { setEditingItem(item); setIsDialogOpen(true); }
    };
    window.addEventListener("trigger-edit-physical", handler);
    return () => window.removeEventListener("trigger-edit-physical", handler);
  }, [physical]);

  const handleDialogClose = () => { setIsDialogOpen(false); setEditingItem(undefined); };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditingItem(undefined); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0">
        <DialogHeader>
          <DialogTitle>{editingItem ? "실물 자산 수정" : "실물 자산 추가"}</DialogTitle>
          <DialogDescription className="break-keep text-pretty">금, 은, 귀금속처럼 직접 보관하는 자산을 평가액으로 기록해요.</DialogDescription>
        </DialogHeader>
        <PhysicalForm key={editingItem?.id ?? "new"} editData={editingItem} onClose={handleDialogClose} />
      </DialogContent>
    </Dialog>
  );
}
