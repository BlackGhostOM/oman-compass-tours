"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CsvButton, DateTime, EmptyState, Money, PageHeader } from "@/components/admin/ui";

export default function AdminCustomersPage() {
  const locale = useLocale();
  const t = useTranslations("admin.customers");
  const [search, setSearch] = useState("");
  const rows = useQuery(api.admin.customers.list, { search: search || undefined });
  const exportRows = useQuery(api.admin.customers.exportRows);
  const csv = useMemo(() => exportRows as Record<string, unknown>[] | undefined, [exportRows]);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<CsvButton filename="customers.csv" rows={csv} label={t("exportCsv")} />} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-9" />
      </div>
      {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("cols.name")}</TableHead>
                <TableHead>{t("cols.contact")}</TableHead>
                <TableHead>{t("cols.nationality")}</TableHead>
                <TableHead className="text-end">{t("cols.bookings")}</TableHead>
                <TableHead className="text-end">{t("cols.spent")}</TableHead>
                <TableHead>{t("cols.tags")}</TableHead>
                <TableHead>{t("cols.joined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c._id}>
                  <TableCell><Link href={`/admin/customers/${c._id}`} className="font-medium text-foreground hover:text-gold-600">{c.name ?? "—"}</Link><div className="text-xs text-muted-foreground">{c.loyaltyPoints} pts{c.leadSource ? ` · ${c.leadSource}` : ""}</div></TableCell>
                  <TableCell><div>{c.email}</div><div className="text-xs text-muted-foreground" dir="ltr">{c.phone}</div></TableCell>
                  <TableCell>{c.nationality ? countryName(c.nationality, locale) : "—"}</TableCell>
                  <TableCell className="text-end">{c.bookings}</TableCell>
                  <TableCell className="text-end"><Money baisa={c.spentOmr} /></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{c.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></TableCell>
                  <TableCell><DateTime value={c.createdAt} withTime={false} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
