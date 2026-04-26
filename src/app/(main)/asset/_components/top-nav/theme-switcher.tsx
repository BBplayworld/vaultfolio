"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

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
    <Button size="icon" className="size-7 sm:size-9" onClick={handleValueChange}>
      {themeMode === "dark" ? <Sun className="size-3.5 sm:size-4" /> : <Moon className="size-3.5 sm:size-4" />}
    </Button>
  );
}
