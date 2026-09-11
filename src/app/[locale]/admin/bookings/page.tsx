"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Plus, Search } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CsvButton, DateTime, EmptyState, Money, PageHeader, StatusBadge } from "@/components/admin/ui";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";

const STATUSES = ["inquiry", "pending_payment", "confirmed", "in_progress", "completed", "cancelled", "refunded"] as const;

export default function AdminBookingsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.bookings");
  const params = useSearchParams();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tourId, setTourId] = useState<string>("all");
  const [open, setOpen] = useState(params.get("new") === "1");
  const tours = useQuery(api.admin.bookings.toursForSelect);
  const rows = useQuery(api.admin.bookings.list, { status: status === "all" ? undefined : (status as (typeof STATUSES)[number]), search: search || undefined, from: from || undefined, to: to || undefined, tourId: tourId === "all" ? undefined : (tourId as Id<"tours">) });

  const csvRows = useMemo(() => rows?.map((b) => ({ reference: b.reference, tour: b.tourTitle.en, date: b.date, time: b.startTime ?? "", traveller: b.traveller, email: b.email, phone: b.phone, nationality: b.nationality, guests: b.groupSize, totalOmr: b.total / 1000, paidOmr: b.amountPaid / 1000, status: b.status, source: b.source, created: new Date(b.createdAt).toISOString() })), [rows]);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<><CsvButton filename="bookings.csv" rows={csvRows} label={t("exportCsv")} /><Button onClick={() => setOpen(true)} className="bg-gold-gradient text-navy-950"><Plus className="size-4" /> {t("manualCta")}</Button></>} />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tourId} onValueChange={setTourId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTours")}</SelectItem>
            {tours?.map((tr) => <SelectItem key={tr._id} value={tr._id}>{tr.code} · {pick(tr.title, locale)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("from")} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("to")} />
        </div>
      </div>

      {rows === undefined ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("cols.reference")}</TableHead>
                <TableHead>{t("cols.tour")}</TableHead>
                <TableHead>{t("cols.date")}</TableHead>
                <TableHead>{t("cols.traveller")}</TableHead>
                <TableHead className="text-end">{t("cols.total")}</TableHead>
                <TableHead className="text-end">{t("cols.paid")}</TableHead>
                <TableHead>{t("cols.status")}</TableHead>
                <TableHead>{t("cols.source")}</TableHead>
                <TableHead>{t("cols.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b._id} className="cursor-pointer" onClick={() => (window.location.href = `/${locale}/admin/bookings/${b._id}`)}>
                  <TableCell><Link href={`/admin/bookings/${b._id}`} className="font-medium text-gold-600 hover:underline" dir="ltr" onClick={(e) => e.stopPropagation()}>{b.reference}</Link></TableCell>
                  <TableCell className="max-w-56 truncate">{pick(b.tourTitle, locale)}</TableCell>
                  <TableCell><DateTime value={b.date} withTime={false} /> <span className="text-muted-foreground" dir="ltr">{b.startTime}</span></TableCell>
                  <TableCell><div>{b.traveller}</div><div className="text-xs text-muted-foreground">{b.nationality} · {b.groupSize} {t("guestsShort")}</div></TableCell>
                  <TableCell className="text-end"><Money baisa={b.total} /></TableCell>
                  <TableCell className="text-end"><Money baisa={b.amountPaid} className={b.amountPaid >= b.total ? "text-success" : b.amountPaid > 0 ? "text-warning" : ""} /></TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="capitalize">{b.source}</TableCell>
                  <TableCell><DateTime value={b.createdAt} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ManualBookingDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
