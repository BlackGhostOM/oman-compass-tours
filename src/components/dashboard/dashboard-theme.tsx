"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
const KEY = "oct_dashboard_theme";

/**
 * Dashboard-only dark mode. Applies the `dark` class to a wrapper element so
 * the public site (which is dark-first by design) is unaffected.
 */
export function DashboardThemeProvider({ children, className }: { children: React.ReactNode; className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Theme | null;
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return (
    <Ctx.Provider value={{ theme, toggle }}>
      <div className={cn(theme === "dark" && "dark", "min-h-dvh bg-background text-foreground", className)}>{children}</div>
    </Ctx.Provider>
  );
}

export function useDashboardTheme() {
  return useContext(Ctx);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useDashboardTheme();
  const t = useTranslations("dashboard");
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "dark" ? t("lightMode") : t("darkMode")} title={theme === "dark" ? t("lightMode") : t("darkMode")} className={className}>
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
