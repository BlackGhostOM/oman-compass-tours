"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { Check, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/tours/rating-stars";
import { DateTime, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export default function AdminReviewsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.reviews");
  const [status, setStatus] = useState<string>("pending");
  const rows = useQuery(api.admin.reviews.list, { status: status === "all" ? undefined : (status as "pending" | "approved" | "rejected") });
  const tours = useQuery(api.admin.bookings.toursForSelect);
  const moderate = useMutation(api.admin.reviews.moderate);
  const remove = useMutation(api.admin.reviews.remove);
  const importExternal = useMutation(api.admin.reviews.importExternal);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tourId: "", authorName: "", authorCountry: "", rating: 5, title: "", body: "", language: "en" as "en" | "ar", source: "tripadvisor" as "tripadvisor" | "viator" | "google", externalUrl: "", travelDate: "" });

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<Button onClick={() => setOpen(true)} className="bg-gold-gradient text-navy-950"><Plus className="size-4" /> {t("import")}</Button>} />
      <div className="mb-4 flex gap-2">
        {["pending", "approved", "rejected", "all"].map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s === "all" ? t("all") : <StatusBadge status={s} />}</Button>)}
      </div>
      {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r._id} className="rounded-xl border border-border bg-card p-4" dir={r.language === "ar" ? "rtl" : "ltr"}>
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars rating={r.rating} />
                <span className="font-medium">{r.authorName}</span>
                {r.authorCountry && <span className="text-xs text-muted-foreground">{r.authorCountry}</span>}
                <span className="rounded bg-muted px-1.5 text-xs">{r.source}</span>
                <StatusBadge status={r.status} />
                {r.isFeatured && <Star className="size-4 fill-gold-500 text-gold-500" />}
              </div>
              {r.tourTitle && <p className="mt-1 text-xs text-muted-foreground">{pick(r.tourTitle, locale)} · {r.travelDate ?? ""} · <DateTime value={r._creationTime} withTime={false} /></p>}
              {r.title && <p className="mt-2 font-heading text-sm">{r.title}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              {r.staffReply && <p className="mt-2 border-s-2 border-gold-500 ps-2 text-xs text-muted-foreground">{t("reply")}: {r.staffReply}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "approved" && <Button size="xs" variant="outline" className="text-success" onClick={() => moderate({ id: r._id, status: "approved" }).then(() => toast.success(t("updated")))}><Check className="size-3" /> {t("approve")}</Button>}
                {r.status !== "rejected" && <Button size="xs" variant="outline" className="text-danger" onClick={() => moderate({ id: r._id, status: "rejected" }).then(() => toast.success(t("updated")))}><X className="size-3" /> {t("reject")}</Button>}
                <Button size="xs" variant="outline" onClick={() => moderate({ id: r._id, isFeatured: !r.isFeatured }).then(() => toast.success(t("updated")))}><Star className="size-3" /> {r.isFeatured ? t("unfeature") : t("feature")}</Button>
                <Button size="xs" variant="ghost" className="text-danger" onClick={() => remove({ id: r._id })}><Trash2 className="size-3" /></Button>
              </div>
              <div className="mt-2 flex gap-2">
                <Input className="h-8" placeholder={t("replyPlaceholder")} value={reply[r._id] ?? ""} onChange={(e) => setReply({ ...reply, [r._id]: e.target.value })} />
                <Button size="sm" variant="outline" disabled={!reply[r._id]} onClick={() => moderate({ id: r._id, staffReply: reply[r._id] }).then(() => { toast.success(t("updated")); setReply({ ...reply, [r._id]: "" }); })}>{t("sendReply")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("import")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>{t("tour")}</Label><Select value={form.tourId || "none"} onValueChange={(v) => setForm({ ...form, tourId: v === "none" ? "" : v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t("general")}</SelectItem>{tours?.map((x) => <SelectItem key={x._id} value={x._id}>{pick(x.title, locale)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("author")}</Label><Input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("country")}</Label><Input value={form.authorCountry} onChange={(e) => setForm({ ...form, authorCountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="GB" /></div>
              <div className="space-y-1.5"><Label>{t("rating")}</Label><Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>{t("source")}</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as typeof form.source })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tripadvisor">Tripadvisor</SelectItem><SelectItem value="viator">Viator</SelectItem><SelectItem value="google">Google</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("language")}</Label><Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v as "en" | "ar" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">EN</SelectItem><SelectItem value="ar">AR</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("travelDate")}</Label><Input type="month" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>{t("headline")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("body")}</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>URL</Label><Input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} dir="ltr" /></div>
            <Button disabled={!form.authorName || form.body.length < 5} className="bg-gold-gradient text-navy-950" onClick={async () => { await importExternal({ tourId: form.tourId ? (form.tourId as Id<"tours">) : undefined, authorName: form.authorName, authorCountry: form.authorCountry || undefined, rating: form.rating, title: form.title || undefined, body: form.body, language: form.language, source: form.source, externalUrl: form.externalUrl || undefined, travelDate: form.travelDate || undefined }); setOpen(false); toast.success(t("imported")); }}>{t("save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
