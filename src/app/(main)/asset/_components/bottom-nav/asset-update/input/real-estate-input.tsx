"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
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
          <Button type="submit"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
            disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function RealEstateInput() {
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealEstate | undefined>();

  useEffect(() => {
    const handler = () => { setEditingItem(undefined); setIsDialogOpen(true); };
    window.addEventListener("trigger-add-real-estate", handler);
    return () => window.removeEventListener("trigger-add-real-estate", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const item = assetData.realEstate.find((r) => r.id === id);
      if (item) { setEditingItem(item); setIsDialogOpen(true); }
    };
    window.addEventListener("trigger-edit-real-estate", handler);
    return () => window.removeEventListener("trigger-edit-real-estate", handler);
  }, [assetData.realEstate]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0">
        <DialogHeader>
          <DialogTitle>{editingItem ? "부동산 수정" : "부동산 추가"}</DialogTitle>
          <DialogDescription>
            {editingItem ? "부동산 정보를 수정합니다." : "새로운 부동산 자산을 추가합니다."}
          </DialogDescription>
        </DialogHeader>
        <RealEstateForm editData={editingItem} onClose={handleDialogClose} />
      </DialogContent>
    </Dialog>
  );
}
