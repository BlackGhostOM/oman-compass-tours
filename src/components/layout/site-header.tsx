"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, Phone, UserRound } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { primaryNav } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const viewer = useQuery(api.users.viewer);

  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const solid = scrolled || !isHome;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        solid
          ? "border-b border-navy-800/80 bg-navy-950/95 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur"
          : "bg-gradient-to-b from-navy-950/80 to-transparent",
      )}
    >
      <div className="container-brand flex h-[4.5rem] items-center justify-between gap-4">
        <Logo priority markClassName="size-10" />

        <nav aria-label={t("primary")} className="hidden shrink-0 items-center gap-0.5 lg:flex">
          {primaryNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "nav-link relative rounded-md px-2.5 py-2 font-medium whitespace-nowrap text-sand-100/85 transition hover:text-gold-400 2xl:px-3",
                  "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-px after:origin-start after:scale-x-0 after:bg-gold-500 after:transition-transform hover:after:scale-x-100",
                  active && "text-gold-400 after:scale-x-100",
                )}
                aria-current={active ? "page" : undefined}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`tel:${site.phoneE164}`}
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-sand-100/80 transition hover:text-gold-400 min-[1700px]:flex"
            dir="ltr"
          >
            <Phone className="size-4 text-gold-500" />
            {site.phoneDisplay}
          </a>
          <LanguageSwitcher />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-sand-100 hover:bg-navy-800 hover:text-gold-400"
          >
            <Link href={viewer ? "/account" : "/sign-in"} aria-label={viewer ? t("account") : t("signIn")}>
              <UserRound className="size-5" />
            </Link>
          </Button>
          <Button
            asChild
            size="default"
            className="hidden bg-gold-gradient font-semibold text-navy-950 shadow-gold hover:brightness-110 md:inline-flex"
          >
            <Link href="/tours">{tc("bookNow")}</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sand-100 hover:bg-navy-800 hover:text-gold-400 lg:hidden"
                aria-label={t("openMenu")}
              >
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent className="dark w-[86vw] max-w-sm border-navy-800 bg-navy-950 text-sand-50">
              <SheetHeader className="border-b border-navy-800 pb-4">
                <SheetTitle asChild>
                  <div>
                    <Logo markClassName="size-10" />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav aria-label={t("primary")} className="flex flex-col gap-1 px-4 py-4">
                {primaryNav.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-3 font-heading text-base tracking-wide text-sand-100 transition hover:bg-navy-900 hover:text-gold-400",
                      (pathname === item.href || pathname.startsWith(item.href + "/")) && "text-gold-400",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                ))}
                <Link
                  href={viewer ? "/account" : "/sign-in"}
                  className="rounded-md px-3 py-3 text-sand-100/80 transition hover:bg-navy-900 hover:text-gold-400"
                >
                  {viewer ? t("account") : t("signIn")}
                </Link>
              </nav>
              <div className="mt-auto space-y-3 border-t border-navy-800 px-4 pt-4 pb-6">
                <Button asChild className="w-full bg-gold-gradient font-semibold text-navy-950">
                  <Link href="/tours">{tc("bookNow")}</Link>
                </Button>
                <a
                  href={`tel:${site.phoneE164}`}
                  className="flex items-center justify-center gap-2 text-sm text-sand-100/80"
                  dir="ltr"
                >
                  <Phone className="size-4 text-gold-500" /> {site.phoneDisplay}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
