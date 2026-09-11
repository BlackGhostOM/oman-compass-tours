"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;

export default function AdminLeadsPage() {
  const t = useTranslations("admin.leads");
  const [status, setStatus] = useState<string>("all");
  const rows = useQuery(api.admin.leads.list, { status: status === "all" ? undefined : (status as (typeof STATUSES)[number]) });
  const staff = useQuery(api.admin.leads.staffMembers);
  const update = useMutation(api.admin.leads.update);
  const create = useMutation(api.admin.leads.create);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", locale: "en" as "en" | "ar", source: "whatsapp" as "whatsapp" | "phone" | "manual" });
  const [notes, setNotes] = useState<Record<string, string>>({});

  function slaLabel(l: { slaDueAt: number; status: string; firstResponseAt: number | null }) {
    if (l.firstResponseAt) return t("responded");
    const diff = l.slaDueAt - Date.now();
    if (diff < 0) return t("overdueBy", { min: Math.round(-diff / 60_000) });
    return t("dueIn", { min: Math.round(diff / 60_000) });
  }

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<Button onClick={() => setOpen(true)} className="bg-gold-gradient text-navy-950"><Plus className="size-4" /> {t("new")}</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s === "all" ? t("all") : <StatusBadge status={s} />}</Button>
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
                    <StatusBadge status={l.status} />
                    <span className="rounded bg-muted px-1.5 text-xs">{l.source}</span>
                    <span className="text-xs uppercase text-muted-foreground">{l.locale}</span>
                    {l.overdue && <span className="inline-flex items-center gap-1 text-xs text-danger"><AlertTriangle className="size-3" /> {t("slaBreached")}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{l.email ?? ""} {l.phone ? `· ${l.phone}` : ""} · <DateTime value={l.createdAt} /> · {slaLabel(l)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{l.message}</p>
                  {l.tripDetails && <p className="mt-1 text-xs text-muted-foreground">{[l.tripDetails.startDate && `${l.tripDetails.startDate} → ${l.tripDetails.endDate ?? "?"}`, l.tripDetails.travellers && `${l.tripDetails.travellers} pax`, l.tripDetails.budget, l.tripDetails.interests?.join(", ")].filter(Boolean).join(" · ")}</p>}
                  {l.conversationId && <Link href={`/admin/inbox?c=${l.conversationId}`} className="mt-1 inline-block text-xs text-gold-600 hover:underline">{t("openChat")}</Link>}
                </div>
                <div className="flex flex-col gap-2 sm:w-64">
                  <Select value={l.status} onValueChange={(v) => update({ id: l._id, status: v as (typeof STATUSES)[number] }).then(() => toast.success(t("updated")))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={l.assigneeId ?? "none"} onValueChange={(v) => update({ id: l._id, assigneeId: v === "none" ? null : (v as Id<"users">) }).then(() => toast.success(t("updated")))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder={t("assign")} /></SelectTrigger>
                    <SelectContent><SelectItem value="none">{t("unassigned")}</SelectItem>{staff?.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {l.phone && <Button asChild size="sm" variant="outline" className="border-[#25D366]/40"><a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</a></Button>}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("source")}</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as typeof form.source })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="phone">{t("phone")}</SelectItem><SelectItem value="manual">{t("manual")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("language")}</Label><Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "en" | "ar" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">EN</SelectItem><SelectItem value="ar">AR</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>{t("message")}</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <Button disabled={!form.name || !form.message} className="bg-gold-gradient text-navy-950" onClick={async () => { await create({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, message: form.message, locale: form.locale, source: form.source }); setOpen(false); setForm({ name: "", email: "", phone: "", message: "", locale: "en", source: "whatsapp" }); toast.success(t("created")); }}>{t("create")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
