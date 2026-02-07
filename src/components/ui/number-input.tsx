"use client";

import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumberWithCommas, parseNumberFromCommas } from "@/lib/number-utils";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number) => void;
  quickButtons?: { label: string; value: number }[];
  allowDecimals?: boolean; // 소숫점 허용 여부
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value = 0, onChange, quickButtons, allowDecimals = false, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      setDisplayValue(value ? formatNumberWithCommas(value) : "");
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // 소숫점 허용 시 숫자, 콤마, 점 허용, 아니면 숫자와 콤마만
      const cleanValue = allowDecimals
        ? inputValue.replace(/[^\d,.-]/g, "")
        : inputValue.replace(/[^\d,]/g, "");
      setDisplayValue(cleanValue);

      const numValue = parseNumberFromCommas(cleanValue);
      onChange?.(numValue);
    };

    const handleBlur = () => {
      // blur 시 포맷팅 정리
      const numValue = parseNumberFromCommas(displayValue);
      setDisplayValue(numValue ? formatNumberWithCommas(numValue) : "");
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // 포커스 시 전체 선택
      e.target.select();
    };

    const handleQuickAdd = (quickValue: number) => {
      const currentValue = parseNumberFromCommas(displayValue);
      const newValue = currentValue + quickValue;
      setDisplayValue(formatNumberWithCommas(newValue));
      onChange?.(newValue);
    };

    return (
      <div className="space-y-2">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className={cn("text-right", className)}
          {...props}
        />
        {quickButtons && quickButtons.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {quickButtons.map((btn) => (
              <Button
                key={btn.label}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleQuickAdd(btn.value)}
                className="h-7 text-xs"
              >
                +{btn.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="h-7" />
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";
