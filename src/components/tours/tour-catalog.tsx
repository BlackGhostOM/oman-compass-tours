"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { pick } from "@/lib/content";
import { cn } from "@/lib/utils";
import { TourCard } from "@/components/tours/tour-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { FunctionReturnType } from "convex/server";
import { Slider } from "@/components/ui/slider";

type Filters = {
  category?: string;
  destination?: string;
  duration?: string; // half | full | multi
  maxPrice?: number;
  language?: string;
  group?: number;
  sort?: "popular" | "price_asc" | "price_desc" | "duration" | "rating";
  q?: string;
};

const DURATIONS: Record<string, { min?: number; max?: number }> = {
  half: { max: 300 },
  full: { min: 301, max: 1439 },
  multi: { min: 1440 },
};

export function TourCatalog({
  kind,
  initialCategory,
  initialDestination,
  hideCategoryFilter = false,
  initialTours,
}: {
  kind?: "tour" | "service";
  initialCategory?: string;
  initialDestination?: string;
  hideCategoryFilter?: boolean;
  /** Server-rendered result set for the unfiltered view, so the first paint already shows cards (no layout shift). */
  initialTours?: FunctionReturnType<typeof api.tours.list>;
}) {
  const locale = useLocale();
  const t = useTranslations("catalog");
  const router = useRouter();
  const params = useSearchParams();

  const filters: Filters = useMemo(
    () => ({
      category: params.get("category") ?? initialCategory ?? undefined,
      destination: params.get("destination") ?? initialDestination ?? undefined,
      duration: params.get("duration") ?? undefined,
      maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
      language: params.get("language") ?? undefined,
      group: params.get("group") ? Number(params.get("group")) : undefined,
      sort: (params.get("sort") as Filters["sort"]) ?? undefined,
      q: params.get("q") ?? undefined,
    }),
    [params, initialCategory, initialDestination],
  );

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === null) next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const durationRange = filters.duration ? DURATIONS[filters.duration] : undefined;
  const tours = useQuery(api.tours.list, {
    kind,
    categoryKey: filters.category,
    destinationKey: filters.destination,
    minDurationMinutes: durationRange?.min,
    maxDurationMinutes: durationRange?.max,
    maxPrice: filters.maxPrice ? filters.maxPrice * 1000 : undefined,
    guideLanguage: filters.language,
    minGroupSize: filters.group,
    search: filters.q,
    sort: filters.sort,
  });
  // Until the live query resolves, fall back to the server-rendered list for the default (unfiltered) view.
  const list = tours ?? (params.toString() === "" ? initialTours : undefined);
  const categories = useQuery(api.catalog.categories);
  const destinations = useQuery(api.catalog.destinations);

  const activeCount = [filters.category && !initialCategory, filters.destination && !initialDestination, filters.duration, filters.maxPrice, filters.language, filters.group].filter(Boolean).length;
  const [search, setSearch] = useState(filters.q ?? "");

  const filterPanel = (
    <div className="space-y-6">
      {!hideCategoryFilter && (
        <div className="space-y-2">
          <Label htmlFor="filter-category">{t("category")}</Label>
          <Select value={filters.category ?? "all"} onValueChange={(v) => setFilters({ category: v === "all" ? undefined : v })}>
            <SelectTrigger id="filter-category" aria-label={t("category")} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.key} value={c.key}>{pick(c.name, locale)} ({c.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="filter-destination">{t("destination")}</Label>
        <Select value={filters.destination ?? "all"} onValueChange={(v) => setFilters({ destination: v === "all" ? undefined : v })}>
          <SelectTrigger id="filter-destination" aria-label={t("destination")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allDestinations")}</SelectItem>
            {destinations?.map((d) => (
              <SelectItem key={d.key} value={d.key}>{pick(d.name, locale)} ({d.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("duration")}</Label>
        <div className="flex flex-wrap gap-2">
          {(["half", "full", "multi"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilters({ duration: filters.duration === d ? undefined : d })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition",
                filters.duration === d ? "border-gold-500 bg-gold-500/15 text-navy-950" : "border-sand-200 bg-white text-ink-500 hover:border-gold-500/60",
              )}
            >
              {t(`durations.${d}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("maxPrice")}</Label>
          <span className="text-sm text-ink-500" dir="ltr">{filters.maxPrice ? `≤ OMR ${filters.maxPrice}` : t("any")}</span>
        </div>
        <Slider
          min={20}
          max={800}
          step={10}
          value={[filters.maxPrice ?? 800]}
          onValueChange={([v]) => setFilters({ maxPrice: v >= 800 ? undefined : v })}
          aria-label={t("maxPrice")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-guideLanguage">{t("guideLanguage")}</Label>
        <Select value={filters.language ?? "any"} onValueChange={(v) => setFilters({ language: v === "any" ? undefined : v })}>
          <SelectTrigger id="filter-guideLanguage" aria-label={t("guideLanguage")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("any")}</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-groupSize">{t("groupSize")}</Label>
        <Select value={filters.group ? String(filters.group) : "any"} onValueChange={(v) => setFilters({ group: v === "any" ? undefined : Number(v) })}>
          <SelectTrigger id="filter-groupSize" aria-label={t("groupSize")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("any")}</SelectItem>
            {[2, 4, 6, 8, 12].map((n) => (
              <SelectItem key={n} value={String(n)}>{t("groupOf", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setFilters({ category: initialCategory ? filters.category : undefined, destination: initialDestination ? filters.destination : undefined, duration: undefined, maxPrice: undefined, language: undefined, group: undefined })}>
          <X className="size-4" /> {t("clearFilters")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      {/* Desktop filters */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-sand-200 bg-white p-5">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-base text-navy-950">
            <SlidersHorizontal className="size-4 text-gold-500" /> {t("filters")}
          </h2>
          {filterPanel}
        </div>
      </aside>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ q: search || undefined });
            }}
          >
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 bg-white ps-9"
              aria-label={t("searchPlaceholder")}
            />
          </form>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal className="size-4" /> {t("filters")}
                  {activeCount > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-semibold text-navy-950">{activeCount}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
                <SheetHeader><SheetTitle>{t("filters")}</SheetTitle></SheetHeader>
                <div className="px-4 pb-8">{filterPanel}</div>
              </SheetContent>
            </Sheet>
            <Select value={filters.sort ?? "popular"} onValueChange={(v) => setFilters({ sort: v as Filters["sort"] })}>
              <SelectTrigger className="h-10 w-44 bg-white" aria-label={t("sortBy")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["popular", "rating", "price_asc", "price_desc", "duration"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`sort.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-500" aria-live="polite">
          {list === undefined ? t("loading") : t("results", { count: list.length })}
        </p>

        {list === undefined ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {/* Same count and height as a typical result set so the footer does not jump when data arrives */}
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-sand-200 bg-white p-0">
                <Skeleton className="aspect-[4/3] rounded-t-xl" />
                <div className="space-y-3 px-4 pb-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center text-ink-500">
            {t("noResults")}
          </div>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((tour, i) => (
              <TourCard key={tour._id} tour={tour} priority={i < 3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
