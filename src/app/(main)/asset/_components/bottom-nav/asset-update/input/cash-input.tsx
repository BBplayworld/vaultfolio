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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Cash, cashSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { cashTypes, financialInstitutions } from "@/config/asset-options";
import { CashScreenshotImport } from "../screenshot/cash-screenshot-import";
import { MAIN_PALETTE } from "@/config/theme";

interface CashFormProps {
    editData?: Cash;
    onClose: () => void;
}

function CashForm({ editData, onClose }: CashFormProps) {
    const { addCash, updateCash } = useAssetData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedType, setSelectedType] = useState<Cash["type"]>(editData?.type || "deposit");

    const getNamePlaceholder = () => {
        if (selectedType === "deposit") return "예: KB국민은행 정기예금 (1년)";
        if (selectedType === "savings") return "예: 토스뱅크 적금 (24개월)";
        if (selectedType === "bank") return "예: 카카오뱅크 비상금 통장";
        if (selectedType === "cma") return "예: 미래에셋 CMA-RP";
        if (selectedType === "cash") return "예: 지갑 현금";
        return "자산/계좌명 입력";
    };

    const getBalanceDescription = () => {
        if (selectedType === "deposit") return "원 (세전 원금 기준)";
        if (selectedType === "savings") return "원 (현재까지 납입 원금)";
        if (selectedType === "cash") return "원 (보유 현금 총액)";
        return "원";
    };

    const getDescriptionPlaceholder = () => {
        if (selectedType === "deposit") return "예: 만기 2026-12-31, 금리 3.5%";
        if (selectedType === "savings") return "예: 월 30만원, 만기 2027-06-01";
        if (selectedType === "bank") return "예: 비상금 용도, 파킹 통장";
        if (selectedType === "cma") return "예: 증권 연계 CMA, 수시 입출금";
        return "추가 정보 입력 (만기일, 금리 등)...";
    };

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
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    setSelectedType(value as Cash["type"]);
                                }}
                                defaultValue={field.value}
                            >
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
                                <Input placeholder={getNamePlaceholder()} {...field} />
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
                    render={({ field }) => {
                        const currency = form.watch("currency");
                        const isForeignCurrency = currency === "USD" || currency === "JPY";
                        return (
                            <FormItem>
                                <FormLabel style={{ color: MAIN_PALETTE[10] }}>금액 *</FormLabel>
                                <FormControl>
                                    <NumberInput
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="0"
                                        quickButtons={[]}
                                        allowDecimals={isForeignCurrency}
                                        maxDecimals={isForeignCurrency ? 2 : undefined}
                                    />
                                </FormControl>
                                <FormDescription>{form.watch("currency")} {getBalanceDescription()}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>설명</FormLabel>
                            <FormControl>
                                <Textarea placeholder={getDescriptionPlaceholder()} {...field} />
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

export function CashInput() {
    const { assetData } = useAssetData();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Cash | undefined>();
    const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            const mode = (e as CustomEvent).detail?.mode;
            setEditingItem(undefined);
            if (mode === "screenshot") {
                setIsScreenshotOpen(true);
            } else {
                setIsDialogOpen(true);
            }
        };
        window.addEventListener("trigger-add-cash", handler);
        return () => window.removeEventListener("trigger-add-cash", handler);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const id = (e as CustomEvent).detail?.id;
            if (!id) return;
            const item = assetData.cash.find((c) => c.id === id);
            if (item) { setEditingItem(item); setIsDialogOpen(true); }
        };
        window.addEventListener("trigger-edit-cash", handler);
        return () => window.removeEventListener("trigger-edit-cash", handler);
    }, [assetData.cash]);

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingItem(undefined);
    };

    return (
        <>
            <CashScreenshotImport open={isScreenshotOpen} onOpenChange={setIsScreenshotOpen} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? "현금성 자산 수정" : "현금성 자산 추가"}</DialogTitle>
                        <DialogDescription>
                            {editingItem ? "현금성 자산 정보를 수정합니다." : "새로운 현금성 자산을 추가합니다."}
                        </DialogDescription>
                    </DialogHeader>
                    <CashForm editData={editingItem} onClose={handleDialogClose} />
                </DialogContent>
            </Dialog>
        </>
    );
}
