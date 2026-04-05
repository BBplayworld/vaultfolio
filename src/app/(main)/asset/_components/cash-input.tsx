"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Wallet, CreditCard } from "lucide-react";
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
import { Cash, cashSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";
import { cashTypes, financialInstitutions } from "@/config/asset-options";

interface CashFormProps {
    editData?: Cash;
    onClose: () => void;
}

function CashForm({ editData, onClose }: CashFormProps) {
    const { addCash, updateCash } = useAssetData();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<Cash>({
        resolver: zodResolver(cashSchema),
        defaultValues: editData || {
            id: "",
            type: "deposit",
            name: "",
            balance: 0,
            currency: "KRW",
            institution: "",
            description: "",
        },
    });

    const onSubmit = async (data: Cash) => {
        setIsSubmitting(true);
        try {
            if (editData) {
                const success = updateCash(editData.id, data);
                if (success) {
                    toast.success("현금성 자산이 수정되었습니다.");
                    onClose();
                } else {
                    toast.error("저장에 실패했습니다.");
                }
            } else {
                const newData = {
                    ...data,
                    id: `cash_${Date.now()}`,
                };
                const success = addCash(newData);
                if (success) {
                    toast.success("현금성 자산이 추가되었습니다.");
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
                            <FormLabel>유형 *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="유형 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {cashTypes.map((type) => (
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
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>통화 *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="통화 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="KRW">원화 (KRW)</SelectItem>
                                    <SelectItem value="USD">달러 (USD)</SelectItem>
                                    <SelectItem value="JPY">엔화 (JPY)</SelectItem>
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
                            <FormLabel>자산/계좌명 *</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 우리은행 비상금 통장" {...field} />
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
                            <FormLabel>금융기관명</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="금융기관 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {financialInstitutions.map((group) => (
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
                            <FormLabel>금액 *</FormLabel>
                            <FormControl>
                                <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="0"
                                    quickButtons={[]}
                                />
                            </FormControl>
                            <FormDescription>{form.watch("currency")}</FormDescription>
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
                                <Textarea placeholder="추가 정보 입력 (만기일 등)..." {...field} />
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

export function CashInput() {
    const { assetData, deleteCash, exchangeRates } = useAssetData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Cash | undefined>();

    const handleDelete = (id: string) => {
        if (confirm("정말 삭제하시겠습니까?")) {
            const success = deleteCash(id);
            if (success) {
                toast.success("삭제되었습니다.");
            } else {
                toast.error("삭제에 실패했습니다.");
            }
        }
    };

    const handleEdit = (item: Cash) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingItem(undefined);
    };

    const formatCurrencyDisplay = (value: number, currency: string = "KRW") => {
        if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        return formatCurrency(value);
    };

    const getMultiplier = (currency?: string) => {
        if (currency === "USD") return exchangeRates.USD;
        if (currency === "JPY") return exchangeRates.JPY / 100;
        return 1;
    };

    const getTypeLabel = (value: string) => {
        return cashTypes.find((t) => t.value === value)?.label || value;
    };

    return (
        <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2">
                                <Wallet className="size-5" />
                                현금성 자산
                            </CardTitle>
                            <CardDescription>보유하고 있는 현금성 자산을 관리합니다.</CardDescription>
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setEditingItem(undefined)}>
                                    <Plus className="mr-2 size-4" />
                                    현금성 자산 추가
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto touch-pan-y">
                                <DialogHeader>
                                    <DialogTitle>{editingItem ? "현금성 자산 수정" : "현금성 자산 추가"}</DialogTitle>
                                    <DialogDescription>
                                        {editingItem ? "현금성 자산 정보를 수정합니다." : "새로운 현금성 자산을 추가합니다."}
                                    </DialogDescription>
                                </DialogHeader>
                                <CashForm editData={editingItem} onClose={handleDialogClose} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {assetData.cash && assetData.cash.length === 0 ? (
                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
                            <div className="text-center">
                                <p className="text-muted-foreground text-sm">등록된 현금성 자산이 없습니다.</p>
                                <p className="text-muted-foreground mt-1 text-xs">'현금성 자산 추가' 버튼을 눌러 추가해 보세요.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {assetData.cash && assetData.cash.map((item) => {
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
                                        <div className="p-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-muted-foreground">보유금액</span>
                                                <span className={`text-medium font-bold ${ASSET_THEME.important}`}>
                                                    {formatCurrencyDisplay(item.balance, item.currency)}
                                                </span>
                                                {item.currency !== "KRW" && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ₩{(item.balance * getMultiplier(item.currency)).toLocaleString()} 환산
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Layer 3: 부가 정보 */}
                                        {item.description && (
                                            <div className="px-4 py-2.5 bg-muted/10 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                                <span className="w-full mt-0.5 text-primary truncate">
                                                    # {item.description}
                                                </span>
                                            </div>
                                        )}

                                        {/* Layer 4: 연계 예금담보대출 */}
                                        {(() => {
                                            const linkedLoans = assetData.loans.filter((l) => l.linkedCashId === item.id);
                                            if (linkedLoans.length === 0) return null;
                                            return (
                                                <div className="px-4 py-2.5 border-t space-y-1.5">
                                                    <p className="text-[11px] font-semibold text-muted-foreground">예금담보대출</p>
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
