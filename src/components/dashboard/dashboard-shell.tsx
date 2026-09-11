"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ExternalLink, LogOut, Menu, type LucideIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { DashboardThemeProvider, ThemeToggle } from "@/components/dashboard/dashboard-theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type NavItem = { key: string; href: string; Icon: LucideIcon; badge?: number; exact?: boolean };

export function DashboardShell({
  items,
  namespace,
  title,
  children,
}: {
  items: NavItem[];
  namespace: string;
  title: string;
  children: React.ReactNode;
}) {
  const t = useTranslations(namespace);
  const td = useTranslations("dashboard");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  const nav = (
    <nav aria-label={title} className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
            isActive(item) ? "bg-gold-500/15 font-medium text-gold-600 dark:text-gold-400" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.Icon className="size-4 shrink-0" />
          <span className="flex-1">{t(item.key)}</span>
          {item.badge ? <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-semibold text-navy-950">{item.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );

  const initials = (viewer?.name ?? viewer?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <DashboardThemeProvider>
      <div className="flex min-h-dvh">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <div className="flex h-16 items-center border-b border-sidebar-border px-4">
            <Logo variant="mark" markClassName="size-9" /><span className="ms-3 font-heading text-[13px] tracking-[0.12em] text-gold-400">OMAN COMPASS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 [&_a]:text-sidebar-foreground/80 [&_a:hover]:bg-sidebar-accent [&_a[aria-current=page]]:bg-sidebar-accent [&_a[aria-current=page]]:text-sidebar-primary">
            <p className="eyebrow mb-3 px-3 text-[11px]">{title}</p>
            {nav}
          </div>
          <div className="border-t border-sidebar-border p-3">
            <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
              <ExternalLink className="size-4" /> {td("backToSite")}
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label={td("openMenu")}>
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side={locale === "ar" ? "right" : "left"} className="dark w-72 border-navy-800 bg-navy-950 p-0 text-sand-50">
                  <SheetHeader className="border-b border-navy-800 p-4">
                    <SheetTitle asChild><div><Logo variant="mark" markClassName="size-9" /><span className="ms-3 font-heading text-[13px] tracking-[0.12em] text-gold-400">OMAN COMPASS</span></div></SheetTitle>
                  </SheetHeader>
                  <div className="p-3 [&_a]:text-sand-100/80 [&_a:hover]:bg-navy-900 [&_a[aria-current=page]]:bg-navy-900 [&_a[aria-current=page]]:text-gold-400">{nav}</div>
                </SheetContent>
              </Sheet>
              <h1 className="font-heading text-lg text-foreground">{title}</h1>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher className="text-foreground hover:bg-muted hover:text-foreground" />
              <ThemeToggle />
              {viewer && (
                <div className="ms-2 flex items-center gap-2">
                  <Avatar className="size-8">
                    {viewer.image && <AvatarImage src={viewer.image} alt="" />}
                    <AvatarFallback className="bg-gold-500/20 text-xs text-gold-600">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">{viewer.name ?? viewer.email}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={td("signOut")}
                onClick={async () => {
                  await signOut();
                  router.replace("/");
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </DashboardThemeProvider>
  );
}
