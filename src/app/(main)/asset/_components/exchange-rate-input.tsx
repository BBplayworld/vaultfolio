"use client";

import { useAssetData } from "@/contexts/asset-data-context";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { BadgeDollarSign } from "lucide-react";
import { ASSET_THEME } from "@/config/theme";

export function ExchangeRateInput() {
    const { exchangeRates, updateExchangeRate } = useAssetData();

    return (
        <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 mr-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                        <BadgeDollarSign className={"size-4 text-primary"} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">환율 설정</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">외화 자산의 원화 환산 기준</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 flex-1">
                    <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1">
                            🇺🇸 USD
                        </Label>
                        <div className="flex items-center gap-2">
                            <NumberInput
                                value={exchangeRates.USD}
                                onChange={(val) => updateExchangeRate("USD", val)}
                                className="w-28"
                                quickButtons={[]}
                            />
                            <span className="text-sm text-muted-foreground">원</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1">
                            🇯🇵 JPY (100엔)
                        </Label>
                        <div className="flex items-center gap-2">
                            <NumberInput
                                value={exchangeRates.JPY}
                                onChange={(val) => updateExchangeRate("JPY", val)}
                                className="w-28"
                                quickButtons={[]}
                            />
                            <span className="text-sm text-muted-foreground">원</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end">
                    <span className={`${ASSET_THEME.todayBox}`}>
                        환율 기준일: {new Date().toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
