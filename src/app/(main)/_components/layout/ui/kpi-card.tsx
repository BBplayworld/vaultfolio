"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ASSET_THEME } from "@/config/theme";

interface KpiCardProps {
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  primary?: string; // 없으면 금액 줄 생략(안내만 보여줄 때)
  secondary?: ReactNode;
  onClick: () => void;
  dataTutorial?: string;
  primaryClassName?: string;
}

export function KpiCard({ icon: Icon, title, description, primary, secondary, onClick, dataTutorial, primaryClassName }: KpiCardProps) {
  return (
    <Card
      onClick={onClick}
      data-tutorial={dataTutorial}
      className="cursor-pointer p-4 sm:p-5 hover:bg-accent/50 active:scale-[0.98] transition-[color,background-color,box-shadow,transform] duration-150 ease-out dark:shadow-xs dark:border-0"
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="size-6 shrink-0 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm lg:text-base font-semibold text-foreground">{title}</h3>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          {primary !== undefined && (
            <p className={`text-xl sm:text-2xl lg:text-2xl font-bold tabular-nums mt-2 ${primaryClassName || ASSET_THEME.important}`}>
              {primary}
            </p>
          )}
          {secondary && <div className="text-sm lg:text-base font-medium mt-1">{secondary}</div>}
        </div>
      </div>
    </Card>
  );
}
