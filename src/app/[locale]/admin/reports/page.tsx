"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { countryName } from "@/lib/countries";
import { formatOmr } from "@/lib/content";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CsvButton, MiniBars, PageHeader, Panel, StatCard } from "@/components/admin/ui";

function Breakdown({ title, rows, labelFor, filename }: { title: string; rows: { key: string; count: number; revenue: number }[]; labelFor?: (k: string) => string; filename: string }) {
  const locale = useLocale();
  const t = useTranslations("admin.reports");
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel title={title} actions={<CsvButton filename={filename} rows={rows.map((r) => ({ key: r.key, count: r.count, revenueOmr: r.revenue / 1000 }))} label={t("csv")} />}>
      <ul className="space-y-2 text-sm">
        {rows.slice(0, 12).map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="w-36 truncate">{labelFor ? labelFor(r.key) : r.key}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gold-gradient" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            <span className="w-10 text-end tabular-nums">{r.count}</span>
            <span className="w-24 text-end tabular-nums text-muted-foreground" dir="ltr">{formatOmr(r.revenue, locale, { compact: true })}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground">{t("noData")}</li>}
      </ul>
    </Panel>
  );
}

export default function AdminReportsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.reports");
  const [months, setMonths] = useState("12");
  const data = useQuery(api.admin.finance.reports, { months: Number(months) });
  if (!data) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<Select value={months} onValueChange={setMonths}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{["3", "6", "12", "24"].map((m) => <SelectItem key={m} value={m}>{t("lastMonths", { count: Number(m) })}</SelectItem>)}</SelectContent></Select>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("bookings")} value={data.totals.bookings} />
        <StatCard label={t("revenue")} value={formatOmr(data.totals.revenue, locale, { compact: true })} tone="success" />
        <StatCard label={t("guests")} value={data.totals.guests} />
        <StatCard label={t("avgBooking")} value={formatOmr(data.totals.avgBooking, locale, { compact: true })} />
      </div>
      <Panel title={t("revenueByMonth")} actions={<CsvButton filename="revenue-by-month.csv" rows={data.revenueByMonth.map((m) => ({ month: m.month, grossOmr: m.gross / 1000, refundedOmr: m.refunded / 1000, netOmr: m.net / 1000, payments: m.count }))} label={t("csv")} />}>
        <MiniBars data={data.revenueByMonth.map((m) => ({ label: m.month.slice(5), value: m.net / 1000 }))} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title={t("byNationality")} rows={data.byNationality} labelFor={(k) => countryName(k, locale)} filename="bookings-by-nationality.csv" />
        <Breakdown title={t("bySource")} rows={data.bySource} filename="bookings-by-source.csv" />
        <Breakdown title={t("byTour")} rows={data.byTour} filename="bookings-by-tour.csv" />
        <Panel title={t("cancellations")}>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label={t("cancelled")} value={data.cancellations.count} tone="danger" />
            <StatCard label={t("cancelRate")} value={`${data.cancellations.rate}%`} />
          </div>
          <ul className="mt-4 space-y-1 text-sm">{data.cancellations.reasons.slice(0, 8).map((r) => <li key={r.key} className="flex justify-between"><span className="truncate">{r.key}</span><span className="tabular-nums">{r.count}</span></li>)}</ul>
        </Panel>
      </div>
    </div>
  );
}
