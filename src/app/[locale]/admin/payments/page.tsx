"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAction, useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatOmr, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvButton, DateTime, EmptyState, Money, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";

export default function AdminPaymentsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.payments");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = useQuery(api.admin.finance.transactions, { provider: provider === "all" ? undefined : (provider as "thawani" | "stripe" | "paypal" | "manual"), status: status === "all" ? undefined : (status as "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded" | "cancelled" | "created") });
  const refunds = useQuery(api.admin.finance.refunds);
  const recon = useQuery(api.admin.finance.reconciliation, {});
  const reconcile = useAction(api.payments.reconcile);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<CsvButton filename="transactions.csv" rows={rows?.map((p) => ({ reference: p.reference, customer: p.customer, provider: p.provider, kind: p.kind, amount: p.amount / (p.currency === "OMR" ? 1000 : 100), currency: p.currency, amountOmr: p.amountOmr / 1000, refundedOmr: p.refundedAmount / 1000, status: p.status, providerPaymentId: p.providerPaymentId, paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : "" }))} label={t("exportCsv")} />} />

      <Tabs defaultValue="transactions">
        <TabsList><TabsTrigger value="transactions">{t("tabs.transactions")}</TabsTrigger><TabsTrigger value="refunds">{t("tabs.refunds")}</TabsTrigger><TabsTrigger value="reconciliation">{t("tabs.reconciliation")}</TabsTrigger></TabsList>

        <TabsContent value="transactions" className="pt-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <Select value={provider} onValueChange={setProvider}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("allProviders")}</SelectItem>{["thawani", "stripe", "paypal", "manual"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("allStatuses")}</SelectItem>{["succeeded", "pending", "failed", "refunded", "partially_refunded", "cancelled"].map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}</SelectContent></Select>
          </div>
          {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>{t("cols.date")}</TableHead><TableHead>{t("cols.booking")}</TableHead><TableHead>{t("cols.provider")}</TableHead><TableHead className="text-end">{t("cols.amount")}</TableHead><TableHead className="text-end">OMR</TableHead><TableHead>{t("cols.status")}</TableHead><TableHead>{t("cols.providerId")}</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell><DateTime value={p.paidAt ?? p.createdAt} /></TableCell>
                      <TableCell>{p.reference ? <Link href={`/admin/bookings/${p.bookingId}`} className="text-gold-600 hover:underline" dir="ltr">{p.reference}</Link> : "—"}<div className="text-xs text-muted-foreground">{p.customer} · {p.tourTitle ? pick(p.tourTitle, locale) : ""}</div></TableCell>
                      <TableCell className="capitalize">{p.provider} · {p.kind}</TableCell>
                      <TableCell className="text-end" dir="ltr">{p.currency} {(p.amount / (p.currency === "OMR" ? 1000 : 100)).toFixed(p.currency === "OMR" ? 3 : 2)}</TableCell>
                      <TableCell className="text-end"><Money baisa={p.amountOmr} />{p.refundedAmount > 0 && <div className="text-xs text-warning">−<Money baisa={p.refundedAmount} /></div>}</TableCell>
                      <TableCell><StatusBadge status={p.status} />{p.failureReason && <div className="max-w-40 truncate text-xs text-danger">{p.failureReason}</div>}</TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-xs" dir="ltr">{p.providerPaymentId ?? p.providerSessionId ?? "—"}</TableCell>
                      <TableCell>{(p.status === "pending" || p.status === "created") && p.provider !== "manual" && <Button size="xs" variant="outline" onClick={() => reconcile({ paymentId: p._id }).then((r) => toast.success(`${t("reconciled")}: ${r.status}`))}><RefreshCw className="size-3" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="refunds" className="pt-4">
          {refunds === undefined ? <Skeleton className="h-64 rounded-xl" /> : refunds.length === 0 ? <EmptyState title={t("noRefunds")} /> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>{t("cols.date")}</TableHead><TableHead>{t("cols.booking")}</TableHead><TableHead className="text-end">OMR</TableHead><TableHead>{t("cols.reason")}</TableHead><TableHead>{t("cols.status")}</TableHead><TableHead>{t("cols.by")}</TableHead></TableRow></TableHeader>
                <TableBody>{refunds.map((r) => <TableRow key={r._id}><TableCell><DateTime value={r._creationTime} /></TableCell><TableCell><Link href={`/admin/bookings/${r.bookingId}`} className="text-gold-600 hover:underline" dir="ltr">{r.reference}</Link></TableCell><TableCell className="text-end"><Money baisa={r.amountOmr} /></TableCell><TableCell className="max-w-56 truncate">{r.reason}{r.error ? ` · ${r.error}` : ""}</TableCell><TableCell><StatusBadge status={r.status === "processing" ? "pending" : r.status} /></TableCell><TableCell>{r.requestedBy}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4 pt-4">
          {!recon ? <Skeleton className="h-64 rounded-xl" /> : (
            <>
              <p className="text-sm text-muted-foreground">{t("period")}: <DateTime value={recon.from} withTime={false} /> → <DateTime value={recon.to} withTime={false} /></p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(recon.byProvider).map(([p, v]) => (
                  <StatCard key={p} label={p.toUpperCase()} value={formatOmr(v.grossOmr - v.refundedOmr, locale, { compact: true })} hint={`${v.succeeded}/${v.count} ${t("succeeded")} · ${v.failed} ${t("failed")} · ${v.pending} ${t("pending")} · ${Object.entries(v.byCurrency).map(([c, a]) => `${c} ${(a / (c === "OMR" ? 1000 : 100)).toFixed(0)}`).join(", ")}`} />
                ))}
              </div>
              <Panel title={t("recentWebhooks")}>
                <ul className="divide-y divide-border text-xs">
                  {recon.recentWebhooks.map((w) => <li key={w._id} className="flex items-center gap-3 py-1.5"><DateTime value={w.receivedAt} /><span className="capitalize">{w.provider}</span><span className="flex-1 truncate font-mono">{w.type} · {w.eventId}</span><StatusBadge status={w.processed ? (w.error ? "failed" : "succeeded") : "pending"} label={w.error ?? (w.processed ? t("processed") : t("pending"))} /></li>)}
                  {recon.recentWebhooks.length === 0 && <li className="py-2 text-muted-foreground">{t("noWebhooks")}</li>}
                </ul>
              </Panel>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
