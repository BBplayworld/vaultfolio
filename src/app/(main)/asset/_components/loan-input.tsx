"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
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
import { Loan, loanSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";

const loanTypes = [
  { value: "credit", label: "신용대출" },
  { value: "minus", label: "마이너스대출" },
  { value: "mortgage-home", label: "주택담보대출" },
  { value: "mortgage-stock", label: "주식담보대출" },
  { value: "mortgage-insurance", label: "보험담보대출" },
  { value: "mortgage-deposit", label: "예금담보대출" },
  { value: "mortgage-other", label: "기타담보대출" },
] as const;

// 대출 종류별 빠른 입력 버튼
const getQuickButtonsByType = (type: string) => {
  if (type === "mortgage-home") {
    return [
      { label: "500만", value: 5000000 },
      { label: "1000만", value: 10000000 },
      { label: "5000만", value: 50000000 },
      { label: "1억", value: 100000000 },
    ];
  }
  return [
    { label: "100만", value: 1000000 },
    { label: "500만", value: 5000000 },
    { label: "1000만", value: 10000000 },
    { label: "5000만", value: 50000000 },
  ];
};

interface LoanFormProps {
  editData?: Loan;
  onClose: () => void;
}

function LoanForm({ editData, onClose }: LoanFormProps) {
  const { addLoan, updateLoan } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<Loan["type"]>(editData?.type || "credit");

  const form = useForm<Loan>({
    resolver: zodResolver(loanSchema),
    defaultValues: editData || {
      id: "",
      type: "credit",
      name: "",
      balance: 0,
      interestRate: 0,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      institution: "",
      description: "",
    },
  });

  const onSubmit = async (data: Loan) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateLoan(editData.id, data);
        if (success) {
          toast.success("대출 정보가 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const newData = {
          ...data,
          id: `loan_${Date.now()}`,
        };
        const success = addLoan(newData);
        if (success) {
          toast.success("대출이 추가되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      }
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
              <FormLabel>대출 종류</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedType(value as Loan["type"]);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="대출 종류 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {loanTypes.map((type) => (
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
              <FormLabel>대출명 *</FormLabel>
              <FormControl>
                <Input placeholder="예: OO은행 주택담보대출" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="institution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>금융기관</FormLabel>
              <FormControl>
                <Input placeholder="예: 국민은행" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>현재 잔액 *</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0"
                  quickButtons={getQuickButtonsByType(selectedType)}
                />
              </FormControl>
              <FormDescription>원</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="interestRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>금리 *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="3.5"
                  value={field.value || ""}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>% (연이율)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대출일 *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>만기일</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

export function LoanInput() {
  const { assetData, deleteLoan } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Loan | undefined>();

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const success = deleteLoan(id);
      if (success) {
        toast.success("삭제되었습니다.");
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    }
  };

  const handleEdit = (item: Loan) => {
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
    return loanTypes.find((t) => t.value === type)?.label || type;
  };

  return (
    <div className="*:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CreditCard className="size-5" />
                <CardTitle>대출 관리</CardTitle>
              </div>
              <CardDescription>신용대출, 담보대출 등 대출 정보를 관리합니다</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  대출 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto touch-pan-y">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "대출 수정" : "대출 추가"}</DialogTitle>
                  <DialogDescription>대출 정보를 입력하세요.</DialogDescription>
                </DialogHeader>
                <LoanForm editData={editingItem} onClose={handleDialogClose} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {assetData.loans.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <CreditCard className="text-muted-foreground mx-auto mb-2 size-8" />
                <p className="text-muted-foreground text-sm">등록된 대출이 없습니다.</p>
                <p className="text-muted-foreground mt-1 text-xs">대출 추가 버튼을 눌러 시작하세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {assetData.loans.map((item) => {
                const daysElapsed = calculateHoldingDays(item.startDate);
                const daysRemaining = item.endDate ? calculateHoldingDays(item.endDate) : null;

                return (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3">
                      {/* 제목과 버튼 영역 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <span className="rounded bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                            {getTypeLabel(item.type)}
                          </span>
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.institution && (
                            <span className="text-muted-foreground text-xs">({item.institution})</span>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 내용 영역 */}
                      <div className="w-full">
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">현재 잔액:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${ASSET_THEME.liability.strong}`}>
                              {formatCurrencyDisplay(item.balance)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">금리:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${ASSET_THEME.primary.text}`}>{item.interestRate}%</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">대출일:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{item.startDate}</span>
                            <span className="text-muted-foreground text-xs"> ({daysElapsed}일 경과)</span>
                          </div>
                          {item.endDate && (
                            <div className="flex justify-between gap-2 sm:block">
                              <span className="text-muted-foreground whitespace-nowrap">만기일:</span>{" "}
                              <span className="font-medium text-right sm:text-left">{item.endDate}</span>
                              {daysRemaining !== null && (
                                <span className="text-muted-foreground text-xs">
                                  {daysRemaining > 0 ? ` (D-${daysRemaining})` : " (만기)"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {item.description && <p className={`text-foreground mt-2 text-sm ${ASSET_THEME.primary.text}`}># {item.description}</p>}
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
