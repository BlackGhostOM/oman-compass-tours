"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { FileText } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { formatDate, formatMoney, formatOmr, pick } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const tone: Record<string, string> = {
  succeeded: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
  partially_refunded: "bg-warning/15 text-warning",
};

export default function PaymentsPage() {
  const locale = useLocale();
  const t = useTranslations("account.payments");
  const rows = useQuery(api.account.myPayments);
  if (rows === undefined) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div>
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("booking")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead className="text-end">{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-end">{t("invoice")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p._id}>
                  <TableCell className="whitespace-nowrap">{formatDate(p.paidAt ?? p.createdAt, locale, "short")}</TableCell>
                  <TableCell>
                    <div className="font-medium" dir="ltr">{p.bookingReference}</div>
                    <div className="max-w-56 truncate text-xs text-muted-foreground">{pick(p.tourTitle, locale)}</div>
                  </TableCell>
                  <TableCell className="capitalize">{p.provider} · {t(`kinds.${p.kind}`)}</TableCell>
                  <TableCell className="text-end" dir="ltr">
                    <div>{formatOmr(p.amountOmr, locale)}</div>
                    {p.currency !== "OMR" && <div className="text-xs text-muted-foreground">{formatMoney(p.amount / 100, p.currency, locale)}</div>}
                    {p.refundedAmount > 0 && <div className="text-xs text-warning">−{formatOmr(p.refundedAmount, locale)}</div>}
                  </TableCell>
                  <TableCell><Badge className={cn(tone[p.status])}>{t(`statuses.${p.status}`)}</Badge></TableCell>
                  <TableCell className="text-end">
                    {p.status === "succeeded" || p.status === "partially_refunded" || p.status === "refunded" ? (
                      <Button asChild size="sm" variant="outline"><a href={`/api/invoice/${p.voucherToken}?p=${p._id}`} target="_blank" rel="noopener noreferrer"><FileText className="size-4" /> PDF</a></Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
