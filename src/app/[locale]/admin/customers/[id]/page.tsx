"use client";

import { use, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, Money, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";

export default function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locale = useLocale();
  const t = useTranslations("admin.customers.detail");
  const c = useQuery(api.admin.customers.get, { id: id as Id<"users"> });
  const update = useMutation(api.admin.customers.update);
  const [tags, setTags] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [points, setPoints] = useState("");

  if (c === undefined) return <Skeleton className="h-96 rounded-xl" />;
  if (c === null) return <p className="text-muted-foreground">{t("notFound")}</p>;

  async function save() {
    try {
      await update({ id: c!._id, tags: (tags ?? c!.tags.join(", ")).split(",").map((s) => s.trim()).filter(Boolean), notes: notes ?? c!.notes ?? "", leadSource: source ?? c!.leadSource ?? "", loyaltyPointsDelta: points ? Number(points) : undefined });
      setPoints("");
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={c.name ?? c.email ?? "—"} description={`${c.email ?? ""} · ${c.phone ?? ""} · ${c.nationality ? countryName(c.nationality, locale) : ""} · ${t("joined")} ${new Date(c.createdAt).toLocaleDateString()}`} actions={<><Button asChild variant="ghost" size="sm"><Link href="/admin/customers"><ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("back")}</Link></Button>{c.phone ? <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</a></Button> : null}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("crm")}>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{t("tags")}</Label><Input value={tags ?? c.tags.join(", ")} onChange={(e) => setTags(e.target.value)} placeholder="vip, family, repeat" /></div>
            <div className="space-y-1.5"><Label>{t("leadSource")}</Label><Input value={source ?? c.leadSource ?? ""} onChange={(e) => setSource(e.target.value)} placeholder="instagram, tripadvisor, referral" /></div>
            <div className="space-y-1.5"><Label>{t("notes")}</Label><Textarea rows={5} value={notes ?? c.notes ?? ""} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("adjustPoints", { points: c.loyaltyPoints })}</Label><Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="+50 / -20" /></div>
            <Button size="sm" onClick={save} className="bg-gold-gradient text-navy-950">{t("save")}</Button>
            <p className="text-xs text-muted-foreground">{t("prefs", { locale: c.locale, marketing: c.marketingOptIn ? "✓" : "✗", referral: c.referralCode ?? "—" })}</p>
          </div>
        </Panel>
        <Panel title={t("bookings")} className="lg:col-span-2">
          {c.bookings.length === 0 ? <p className="text-sm text-muted-foreground">{t("noBookings")}</p> : (
            <ul className="divide-y divide-border text-sm">
              {c.bookings.map((b) => (
                <li key={b._id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/admin/bookings/${b._id}`} className="font-medium text-gold-700 hover:underline" dir="ltr">{b.reference}</Link>
                  <span className="flex-1 truncate">{pick(b.tourTitle, locale)}</span>
                  <DateTime value={b.date} withTime={false} />
                  <Money baisa={b.amountPaid} /> / <Money baisa={b.total} />
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("activity")} className="lg:col-span-3">
          <div className="grid gap-6 sm:grid-cols-3 text-sm">
            <div><p className="mb-2 font-medium">{t("reviews")}</p>{c.reviews.length === 0 ? <p className="text-muted-foreground">—</p> : c.reviews.map((r) => <p key={String(r._id)}>★{r.rating} · <StatusBadge status={r.status} /> {r.body.slice(0, 60)}…</p>)}</div>
            <div><p className="mb-2 font-medium">{t("conversations")}</p>{c.conversations.length === 0 ? <p className="text-muted-foreground">—</p> : c.conversations.map((x) => <p key={String(x._id)}><Link href={`/admin/inbox?c=${x._id}`} className="text-gold-700 hover:underline">{x.subject ?? t("chat")}</Link> · <StatusBadge status={x.status} /> · <DateTime value={x.lastMessageAt} /></p>)}</div>
            <div><p className="mb-2 font-medium">{t("leads")}</p>{c.leads.length === 0 ? <p className="text-muted-foreground">—</p> : c.leads.map((l) => <p key={String(l._id)}>{l.source} · <StatusBadge status={l.status} /> · <DateTime value={l.createdAt} /></p>)}{c.dataRequests.length > 0 && <p className="mt-2 text-warning">{t("dataRequests", { count: c.dataRequests.length })}</p>}</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
