"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Banknote, Wallet } from "lucide-react";
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
import { Cash, cashSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";

const cashTypes = [
    { value: "deposit", label: "예금" },
    { value: "savings", label: "적금" },
    { value: "bank", label: "입출금통장" },
    { value: "cash", label: "실물 현금" },
] as const;

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
                    toast.success("현금 자산이 수정되었습니다.");
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
                    toast.success("현금 자산이 추가되었습니다.");
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
                                <Input placeholder="예: 국민은행 비상금 통장" {...field} />
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
                            <FormControl>
                                <Input placeholder="예: 국민은행, 토스뱅크 등" {...field} value={field.value || ""} />
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
                                    현금 추가
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto touch-pan-y">
                                <DialogHeader>
                                    <DialogTitle>{editingItem ? "현금 자산 수정" : "현금 자산 추가"}</DialogTitle>
                                    <DialogDescription>
                                        {editingItem ? "현금 자산 정보를 수정합니다." : "새로운 현금 자산을 추가합니다."}
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
                                <p className="text-muted-foreground text-sm">등록된 현금 자산이 없습니다.</p>
                                <p className="text-muted-foreground text-xs">위의 버튼을 눌러 자산을 추가하세요.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {assetData.cash && assetData.cash.map((item) => {
                                return (
                                    <div key={item.id} className="rounded-lg border p-4">
                                        <div className="flex flex-col gap-3">
                                            {/* 제목과 버튼 영역 */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                                    <span className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
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
                                                        <span className="text-muted-foreground whitespace-nowrap">보유금액:</span>{" "}
                                                        <span className={`font-medium text-right sm:text-left ${ASSET_THEME.asset.strong}`}>
                                                            {formatCurrencyDisplay(item.balance, item.currency)}
                                                            {item.currency !== "KRW" && (
                                                                <span className="text-muted-foreground text-xs ml-1">
                                                                    (₩{(item.balance * getMultiplier(item.currency)).toLocaleString()})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                                {item.description && <p className="text-foreground mt-2 text-sm">{item.description}</p>}
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
