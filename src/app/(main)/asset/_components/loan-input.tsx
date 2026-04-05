"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, CreditCard, Calendar, Clock, Building2, Coins, TrendingUp } from "lucide-react";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loan, loanSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";
import { financialInstitutions, securitiesFirms, loanTypes, quickButtonPresets } from "@/config/asset-options";

// 대출 종류별 빠른 입력 버튼
const getQuickButtonsByType = (type: string) => {
  if (type === "mortgage-home") return [...quickButtonPresets.loanMortgage];
  return [...quickButtonPresets.loanDefault];
};

interface LoanFormProps {
  editData?: Loan;
  onClose: () => void;
}

function LoanForm({ editData, onClose }: LoanFormProps) {
  const { addLoan, updateLoan, assetData } = useAssetData();
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
      linkedRealEstateId: "",
      linkedCashId: "",
      linkedStockId: "",
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
              <FormLabel>{selectedType === "mortgage-stock" ? "증권사" : "금융기관"}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedType === "mortgage-stock" ? "증권사 선택" : "금융기관 선택"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(selectedType === "mortgage-stock" ? securitiesFirms : financialInstitutions).map((group) => (
                    <SelectGroup key={group.group}>
                      <SelectLabel>{group.group}</SelectLabel>
                      {group.items.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
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

        {selectedType === "mortgage-stock" && assetData.stocks.length > 0 && (
          <FormField
            control={form.control}
            name="linkedStockId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연계 주식</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="연계 주식 선택 (선택사항)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assetData.stocks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.ticker ? ` (${s.ticker})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedType === "mortgage-deposit" && assetData.cash.filter((c) => c.type === "deposit").length > 0 && (
          <FormField
            control={form.control}
            name="linkedCashId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연계 예금</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="연계 예금 선택 (선택사항)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assetData.cash
                      .filter((c) => c.type === "deposit")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.institution ? ` (${c.institution})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedType === "mortgage-home" && assetData.realEstate.length > 0 && (
          <FormField
            control={form.control}
            name="linkedRealEstateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연계 부동산</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="연계 부동산 선택 (선택사항)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assetData.realEstate.map((re) => (
                      <SelectItem key={re.id} value={re.id}>
                        {re.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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

  const formatDaysToYMD = (days: number): string => {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const d = days - years * 365 - months * 30;
    const parts = [];
    if (years > 0) parts.push(`${years}년`);
    if (months > 0) parts.push(`${months}개월`);
    if (d > 0 || parts.length === 0) parts.push(`${d}일`);
    return parts.join(" ");
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
                <p className="text-muted-foreground text-sm">등록된 대출이 없습니다.</p>
                <p className="text-muted-foreground mt-1 text-xs">'대출 추가' 버튼을 눌러 추가해 보세요.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {assetData.loans.map((item) => {
                const daysElapsed = calculateHoldingDays(item.startDate);
                const daysRemaining = item.endDate ? calculateHoldingDays(item.endDate) : null;

                return (
                  <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                    {/* Layer 1: 헤더 */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-b">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <Badge variant="outline" className={ASSET_THEME.categoryBox}>
                          {getTypeLabel(item.type)}
                        </Badge>
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        {item.institution && (
                          <span className="text-muted-foreground text-xs shrink-0">({item.institution})</span>
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
                    <div className="p-4 flex flex-row sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">현재 잔액</span>
                        <span className={`text-medium font-bold ${ASSET_THEME.liability}`}>
                          {formatCurrencyDisplay(item.balance)}
                        </span>
                      </div>
                    </div>

                    {/* Layer 3: 대출 기간 */}
                    <div className="px-4 py-3 bg-muted/10 border-t">
                      <div className="flex items-start sm:items-center justify-between sm:justify-start gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">금리</span>
                          <span className="text-sm font-medium text-primary">
                            {item.interestRate}%
                          </span>
                        </div>
                        <span className="hidden sm:inline text-border self-center">|</span>
                        {item.endDate ? (
                          <div className="flex flex-col gap-0.5 items-end sm:items-start">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              <span className="text-xs text-foreground">{formatDaysToYMD(daysElapsed)} 경과</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              <span className="text-xs font-semibold text-foreground">{daysRemaining != null ? formatDaysToYMD(daysRemaining) : ""} 남음</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              <span className="text-xs font-semibold text-foreground">{item.startDate} 대출</span>
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 items-end sm:items-start">
                            <span className="text-xs text-muted-foreground">만기일</span>
                            <span className="text-sm font-medium text-muted-foreground">미설정</span>
                          </div>
                        )}
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

                    {/* Layer 5: 연계 부동산 */}
                    {item.linkedRealEstateId && (() => {
                      const linked = assetData.realEstate.find((re) => re.id === item.linkedRealEstateId);
                      if (!linked) return null;
                      return (
                        <div className="px-4 py-2.5 border-t bg-primary/5 flex items-center gap-2 text-xs">
                          <Building2 className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 부동산</span>
                          <span className="font-medium text-primary truncate">{linked.name}</span>
                          {linked.address && (
                            <span className="hidden sm:inline text-muted-foreground truncate">{linked.address}</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Layer 5-2: 연계 주식 */}
                    {item.linkedStockId && (() => {
                      const linked = assetData.stocks.find((s) => s.id === item.linkedStockId);
                      if (!linked) return null;
                      return (
                        <div className="px-4 py-2.5 border-t bg-primary/5 flex items-center gap-2 text-xs">
                          <TrendingUp className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 주식</span>
                          <span className="font-medium text-primary truncate">{linked.name}</span>
                          {linked.ticker && (
                            <span className="text-muted-foreground">({linked.ticker})</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Layer 5-3: 연계 예금 */}
                    {item.linkedCashId && (() => {
                      const linked = assetData.cash.find((c) => c.id === item.linkedCashId);
                      if (!linked) return null;
                      return (
                        <div className="px-4 py-2.5 border-t bg-primary/5 flex items-center gap-2 text-xs">
                          <Coins className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 예금</span>
                          <span className="font-medium text-primary truncate">{linked.name}</span>
                          {linked.institution && (
                            <span className="hidden sm:inline text-muted-foreground">({linked.institution})</span>
                          )}
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
