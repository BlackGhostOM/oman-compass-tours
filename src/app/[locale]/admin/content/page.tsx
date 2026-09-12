"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { pick, type LocalizedString } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CsvButton, DateTime, LocalizedField, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const L = (en = "", ar = ""): LocalizedString => ({ en, ar });

/* ---------------- Hero & banners ---------------- */
function BannersTab() {
  const t = useTranslations("admin.content.banners");
  const locale = useLocale();
  const banners = useQuery(api.admin.content.banners);
  const settings = useQuery(api.admin.settings.all);
  const upsert = useMutation(api.admin.content.upsertBanner);
  const remove = useMutation(api.admin.content.removeBanner);
  const setSetting = useMutation(api.admin.settings.set);
  const [editing, setEditing] = useState<Partial<Doc<"banners">> | null>(null);
  const [heroVideo, setHeroVideo] = useState<string | null>(null);
  const [heroPoster, setHeroPoster] = useState<string | null>(null);

  const video = heroVideo ?? String(settings?.settings["home.heroVideoUrl"] ?? "");
  const poster = heroPoster ?? String(settings?.settings["home.heroPosterUrl"] ?? "");

  return (
    <div className="space-y-5">
      <Panel title={t("heroMedia")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>{t("videoUrl")}</Label><Input value={video} onChange={(e) => setHeroVideo(e.target.value)} dir="ltr" placeholder="https://…/hero.mp4 (muted autoplay)" /></div>
          <div className="space-y-1.5"><Label>{t("posterUrl")}</Label><Input value={poster} onChange={(e) => setHeroPoster(e.target.value)} dir="ltr" /></div>
        </div>
        <Button size="sm" className="mt-3 bg-gold-gradient text-navy-950" onClick={async () => { await setSetting({ key: "home.heroVideoUrl", value: video }); await setSetting({ key: "home.heroPosterUrl", value: poster }); toast.success(t("saved")); }}>{t("save")}</Button>
      </Panel>
      <Panel title={t("title")} actions={<Button size="sm" variant="outline" onClick={() => setEditing({ key: "", placement: "home_promo", title: L(), subtitle: L(), ctaLabel: L(), ctaHref: "/tours", order: 0, isActive: true })}><Plus className="size-4" /> {t("add")}</Button>}>
        <ul className="divide-y divide-border text-sm">
          {banners?.map((b) => (
            <li key={b._id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-mono text-xs">{b.key}</span>
              <span className="flex-1">{pick(b.title, locale)}</span>
              <span className="text-xs text-muted-foreground">{b.placement}</span>
              <StatusBadge status={b.isActive ? "published" : "draft"} label={b.isActive ? t("active") : t("inactive")} />
              <Button size="xs" variant="outline" onClick={() => setEditing(b)}>{t("edit")}</Button>
              <Button size="icon-xs" variant="ghost" className="text-danger" onClick={() => remove({ id: b._id })}><Trash2 className="size-3" /></Button>
            </li>
          ))}
        </ul>
        {editing && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>{t("key")}</Label><Input value={editing.key ?? ""} onChange={(e) => setEditing({ ...editing, key: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("placement")}</Label><Select value={editing.placement ?? "home_promo"} onValueChange={(v) => setEditing({ ...editing, placement: v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="home_hero">home_hero</SelectItem><SelectItem value="home_promo">home_promo</SelectItem><SelectItem value="tours_top">tours_top</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("ctaHref")}</Label><Input value={editing.ctaHref ?? ""} onChange={(e) => setEditing({ ...editing, ctaHref: e.target.value })} dir="ltr" /></div>
            </div>
            <LocalizedField label={t("bannerTitle")} value={editing.title ?? L()} onChange={(v) => setEditing({ ...editing, title: v })} />
            <LocalizedField label={t("subtitle")} value={editing.subtitle ?? L()} onChange={(v) => setEditing({ ...editing, subtitle: v })} multiline rows={2} />
            <LocalizedField label={t("ctaLabel")} value={editing.ctaLabel ?? L()} onChange={(v) => setEditing({ ...editing, ctaLabel: v })} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>{t("imageUrl")}</Label><Input value={editing.media?.url ?? ""} onChange={(e) => setEditing({ ...editing, media: { kind: "image", url: e.target.value, alt: editing.title ?? L() } })} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>{t("countdown")}</Label><Input type="datetime-local" value={editing.countdownTo ? new Date(editing.countdownTo).toISOString().slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, countdownTo: e.target.value ? new Date(e.target.value).getTime() : undefined })} /></div>
              <div className="flex items-end gap-2"><Switch checked={editing.isActive ?? true} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} /><Label>{t("active")}</Label></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { await upsert({ id: editing._id, key: editing.key ?? "banner", placement: editing.placement ?? "home_promo", title: editing.title, subtitle: editing.subtitle, ctaLabel: editing.ctaLabel, ctaHref: editing.ctaHref, media: editing.media, countdownTo: editing.countdownTo, order: editing.order ?? 0, startsAt: editing.startsAt, endsAt: editing.endsAt, isActive: editing.isActive ?? true }); setEditing(null); toast.success(t("saved")); }}>{t("save")}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Blog ---------------- */
function BlogTab() {
  const t = useTranslations("admin.content.blog");
  const locale = useLocale();
  const posts = useQuery(api.admin.content.posts);
  const upsert = useMutation(api.admin.content.upsertPost);
  const remove = useMutation(api.admin.content.removePost);
  const [editing, setEditing] = useState<Partial<Doc<"blogPosts">> | null>(null);
  return (
    <Panel title={t("title")} actions={<Button size="sm" variant="outline" onClick={() => setEditing({ title: L(), slug: L(), excerpt: L(), body: L(), category: "planning", tags: [], authorName: "Oman Compass Tours", status: "draft" })}><Plus className="size-4" /> {t("add")}</Button>}>
      <ul className="divide-y divide-border text-sm">
        {posts?.map((p) => (
          <li key={p._id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1 font-medium">{pick(p.title, locale)}</span>
            <span className="text-xs text-muted-foreground">{p.category} · {p.readingMinutes} min</span>
            <StatusBadge status={p.status} />
            <DateTime value={p.updatedAt} withTime={false} />
            <Button size="xs" variant="outline" onClick={() => setEditing(p)}>{t("edit")}</Button>
            <Button size="icon-xs" variant="ghost" className="text-danger" onClick={() => remove({ id: p._id })}><Trash2 className="size-3" /></Button>
          </li>
        ))}
      </ul>
      {editing && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <LocalizedField label={t("postTitle")} value={editing.title ?? L()} onChange={(v) => setEditing({ ...editing, title: v })} required />
          <LocalizedField label={t("slug")} value={editing.slug ?? L()} onChange={(v) => setEditing({ ...editing, slug: v })} />
          <LocalizedField label={t("excerpt")} value={editing.excerpt ?? L()} onChange={(v) => setEditing({ ...editing, excerpt: v })} multiline rows={2} />
          <LocalizedField label={t("body")} value={editing.body ?? L()} onChange={(v) => setEditing({ ...editing, body: v })} multiline rows={12} />
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>{t("category")}</Label><Select value={editing.category ?? "planning"} onValueChange={(v) => setEditing({ ...editing, category: v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["planning", "guides", "culture", "news"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("tags")}</Label><Input value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} dir="ltr" /></div>
            <div className="space-y-1.5"><Label>{t("author")}</Label><Input value={editing.authorName ?? ""} onChange={(e) => setEditing({ ...editing, authorName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t("coverUrl")}</Label><Input value={editing.cover?.url ?? ""} onChange={(e) => setEditing({ ...editing, cover: { kind: "image", url: e.target.value, alt: editing.title ?? L() } })} dir="ltr" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => { await upsert({ id: editing._id, title: editing.title!, slug: editing.slug, excerpt: editing.excerpt!, body: editing.body!, cover: editing.cover, category: editing.category ?? "planning", tags: editing.tags ?? [], authorName: editing.authorName ?? "", status: "draft" }); setEditing(null); toast.success(t("saved")); }}>{t("saveDraft")}</Button>
            <Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { await upsert({ id: editing._id, title: editing.title!, slug: editing.slug, excerpt: editing.excerpt!, body: editing.body!, cover: editing.cover, category: editing.category ?? "planning", tags: editing.tags ?? [], authorName: editing.authorName ?? "", status: "published" }); setEditing(null); toast.success(t("saved")); }}>{t("publish")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("cancel")}</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Team ---------------- */
function ReelsTab() {
  const t = useTranslations("admin.content.reels");
  const locale = useLocale();
  const reels = useQuery(api.admin.reels.list);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const add = useMutation(api.admin.reels.add);
  const update = useMutation(api.admin.reels.update);
  const reorder = useMutation(api.admin.reels.reorder);
  const remove = useMutation(api.admin.reels.remove);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { caption: LocalizedString; href: string }>>({});

  async function upload(file: File): Promise<Id<"_storage">> {
    const url = await generateUploadUrl({ purpose: "media" });
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function addVideo(file: File) {
    if (!file.type.startsWith("video/")) return toast.error(t("notVideo"));
    if (file.size > 100 * 1024 * 1024) return toast.error(t("tooLarge"));
    setBusy("add");
    try {
      const storageId = await upload(file);
      await add({ storageId });
      toast.success(t("uploaded"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
    }
  }

  async function addPoster(id: Id<"banners">, file: File) {
    if (!file.type.startsWith("image/")) return toast.error(t("notImage"));
    setBusy(`poster-${id}`);
    try {
      const posterStorageId = await upload(file);
      await update({ id, posterStorageId });
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!reels) return;
    const ids = reels.map((r) => r._id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await reorder({ orderedIds: ids });
  };

  return (
    <div className="space-y-4">
      <Panel title={t("title")} actions={
        <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gold-gradient px-3 py-1.5 text-sm font-medium text-navy-950", busy === "add" && "pointer-events-none opacity-60")}>
          <Upload className="size-4" /> {busy === "add" ? t("uploading") : t("upload")}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={busy === "add"} onChange={(e) => { const f = e.target.files?.[0]; if (f) void addVideo(f); e.target.value = ""; }} />
        </label>
      }>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {reels === undefined ? null : reels.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {reels.map((r, i) => {
              const d = drafts[r._id] ?? { caption: r.caption ?? { en: "", ar: "" }, href: r.href ?? "" };
              return (
                <li key={r._id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="relative aspect-[9/16] bg-navy-950">
                    {r.url && <video src={r.url} poster={r.posterUrl ?? undefined} muted playsInline preload="metadata" controls className="h-full w-full object-cover" />}
                    {!r.isActive && <span className="absolute start-2 top-2 rounded bg-navy-950/80 px-2 py-0.5 text-[11px] text-sand-50">{t("hidden")}</span>}
                  </div>
                  <div className="space-y-3 p-3">
                    <LocalizedField label={t("caption")} value={d.caption} onChange={(v) => setDrafts({ ...drafts, [r._id]: { ...d, caption: v } })} />
                    <div className="space-y-1.5"><Label>{t("link")}</Label><Input dir="ltr" placeholder="https://www.instagram.com/reel/…" value={d.href} onChange={(e) => setDrafts({ ...drafts, [r._id]: { ...d, href: e.target.value } })} /></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={async () => { await update({ id: r._id, caption: d.caption, href: d.href }); toast.success(t("saved")); }}>{t("save")}</Button>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                        <ImagePlus className="size-3.5" /> {busy === `poster-${r._id}` ? t("uploading") : t("poster")}
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addPoster(r._id, f); e.target.value = ""; }} />
                      </label>
                      <label className="ms-auto inline-flex items-center gap-1.5 text-xs"><Switch checked={r.isActive} onCheckedChange={(v) => update({ id: r._id, isActive: v })} /> {t("active")}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-xs" variant="ghost" aria-label={t("moveUp")} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label={t("moveDown")} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></Button>
                      <Button size="icon-xs" variant="ghost" className="ms-auto text-danger" aria-label={t("remove")} onClick={async () => { if (window.confirm(t("confirmRemove"))) { await remove({ id: r._id }); toast.success(t("removed")); } }}><Trash2 className="size-3.5" /></Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{pick(r.caption ?? { en: "", ar: "" }, locale) || t("noCaption")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function TeamTab() {
  const t = useTranslations("admin.content.team");
  const locale = useLocale();
  const team = useQuery(api.admin.content.team);
  const upsert = useMutation(api.admin.content.upsertTeamMember);
  const remove = useMutation(api.admin.content.removeTeamMember);
  const [editing, setEditing] = useState<Partial<Doc<"teamMembers">> | null>(null);
  return (
    <Panel title={t("title")} actions={<Button size="sm" variant="outline" onClick={() => setEditing({ name: L(), roleTitle: L(), bio: L(), languages: ["ar", "en"], order: (team?.length ?? 0) + 1, isActive: true })}><Plus className="size-4" /> {t("add")}</Button>}>
      <ul className="divide-y divide-border text-sm">
        {team?.map((m) => (
          <li key={m._id} className="flex items-center gap-3 py-2"><span className="flex-1 font-medium">{pick(m.name, locale)}</span><span className="text-muted-foreground">{pick(m.roleTitle, locale)}</span><Button size="xs" variant="outline" onClick={() => setEditing(m)}>{t("edit")}</Button><Button size="icon-xs" variant="ghost" className="text-danger" onClick={() => remove({ id: m._id })}><Trash2 className="size-3" /></Button></li>
        ))}
      </ul>
      {editing && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <LocalizedField label={t("name")} value={editing.name ?? L()} onChange={(v) => setEditing({ ...editing, name: v })} required />
          <LocalizedField label={t("role")} value={editing.roleTitle ?? L()} onChange={(v) => setEditing({ ...editing, roleTitle: v })} />
          <LocalizedField label={t("bio")} value={editing.bio ?? L()} onChange={(v) => setEditing({ ...editing, bio: v })} multiline rows={3} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>{t("photoUrl")}</Label><Input value={editing.photo?.url ?? ""} onChange={(e) => setEditing({ ...editing, photo: { kind: "image", url: e.target.value, alt: editing.name ?? L() } })} dir="ltr" /></div>
            <div className="space-y-1.5"><Label>{t("languages")}</Label><Input value={(editing.languages ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} dir="ltr" /></div>
            <div className="flex items-end gap-2"><Switch checked={editing.isActive ?? true} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} /><Label>{t("active")}</Label></div>
          </div>
          <div className="flex gap-2"><Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { await upsert({ id: editing._id, name: editing.name!, roleTitle: editing.roleTitle ?? L(), bio: editing.bio ?? L(), photo: editing.photo, languages: editing.languages ?? [], order: editing.order ?? 0, isActive: editing.isActive ?? true }); setEditing(null); toast.success(t("saved")); }}>{t("save")}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("cancel")}</Button></div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Coupons ---------------- */
function CouponsTab() {
  const t = useTranslations("admin.content.coupons");
  const locale = useLocale();
  const coupons = useQuery(api.admin.content.coupons);
  const upsert = useMutation(api.admin.content.upsertCoupon);
  const remove = useMutation(api.admin.content.removeCoupon);
  const [editing, setEditing] = useState<{ _id?: Id<"coupons">; code: string; name: LocalizedString; type: "percent" | "fixed"; value: number; minSubtotalOmr?: number; maxDiscountOmr?: number; startsAt?: number; endsAt?: number; usageLimit?: number; minGroupSize?: number; earlyBirdDays?: number; isActive: boolean } | null>(null);
  return (
    <Panel title={t("title")} actions={<Button size="sm" variant="outline" onClick={() => setEditing({ code: "", name: L(), type: "percent", value: 10, isActive: true })}><Plus className="size-4" /> {t("add")}</Button>}>
      <ul className="divide-y divide-border text-sm">
        {coupons?.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-mono font-medium">{c.code}</span>
            <span className="flex-1">{pick(c.name, locale)}</span>
            <span className="text-muted-foreground">{c.type === "percent" ? `${c.value}%` : `OMR ${c.value / 1000}`}</span>
            <span className="text-xs text-muted-foreground">{t("used", { count: c.usedCount })}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</span>
            <StatusBadge status={c.isActive ? "published" : "draft"} label={c.isActive ? t("active") : t("inactive")} />
            <Button size="xs" variant="outline" onClick={() => setEditing({ _id: c._id, code: c.code, name: c.name, type: c.type, value: c.type === "fixed" ? c.value / 1000 : c.value, minSubtotalOmr: c.minSubtotal ? c.minSubtotal / 1000 : undefined, maxDiscountOmr: c.maxDiscount ? c.maxDiscount / 1000 : undefined, startsAt: c.startsAt, endsAt: c.endsAt, usageLimit: c.usageLimit, minGroupSize: c.minGroupSize, earlyBirdDays: c.earlyBirdDays, isActive: c.isActive })}>{t("edit")}</Button>
            <Button size="icon-xs" variant="ghost" className="text-danger" onClick={() => remove({ id: c._id })}><Trash2 className="size-3" /></Button>
          </li>
        ))}
      </ul>
      {editing && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>{t("code")}</Label><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} dir="ltr" /></div>
            <div className="space-y-1.5"><Label>{t("type")}</Label><Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v as "percent" | "fixed" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="fixed">OMR</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("value")}</Label><Input type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>{t("usageLimit")}</Label><Input type="number" value={editing.usageLimit ?? ""} onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("minSubtotal")}</Label><Input type="number" value={editing.minSubtotalOmr ?? ""} onChange={(e) => setEditing({ ...editing, minSubtotalOmr: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("maxDiscount")}</Label><Input type="number" value={editing.maxDiscountOmr ?? ""} onChange={(e) => setEditing({ ...editing, maxDiscountOmr: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("minGroup")}</Label><Input type="number" value={editing.minGroupSize ?? ""} onChange={(e) => setEditing({ ...editing, minGroupSize: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("earlyBird")}</Label><Input type="number" value={editing.earlyBirdDays ?? ""} onChange={(e) => setEditing({ ...editing, earlyBirdDays: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("startsAt")}</Label><Input type="date" value={editing.startsAt ? new Date(editing.startsAt).toISOString().slice(0, 10) : ""} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value ? new Date(e.target.value).getTime() : undefined })} /></div>
            <div className="space-y-1.5"><Label>{t("endsAt")}</Label><Input type="date" value={editing.endsAt ? new Date(editing.endsAt).toISOString().slice(0, 10) : ""} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value ? new Date(e.target.value).getTime() + 86_399_000 : undefined })} /></div>
            <div className="flex items-end gap-2"><Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} /><Label>{t("active")}</Label></div>
          </div>
          <LocalizedField label={t("name")} value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
          <div className="flex gap-2"><Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { try { await upsert({ id: editing._id, code: editing.code, name: editing.name, type: editing.type, value: editing.value, minSubtotalOmr: editing.minSubtotalOmr, maxDiscountOmr: editing.maxDiscountOmr, startsAt: editing.startsAt, endsAt: editing.endsAt, usageLimit: editing.usageLimit, minGroupSize: editing.minGroupSize, earlyBirdDays: editing.earlyBirdDays, isActive: editing.isActive }); setEditing(null); toast.success(t("saved")); } catch { toast.error(t("error")); } }}>{t("save")}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("cancel")}</Button></div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Newsletter + SEO ---------------- */
function NewsletterTab() {
  const t = useTranslations("admin.content.newsletter");
  const subs = useQuery(api.admin.content.subscribers);
  const active = subs?.filter((s) => !s.unsubscribedAt);
  return (
    <Panel title={t("title")} actions={<CsvButton filename="newsletter.csv" rows={active?.map((s) => ({ email: s.email, locale: s.locale, source: s.source ?? "", subscribedAt: new Date(s.subscribedAt).toISOString() }))} label={t("exportCsv")} />}>
      <p className="text-sm text-muted-foreground">{t("count", { active: active?.length ?? 0, total: subs?.length ?? 0 })}</p>
      <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto text-sm">
        {active?.map((s) => <li key={s._id} className="flex items-center gap-3 py-1.5"><span className="flex-1">{s.email}</span><span className="text-xs uppercase text-muted-foreground">{s.locale}</span><DateTime value={s.subscribedAt} withTime={false} /></li>)}
      </ul>
    </Panel>
  );
}

function SeoTab() {
  const t = useTranslations("admin.content.seo");
  const rows = useQuery(api.admin.content.seo);
  const upsert = useMutation(api.admin.content.upsertSeo);
  const [path, setPath] = useState("/");
  const [title, setTitle] = useState(L());
  const [description, setDescription] = useState(L());
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-sm text-muted-foreground">{t("hint")}</p>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>{t("path")}</Label><Input value={path} onChange={(e) => setPath(e.target.value)} dir="ltr" placeholder="/about" /></div>
        <LocalizedField label={t("metaTitle")} value={title} onChange={setTitle} />
        <LocalizedField label={t("metaDescription")} value={description} onChange={setDescription} multiline rows={2} />
        <Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { await upsert({ path, seo: { title, description } }); toast.success(t("saved")); }}>{t("save")}</Button>
      </div>
      <ul className="mt-4 divide-y divide-border text-sm">{rows?.map((r) => <li key={r._id} className="flex items-center gap-3 py-1.5"><span className="font-mono text-xs">{r.path}</span><span className="flex-1 truncate">{r.seo.title?.en}</span><Button size="xs" variant="ghost" onClick={() => { setPath(r.path); setTitle(r.seo.title ?? L()); setDescription(r.seo.description ?? L()); }}>{t("edit")}</Button></li>)}</ul>
    </Panel>
  );
}

export default function AdminContentPage() {
  const t = useTranslations("admin.content");
  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      <Tabs defaultValue="banners">
        <TabsList className="flex-wrap">
          <TabsTrigger value="banners">{t("tabs.banners")}</TabsTrigger>
          <TabsTrigger value="reels">{t("tabs.reels")}</TabsTrigger>
          <TabsTrigger value="blog">{t("tabs.blog")}</TabsTrigger>
          <TabsTrigger value="team">{t("tabs.team")}</TabsTrigger>
          <TabsTrigger value="coupons">{t("tabs.coupons")}</TabsTrigger>
          <TabsTrigger value="newsletter">{t("tabs.newsletter")}</TabsTrigger>
          <TabsTrigger value="seo">{t("tabs.seo")}</TabsTrigger>
        </TabsList>
        <TabsContent value="banners" className="pt-4"><BannersTab /></TabsContent>
        <TabsContent value="reels" className="pt-4"><ReelsTab /></TabsContent>
        <TabsContent value="blog" className="pt-4"><BlogTab /></TabsContent>
        <TabsContent value="team" className="pt-4"><TeamTab /></TabsContent>
        <TabsContent value="coupons" className="pt-4"><CouponsTab /></TabsContent>
        <TabsContent value="newsletter" className="pt-4"><NewsletterTab /></TabsContent>
        <TabsContent value="seo" className="pt-4"><SeoTab /></TabsContent>
      </Tabs>
      <Textarea className="hidden" readOnly value="" />
    </div>
  );
}
