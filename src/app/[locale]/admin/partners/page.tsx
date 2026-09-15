"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Building2, Globe, Mail, MapPin, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { countryName } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CsvButton, DateTime, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
type Status = (typeof STATUSES)[number];

export default function AdminPartnersPage() {
  const t = useTranslations("admin.partners");
  const tf = useTranslations("partners.form");
  const locale = useLocale();
  const [status, setStatus] = useState<string>("all");
  const rows = useQuery(api.admin.partners.list, { status: status === "all" ? undefined : (status as Status) });
  const counts = useQuery(api.admin.partners.counts);
  const staff = useQuery(api.admin.leads.staffMembers);
  const update = useMutation(api.admin.leads.update);
  const remove = useMutation(api.admin.partners.remove);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const label = (ns: string, key: string) => (tf.has(`${ns}.${key}`) ? tf(`${ns}.${key}`) : key);
  const slaLabel = (l: { slaDueAt: number; firstResponseAt: number | null }) => {
    if (l.firstResponseAt) return t("responded");
    const diff = l.slaDueAt - Date.now();
    return diff < 0 ? t("overdueBy", { min: Math.round(-diff / 60_000) }) : t("dueIn", { min: Math.round(diff / 60_000) });
  };

  const csv = rows?.map((l) => ({
    name: l.name, company: l.partner.company ?? "", type: l.partner.businessType, country: l.partner.country, city: l.partner.city, email: l.email ?? "", phone: l.phone ?? "", website: l.partner.website ?? "",
    markets: l.partner.markets.join("; "), clients: l.partner.clientTypes.join("; "), bookingsPerYear: l.partner.bookingsPerYear ?? "", interests: l.partner.interests.join("; "), status: l.status, created: new Date(l.createdAt).toISOString(), notes: l.notes ?? "",
  }));

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<CsvButton filename="partners.csv" rows={csv} label={t("exportCsv")} />} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>{t("all")}{counts ? ` (${counts.total})` : ""}</Button>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}><StatusBadge status={s} />{counts ? <span className="ms-1 text-xs text-muted-foreground">{counts[s]}</span> : null}</Button>
        ))}
      </div>
      {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
        <ul className="grid gap-3">
          {rows.map((l) => (
            <li key={l._id} className={`rounded-xl border bg-card p-4 ${l.overdue ? "border-danger/50" : "border-border"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{l.name}</span>
                    {l.partner.company && <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Building2 className="size-3.5" /> {l.partner.company}</span>}
                    <StatusBadge status={l.status} />
                    <span className="rounded bg-gold-500/15 px-1.5 text-xs text-gold-700 dark:text-gold-400">{label("businessTypes", l.partner.businessType)}</span>
                    <span className="text-xs uppercase text-muted-foreground">{l.locale}</span>
                    {l.overdue && <span className="inline-flex items-center gap-1 text-xs text-danger"><AlertTriangle className="size-3" /> {t("slaBreached")}</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {l.partner.city}, {countryName(l.partner.country, locale)}</span>
                    {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-foreground" dir="ltr"><Mail className="size-3" /> {l.email}</a>}
                    {l.phone && <span dir="ltr">{l.phone}</span>}
                    {l.partner.website && <a href={l.partner.website.startsWith("http") ? l.partner.website : `https://${l.partner.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground" dir="ltr"><Globe className="size-3" /> {l.partner.website}</a>}
                    <DateTime value={l.createdAt} />
                    <span>{slaLabel(l)}</span>
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-muted-foreground">{tf("interestTitle")}</dt><dd className="mt-0.5 flex flex-wrap gap-1">{l.partner.interests.map((i) => <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-foreground">{label("interestOptions", i)}</span>)}</dd></div>
                    <div><dt className="text-muted-foreground">{tf("markets")}</dt><dd className="mt-0.5 flex flex-wrap gap-1">{l.partner.markets.length ? l.partner.markets.map((m) => <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-foreground">{label("marketOptions", m)}</span>) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">{tf("clientTypes")}</dt><dd className="mt-0.5 flex flex-wrap gap-1">{l.partner.clientTypes.length ? l.partner.clientTypes.map((c) => <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-foreground">{label("clientOptions", c)}</span>) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">{tf("bookingsPerYear")}</dt><dd className="mt-0.5 text-foreground">{l.partner.bookingsPerYear ? label("bookingOptions", l.partner.bookingsPerYear) : "—"}</dd></div>
                  </dl>
                  {l.partner.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground">{l.partner.message}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:w-64">
                  <Select value={l.status} onValueChange={(v) => update({ id: l._id, status: v as Status }).then(() => toast.success(t("updated")))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={l.assigneeId ?? "none"} onValueChange={(v) => update({ id: l._id, assigneeId: v === "none" ? null : (v as Id<"users">) }).then(() => toast.success(t("updated")))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder={t("assign")} /></SelectTrigger>
                    <SelectContent><SelectItem value="none">{t("unassigned")}</SelectItem>{staff?.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    {l.phone && <Button asChild size="sm" variant="outline" className="flex-1 border-[#25D366]/40"><a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</a></Button>}
                    {l.email && <Button asChild size="sm" variant="outline" className="flex-1"><a href={`mailto:${l.email}?subject=${encodeURIComponent("Oman Compass Tours – partnership")}`}><Mail className="size-4" /> {t("email")}</a></Button>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (window.confirm(t("confirmRemove"))) { await remove({ id: l._id }); toast.success(t("removed")); } }}><Trash2 className="size-4" /> {t("remove")}</Button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input className="h-8" placeholder={t("notesPlaceholder")} value={notes[l._id] ?? l.notes ?? ""} onChange={(e) => setNotes({ ...notes, [l._id]: e.target.value })} />
                <Button size="sm" variant="outline" onClick={() => update({ id: l._id, notes: notes[l._id] ?? l.notes ?? "" }).then(() => toast.success(t("updated")))}>{t("saveNote")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
