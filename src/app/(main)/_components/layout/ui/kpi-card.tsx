"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ASSET_THEME } from "@/config/theme";

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primary: string;
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
      className="cursor-pointer p-4 sm:p-5 hover:bg-accent/50 active:scale-[0.99] transition-all shadow-xs border-0"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 sm:size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm lg:text-base font-semibold text-foreground">{title}</h3>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">{description}</p>
          <p className={`text-xl sm:text-2xl lg:text-2xl font-extrabold tabular-nums mt-2 ${primaryClassName || ASSET_THEME.important}`}>
            {primary}
          </p>
          {secondary && <div className="text-xs lg:text-sm mt-1">{secondary}</div>}
        </div>
      </div>
    </Card>
  );
}
