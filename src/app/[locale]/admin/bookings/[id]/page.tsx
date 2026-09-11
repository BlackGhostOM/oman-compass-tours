"use client";

import { use, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowLeft, Copy, Download, Link2, Mail, MessageCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDate, pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, Money, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";

const ALL = ["inquiry", "pending_payment", "confirmed", "in_progress", "completed", "cancelled", "refunded"] as const;

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locale = useLocale();
  const t = useTranslations("admin.bookings.detail");
  const tt = useTranslations("admin.settings.templates");
  const b = useQuery(api.admin.bookings.get, { id: id as Id<"bookings"> });
  const templates = useQuery(api.admin.settings.notificationTemplates);
  const updateStatus = useMutation(api.admin.bookings.updateStatus);
  const updateDetails = useMutation(api.admin.bookings.updateDetails);
  const recordPayment = useMutation(api.admin.bookings.recordManualPayment);
  const regenerate = useMutation(api.admin.bookings.regenerateVoucher);
  const issueLink = useMutation(api.admin.bookings.issuePaymentLink);
  const refund = useAction(api.payments.refund);
  const resend = useAction(api.adminActions.resendConfirmation);
  const sendLinkEmail = useAction(api.adminActions.sendPaymentLink);
  const reconcile = useAction(api.payments.reconcile);
  const [notes, setNotes] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [refundAmount, setRefundAmount] = useState<Record<string, string>>({});
  const [linkAmount, setLinkAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (b === undefined) return <Skeleton className="h-96 rounded-xl" />;
  if (b === null) return <p className="text-muted-foreground">{t("notFound")}</p>;

  const outstanding = Math.max(0, b.total - b.amountPaid);
  const wa = (text: string) => `https://wa.me/${b.traveller.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;
  const fill = (tpl: string) => tpl.replace("{name}", b.traveller.firstName).replace("{reference}", b.reference).replace("{tour}", pick(b.tourTitle, b.locale)).replace("{date}", formatDate(b.date, b.locale, "short")).replace("{time}", b.startTime ?? "").replace("{pickup}", b.traveller.pickupLocation ?? b.traveller.hotel ?? "").replace("{voucher}", `${site.url}/api/voucher/${b.voucherToken}`).replace("{link}", `${site.url}/${b.locale}/checkout/${b.reference}?t=${b.voucherToken}`);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string }) : undefined;
      toast.error(data?.code ? `${t("error")} (${data.code})` : t("error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span dir="ltr">{b.reference}</span>}
        title={pick(b.tourTitle, locale)}
        description={`${formatDate(b.date, locale)} · ${b.startTime ?? ""} · ${b.adults}A ${b.children}C ${b.infants}I · ${t("source")}: ${b.source}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link href="/admin/bookings"><ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("back")}</Link></Button>
            <StatusBadge status={b.status} />
            <Button asChild variant="outline" size="sm"><a href={`/api/voucher/${b.voucherToken}`} target="_blank" rel="noopener noreferrer"><Download className="size-4" /> {t("voucher")}</a></Button>
            <Button variant="outline" size="sm" disabled={busy === "resend"} onClick={() => run("resend", () => resend({ bookingId: b._id }), t("resent"))}><Mail className="size-4" /> {t("resend")}</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status workflow */}
        <Panel title={t("workflow")}>
          <div className="flex flex-wrap gap-2">
            {ALL.map((s) => {
              const allowed = b.allowedTransitions.includes(s);
              const current = b.status === s;
              return (
                <Button key={s} size="sm" variant={current ? "default" : allowed ? "outline" : "ghost"} disabled={current || busy === "status"} className={current ? "bg-navy-950 text-gold-400" : !allowed ? "opacity-40" : ""} onClick={() => run("status", () => updateStatus({ id: b._id, status: s, force: !allowed }), t("statusUpdated"))} title={!allowed ? t("forceHint") : undefined}>
                  <StatusBadge status={s} />
                </Button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("workflowHint")}</p>
          {b.holdExpiresAt && ["inquiry", "pending_payment"].includes(b.status) && <p className="mt-2 text-xs text-warning">{t("holdExpires")}: <DateTime value={b.holdExpiresAt} /></p>}
        </Panel>

        {/* Traveller */}
        <Panel title={t("traveller")}>
          <dl className="space-y-1.5 text-sm">
            <div><dt className="inline text-muted-foreground">{t("name")}: </dt><dd className="inline font-medium">{b.traveller.firstName} {b.traveller.lastName} · {countryName(b.traveller.nationality, locale)}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("phone")}: </dt><dd className="inline" dir="ltr">{b.traveller.phone}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("email")}: </dt><dd className="inline">{b.traveller.email}</dd></div>
            <div><dt className="inline text-muted-foreground">{t("pickup")}: </dt><dd className="inline">{b.traveller.pickupLocation ?? b.traveller.hotel ?? "—"}</dd></div>
            {b.traveller.specialRequests && <div><dt className="text-muted-foreground">{t("requests")}</dt><dd className="whitespace-pre-wrap">{b.traveller.specialRequests}</dd></div>}
            {b.customer && <div className="pt-2"><Link href={`/admin/customers/${b.customer._id}`} className="text-gold-700 hover:underline">{t("openCustomer")}</Link> · {b.customer.loyaltyPoints} pts</div>}
          </dl>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("quickReplies")}</p>
            <div className="flex flex-wrap gap-2">
              {templates && (["whatsapp_confirmation", "whatsapp_reminder", "whatsapp_payment_link", "whatsapp_review"] as const).map((k) => (
                <Button key={k} asChild size="sm" variant="outline" className="border-[#25D366]/40"><a href={wa(fill(templates[k][b.locale]))} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> {tt(k)}</a></Button>
              ))}
            </div>
          </div>
        </Panel>

        {/* Operations */}
        <Panel title={t("operations")}>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{t("guide")}</Label><Input value={guide ?? b.assignedGuideName ?? ""} onChange={(e) => setGuide(e.target.value)} placeholder="Musab" /></div>
            <div className="space-y-1.5"><Label>{t("vehicle")}</Label><Input value={vehicle ?? b.vehicle ?? ""} onChange={(e) => setVehicle(e.target.value)} placeholder="Land Cruiser · 1234 AB" /></div>
            <div className="space-y-1.5"><Label>{t("internalNotes")}</Label><Textarea rows={4} value={notes ?? b.internalNotes ?? ""} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button size="sm" disabled={busy === "details"} onClick={() => run("details", () => updateDetails({ id: b._id, assignedGuideName: guide ?? b.assignedGuideName ?? "", vehicle: vehicle ?? b.vehicle ?? "", internalNotes: notes ?? b.internalNotes ?? "" }), t("saved"))} className="bg-gold-gradient text-navy-950">{t("save")}</Button>
          </div>
        </Panel>

        {/* Money */}
        <Panel title={t("payments")} className="lg:col-span-2">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{t("total")}</p><p className="font-heading text-lg"><Money baisa={b.total} /></p></div>
            <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{t("paid")}</p><p className="font-heading text-lg text-success"><Money baisa={b.amountPaid} /></p></div>
            <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{t("outstanding")}</p><p className="font-heading text-lg text-warning"><Money baisa={outstanding} /></p></div>
          </div>
          <ul className="divide-y divide-border text-sm">
            {b.items.map((it) => <li key={it._id} className="flex justify-between py-1.5"><span>{pick(it.label, locale)} × {it.quantity}</span><Money baisa={it.total} /></li>)}
          </ul>
          <h4 className="mt-5 mb-2 text-xs font-medium text-muted-foreground">{t("transactions")}</h4>
          {b.payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("noPayments")}</p> : (
            <ul className="divide-y divide-border text-sm">
              {b.payments.map((p) => (
                <li key={p._id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="capitalize">{p.provider}</span>
                  <StatusBadge status={p.status} />
                  <span dir="ltr" className="tabular-nums">{p.currency} {(p.amount / (p.currency === "OMR" ? 1000 : 100)).toFixed(p.currency === "OMR" ? 3 : 2)}</span>
                  <span className="text-muted-foreground">= <Money baisa={p.amountOmr} /></span>
                  {p.refundedAmount > 0 && <span className="text-warning">−<Money baisa={p.refundedAmount} /></span>}
                  <span className="text-xs text-muted-foreground" dir="ltr">{p.providerPaymentId ?? p.providerSessionId ?? ""}</span>
                  <span className="ms-auto flex items-center gap-2">
                    {(p.status === "pending" || p.status === "created") && p.provider !== "manual" && <Button size="xs" variant="outline" disabled={busy === `rec-${p._id}`} onClick={() => run(`rec-${p._id}`, () => reconcile({ paymentId: p._id }), t("reconciled"))}><RefreshCw className="size-3" /> {t("reconcile")}</Button>}
                    {(p.status === "succeeded" || p.status === "partially_refunded") && (
                      <>
                        <Input className="h-7 w-24" placeholder="OMR" value={refundAmount[p._id] ?? ""} onChange={(e) => setRefundAmount({ ...refundAmount, [p._id]: e.target.value })} />
                        <Button size="xs" variant="outline" className="text-danger" disabled={busy === `ref-${p._id}` || !refundAmount[p._id]} onClick={() => run(`ref-${p._id}`, () => refund({ paymentId: p._id, amountOmr: Math.round(Number(refundAmount[p._id]) * 1000), reason: "staff refund" }), t("refundRequested"))}>{t("refund")}</Button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {b.refunds.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("refundsCount", { count: b.refunds.length })}</p>}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{t("recordPayment")}</p>
              <div className="mt-2 flex gap-2">
                <Input placeholder="OMR" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <Select value={payMethod} onValueChange={setPayMethod}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">{t("cash")}</SelectItem><SelectItem value="bank">{t("bank")}</SelectItem><SelectItem value="pos">POS</SelectItem></SelectContent></Select>
                <Button size="sm" disabled={!payAmount || busy === "pay"} onClick={() => run("pay", async () => { await recordPayment({ id: b._id, amountOmr: Number(payAmount), method: payMethod }); setPayAmount(""); }, t("paymentRecorded"))}>{t("record")}</Button>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{t("paymentLink")}</p>
              <div className="mt-2 flex gap-2">
                <Input placeholder={`OMR (${(outstanding / 1000).toFixed(3)})`} value={linkAmount} onChange={(e) => setLinkAmount(e.target.value)} />
                <Button size="sm" disabled={busy === "link"} onClick={() => run("link", async () => { const r = await issueLink({ id: b._id, amountOmr: Number(linkAmount) || outstanding / 1000 }); await navigator.clipboard.writeText(r.url).catch(() => {}); await sendLinkEmail({ bookingId: b._id, url: r.url, amountOmr: Number(linkAmount) || outstanding / 1000 }); }, t("linkSent"))}><Link2 className="size-4" /> {t("issue")}</Button>
              </div>
              {b.paymentLinks.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{b.paymentLinks.map((l) => <li key={l._id} className="flex items-center gap-2"><Money baisa={l.amountOmr} /> · {l.usedAt ? t("used") : l.expiresAt < Date.now() ? t("expired") : t("active")} <button type="button" className="text-gold-700" onClick={() => navigator.clipboard.writeText(`${site.url}/${b.locale}/pay/${l.token}`)}><Copy className="size-3" /></button></li>)}</ul>}
            </div>
          </div>
        </Panel>

        {/* Timeline */}
        <Panel title={t("timeline")} actions={<Button size="xs" variant="ghost" disabled={busy === "regen"} onClick={() => run("regen", () => regenerate({ id: b._id }), t("regenerated"))}><RefreshCw className="size-3" /> {t("regenerateVoucher")}</Button>}>
          <ul className="space-y-2 text-xs">
            {[...b.audit.map((a) => ({ at: a.createdAt, text: `${a.action}${a.actorEmail ? ` · ${a.actorEmail}` : ""}`, kind: "audit" })), ...b.notifications.map((n) => ({ at: n.sentAt ?? n._creationTime, text: `${n.template} → ${n.to} (${n.status})`, kind: "email" }))].sort((a, b2) => b2.at - a.at).slice(0, 40).map((e, i) => (
              <li key={i} className="flex gap-2"><span className="w-32 shrink-0 text-muted-foreground"><DateTime value={e.at} /></span>{e.kind === "email" ? <Send className="mt-0.5 size-3 text-gold-500" /> : null}<span className="break-all">{e.text}</span></li>
            ))}
            {b.acceptances.map((a) => <li key={a._id} className="flex gap-2 text-muted-foreground"><span className="w-32 shrink-0"><DateTime value={a.acceptedAt} /></span><span>{t("policiesAccepted", { count: a.policyVersionIds.length })}</span></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
