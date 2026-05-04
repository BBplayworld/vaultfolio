"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { MAIN_PALETTE } from "@/config/theme";

const BTN_H = "h-9 sm:h-10";

export function ThemeSwitcher() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const handleValueChange = async () => {
    const newTheme = themeMode === "dark" ? "light" : "dark";
    updateThemeMode(newTheme);
    setThemeMode(newTheme);
    await setValueToCookie("theme_mode", newTheme);
  };

  return (
    <Button size="icon"
      className={`${BTN_H} aspect-square text-white hover:opacity-90`}
      onClick={handleValueChange}
      style={{ backgroundColor: MAIN_PALETTE[11] }}>
      {themeMode === "dark" ? <Sun className="size-3.5 sm:size-4" /> : <Moon className="size-3.5 sm:size-4" />}
    </Button>
  );
}
