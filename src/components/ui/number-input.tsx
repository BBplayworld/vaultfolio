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
  maxDecimals?: number; // 허용할 최대 소숫점 자리수
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value = 0, onChange, quickButtons, allowDecimals = false, maxDecimals, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      if (allowDecimals && value !== undefined) {
        // 소수점 값은 그대로 표시 (최대 12자리)
        // maxDecimals가 있으면 해당 자리수만큼만 표시
        if (maxDecimals !== undefined) {
          const parts = value.toString().split('.');
          if (parts.length === 2 && parts[1].length > maxDecimals) {
            setDisplayValue(value.toFixed(maxDecimals));
          } else {
            setDisplayValue(value.toString());
          }
        } else {
          setDisplayValue(value.toString());
        }
      } else {
        setDisplayValue(value ? formatNumberWithCommas(value) : "");
      }
    }, [value, allowDecimals, maxDecimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      if (allowDecimals) {
        // 소수점 입력 시: 숫자, 콤마, 점, 마이너스 기호만 허용
        let cleanValue = inputValue.replace(/[^\d,.-]/g, "");
        
        // 점이 여러 개면 첫 번째 것만 유지
        const parts = cleanValue.split('.');
        if (parts.length > 2) {
          cleanValue = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // 소수점 자리수 제한
        if (maxDecimals !== undefined && parts.length === 2) {
          if (parts[1].length > maxDecimals) {
            cleanValue = parts[0] + '.' + parts[1].slice(0, maxDecimals);
          }
        }
        
        setDisplayValue(cleanValue);
        
        // 파싱: 콤마 제거 후 숫자로 변환
        const numValue = parseFloat(cleanValue.replace(/,/g, '')) || 0;
        onChange?.(numValue);
      } else {
        // 정수만 입력: 숫자와 콤마만 허용
        const cleanValue = inputValue.replace(/[^\d,]/g, "");
        setDisplayValue(cleanValue);
        
        const numValue = parseNumberFromCommas(cleanValue);
        onChange?.(numValue);
      }
    };

    const handleBlur = () => {
      // blur 시 포맷팅 정리
      if (allowDecimals) {
        const numValue = parseFloat(displayValue.replace(/,/g, '')) || 0;
        if (numValue === 0) {
          setDisplayValue("");
        } else {
          // 소수점 값은 그대로 유지 (불필요한 0 제거)
          // maxDecimals가 있으면 제한
          if (maxDecimals !== undefined) {
            setDisplayValue(parseFloat(numValue.toFixed(maxDecimals)).toString());
          } else {
            setDisplayValue(numValue.toString());
          }
        }
      } else {
        const numValue = parseNumberFromCommas(displayValue);
        setDisplayValue(numValue ? formatNumberWithCommas(numValue) : "");
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // 포커스 시 전체 선택
      e.target.select();
    };

    const handleQuickAdd = (quickValue: number) => {
      const currentValue = allowDecimals 
        ? (parseFloat(displayValue.replace(/,/g, '')) || 0)
        : parseNumberFromCommas(displayValue);
      const newValue = currentValue + quickValue;
      setDisplayValue(formatNumberWithCommas(newValue));
      onChange?.(newValue);
    };

    return (
      <div>
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
        {quickButtons && quickButtons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
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
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";
