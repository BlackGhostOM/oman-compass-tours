"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowUp, ArrowDown, ImagePlus, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/navigation";
import { pick, type LocalizedString } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LocalizedField, LocalizedListField, PageHeader, Panel } from "@/components/admin/ui";

type TourDoc = Doc<"tours"> & { media: (Doc<"tourMedia"> & { url: string | null })[]; seasons: Doc<"pricingSeasons">[]; availability: Doc<"availability">[]; addOns: Doc<"addOns">[] };
type Itinerary = { time?: string; title: LocalizedString; body: LocalizedString };
type Faq = { question: LocalizedString; answer: LocalizedString };

const L = (en = "", ar = ""): LocalizedString => ({ en, ar });

function initial(t: TourDoc | null) {
  return {
    code: t?.code ?? "",
    kind: (t?.kind ?? "tour") as "tour" | "service",
    title: t?.title ?? L(),
    slug: t?.slug ?? L(),
    summary: t?.summary ?? L(),
    description: t?.description ?? L(),
    highlights: t?.highlights ?? [],
    itinerary: (t?.itinerary ?? []) as Itinerary[],
    inclusions: t?.inclusions ?? [],
    exclusions: t?.exclusions ?? [],
    faqs: (t?.faqs ?? []) as Faq[],
    categoryId: (t?.categoryId ?? "") as string,
    secondaryCategoryIds: (t?.secondaryCategoryIds ?? []) as string[],
    destinationIds: (t?.destinationIds ?? []) as string[],
    durationLabel: t?.durationLabel ?? L(),
    durationMinutes: t?.durationMinutes ?? 480,
    durationDays: t?.durationDays ?? 1,
    startTimes: (t?.startTimes ?? ["08:00"]).join(", "),
    meetingLabel: t?.meetingPoint?.label ?? L(),
    meetingAddress: t?.meetingPoint?.address ?? "",
    meetingLat: t?.meetingPoint?.lat?.toString() ?? "",
    meetingLng: t?.meetingPoint?.lng?.toString() ?? "",
    pickupIncluded: t?.pickupIncluded ?? true,
    guideLanguages: (t?.guideLanguages ?? ["en", "ar"]).join(", "),
    minGroup: t?.minGroup ?? 1,
    maxGroup: t?.maxGroup ?? 6,
    defaultCapacityPerSlot: t?.defaultCapacityPerSlot ?? 6,
    difficulty: (t?.difficulty ?? "easy") as "easy" | "moderate" | "challenging",
    pricingModel: (t?.pricingModel ?? "per_person") as "per_group" | "per_person",
    priceGroupOmr: t?.priceGroup ? t.priceGroup / 1000 : 0,
    priceAdultOmr: t?.priceAdult ? t.priceAdult / 1000 : 0,
    priceChildOmr: t?.priceChild ? t.priceChild / 1000 : 0,
    childAgeMax: t?.childAgeMax ?? 11,
    compareAtPriceFromOmr: t?.compareAtPriceFrom ? t.compareAtPriceFrom / 1000 : 0,
    depositPercent: t?.depositPercent ?? 100,
    freeCancellationHours: t?.freeCancellationHours ?? 24,
    allowReserveNowPayLater: t?.allowReserveNowPayLater ?? true,
    holdHours: t?.holdHours ?? 24,
    externalReviewCount: t?.externalReviewCount ?? 0,
    tripadvisorUrl: t?.tripadvisorUrl ?? "",
    viatorUrl: t?.viatorUrl ?? "",
    status: (t?.status ?? "draft") as "draft" | "published" | "archived",
    isFeatured: t?.isFeatured ?? false,
    featuredOrder: t?.featuredOrder ?? 0,
    tags: (t?.tags ?? []).join(", "),
    seoTitle: t?.seo?.title ?? L(),
    seoDescription: t?.seo?.description ?? L(),
    coverUrl: t?.coverImage?.url ?? "",
    videoUrl: t?.video?.url ?? "",
  };
}

export function TourEditor({ tour, categories, destinations }: { tour: TourDoc | null; categories: Doc<"categories">[]; destinations: Doc<"destinations">[] }) {
  const locale = useLocale();
  const t = useTranslations("admin.products.editor");
  const router = useRouter();
  const upsert = useMutation(api.admin.products.upsert);
  const addMedia = useMutation(api.admin.products.addMedia);
  const removeMedia = useMutation(api.admin.products.removeMedia);
  const reorderMedia = useMutation(api.admin.products.reorderMedia);
  const setCover = useMutation(api.admin.products.setCoverFromMedia);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const upsertSeason = useMutation(api.admin.products.upsertSeason);
  const removeSeason = useMutation(api.admin.products.removeSeason);
  const setAvailability = useMutation(api.admin.products.setAvailability);
  const clearAvailability = useMutation(api.admin.products.clearAvailability);
  const [f, setF] = useState(() => initial(tour));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [season, setSeason] = useState({ name: L(), startDate: "", endDate: "", priceAdultOmr: "", priceGroupOmr: "", priceChildOmr: "" });
  const [avail, setAvail] = useState({ date: "", startTime: "", capacity: "", isBlackout: false, note: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save(nextStatus?: "draft" | "published") {
    setBusy(true);
    try {
      const num = (x: string) => (x.trim() === "" ? undefined : Number(x));
      const id = await upsert({
        id: tour?._id,
        data: {
          code: f.code.trim(), kind: f.kind, title: f.title, slug: f.slug.en || f.slug.ar ? f.slug : undefined, summary: f.summary, description: f.description, highlights: f.highlights, itinerary: f.itinerary, inclusions: f.inclusions, exclusions: f.exclusions, faqs: f.faqs,
          categoryId: f.categoryId as Id<"categories">, secondaryCategoryIds: f.secondaryCategoryIds as Id<"categories">[], destinationIds: f.destinationIds as Id<"destinations">[],
          durationLabel: f.durationLabel, durationMinutes: f.durationMinutes, durationDays: f.durationDays, startTimes: f.startTimes.split(",").map((s) => s.trim()).filter(Boolean),
          meetingPoint: f.meetingLabel.en || f.meetingLabel.ar ? { label: f.meetingLabel, address: f.meetingAddress || undefined, lat: num(f.meetingLat), lng: num(f.meetingLng) } : undefined,
          pickupIncluded: f.pickupIncluded, guideLanguages: f.guideLanguages.split(",").map((s) => s.trim()).filter(Boolean), minGroup: f.minGroup, maxGroup: f.maxGroup, defaultCapacityPerSlot: f.defaultCapacityPerSlot, difficulty: f.difficulty,
          pricingModel: f.pricingModel, priceGroupOmr: f.priceGroupOmr || undefined, priceAdultOmr: f.priceAdultOmr || undefined, priceChildOmr: f.priceChildOmr || undefined, childAgeMax: f.childAgeMax, infantAgeMax: 2, compareAtPriceFromOmr: f.compareAtPriceFromOmr || undefined,
          depositPercent: f.depositPercent, freeCancellationHours: f.freeCancellationHours, allowReserveNowPayLater: f.allowReserveNowPayLater, holdHours: f.holdHours,
          coverImage: f.coverUrl ? { kind: "image", url: f.coverUrl, alt: f.title } : undefined, video: f.videoUrl ? { kind: "video", url: f.videoUrl, alt: f.title } : undefined,
          externalReviewCount: f.externalReviewCount || undefined, tripadvisorUrl: f.tripadvisorUrl || undefined, viatorUrl: f.viatorUrl || undefined,
          status: nextStatus ?? f.status, isFeatured: f.isFeatured, featuredOrder: f.isFeatured ? f.featuredOrder : undefined, tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean),
          seo: { title: f.seoTitle.en ? f.seoTitle : undefined, description: f.seoDescription.en ? f.seoDescription : undefined },
        },
      });
      toast.success(t("saved"));
      if (!tour) router.replace(`/admin/products/${id}`);
      else if (nextStatus) set("status", nextStatus);
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string; field?: string }) : undefined;
      toast.error(code?.code ? `${t("error")}: ${code.code}${code.field ? ` (${code.field})` : ""}` : t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || !tour) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        if (file.size > 100 * 1024 * 1024) { toast.warning(t("tooLarge", { name: file.name })); continue; }
        const url = await generateUploadUrl({ purpose: "media" });
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await addMedia({ tourId: tour._id, media: { kind: file.type.startsWith("video") ? "video" : "image", storageId, alt: f.title } });
      }
      toast.success(t("uploaded"));
    } catch {
      toast.error(t("error"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={f.code || t("newEyebrow")}
        title={tour ? pick(tour.title, locale) : t("newTitle")}
        actions={
          <>
            {tour && <Button asChild variant="outline" size="sm"><Link href={`/tours/${tour.slug.en}`} target="_blank">{t("preview")}</Link></Button>}
            <Button variant="outline" disabled={busy} onClick={() => save("draft")}>{t("saveDraft")}</Button>
            <Button disabled={busy} onClick={() => save("published")} className="bg-gold-gradient text-navy-950">{busy ? t("saving") : t("publish")}</Button>
          </>
        }
      />

      <Tabs defaultValue="content">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">{t("tabs.content")}</TabsTrigger>
          <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("tabs.pricing")}</TabsTrigger>
          <TabsTrigger value="media" disabled={!tour}>{t("tabs.media")}</TabsTrigger>
          <TabsTrigger value="availability" disabled={!tour}>{t("tabs.availability")}</TabsTrigger>
          <TabsTrigger value="seo">{t("tabs.seo")}</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-5 pt-4">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>{t("code")}</Label><Input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="OCT-011" /></div>
              <div className="space-y-1.5"><Label>{t("kind")}</Label><Select value={f.kind} onValueChange={(v) => set("kind", v as "tour" | "service")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tour">{t("kinds.tour")}</SelectItem><SelectItem value="service">{t("kinds.service")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("category")}</Label><Select value={f.categoryId} onValueChange={(v) => set("categoryId", v)}><SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c._id} value={c._id}>{pick(c.name, locale)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="mt-4 space-y-4">
              <LocalizedField label={t("titleField")} value={f.title} onChange={(v) => set("title", v)} required />
              <LocalizedField label={t("slug")} value={f.slug} onChange={(v) => set("slug", v)} />
              <LocalizedField label={t("summary")} value={f.summary} onChange={(v) => set("summary", v)} multiline rows={2} required />
              <LocalizedField label={t("description")} value={f.description} onChange={(v) => set("description", v)} multiline rows={8} required />
              <LocalizedListField label={t("highlights")} value={f.highlights} onChange={(v) => set("highlights", v)} addLabel={t("add")} />
              <LocalizedListField label={t("inclusions")} value={f.inclusions} onChange={(v) => set("inclusions", v)} addLabel={t("add")} />
              <LocalizedListField label={t("exclusions")} value={f.exclusions} onChange={(v) => set("exclusions", v)} addLabel={t("add")} />
            </div>
          </Panel>
          <Panel title={t("itinerary")}>
            <div className="space-y-4">
              {f.itinerary.map((day, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input className="w-28" placeholder="08:00 / Day 1" value={day.time ?? ""} onChange={(e) => set("itinerary", f.itinerary.map((d, j) => (j === i ? { ...d, time: e.target.value } : d)))} />
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="icon-sm" className="text-danger" onClick={() => set("itinerary", f.itinerary.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    <LocalizedField label={t("stepTitle")} value={day.title} onChange={(v) => set("itinerary", f.itinerary.map((d, j) => (j === i ? { ...d, title: v } : d)))} />
                    <LocalizedField label={t("stepBody")} value={day.body} onChange={(v) => set("itinerary", f.itinerary.map((d, j) => (j === i ? { ...d, body: v } : d)))} multiline rows={2} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("itinerary", [...f.itinerary, { time: "", title: L(), body: L() }])}><Plus className="size-4" /> {t("addStep")}</Button>
            </div>
          </Panel>
          <Panel title={t("faqs")}>
            <div className="space-y-4">
              {f.faqs.map((q, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex justify-end"><Button type="button" variant="ghost" size="icon-sm" className="text-danger" onClick={() => set("faqs", f.faqs.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>
                  <LocalizedField label={t("question")} value={q.question} onChange={(v) => set("faqs", f.faqs.map((x, j) => (j === i ? { ...x, question: v } : x)))} />
                  <div className="mt-2"><LocalizedField label={t("answer")} value={q.answer} onChange={(v) => set("faqs", f.faqs.map((x, j) => (j === i ? { ...x, answer: v } : x)))} multiline rows={2} /></div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("faqs", [...f.faqs, { question: L(), answer: L() }])}><Plus className="size-4" /> {t("addFaq")}</Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="details" className="space-y-5 pt-4">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <LocalizedField label={t("durationLabel")} value={f.durationLabel} onChange={(v) => set("durationLabel", v)} />
              <div className="space-y-1.5"><Label>{t("durationMinutes")}</Label><Input type="number" value={f.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("durationDays")}</Label><Input type="number" min={1} value={f.durationDays} onChange={(e) => set("durationDays", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("startTimes")}</Label><Input value={f.startTimes} onChange={(e) => set("startTimes", e.target.value)} placeholder="08:00, 14:00" dir="ltr" /></div>
              <div className="space-y-1.5"><Label>{t("guideLanguages")}</Label><Input value={f.guideLanguages} onChange={(e) => set("guideLanguages", e.target.value)} placeholder="en, ar" dir="ltr" /></div>
              <div className="space-y-1.5"><Label>{t("difficulty")}</Label><Select value={f.difficulty} onValueChange={(v) => set("difficulty", v as typeof f.difficulty)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">{t("difficulties.easy")}</SelectItem><SelectItem value="moderate">{t("difficulties.moderate")}</SelectItem><SelectItem value="challenging">{t("difficulties.challenging")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("minGroup")}</Label><Input type="number" min={1} value={f.minGroup} onChange={(e) => set("minGroup", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("maxGroup")}</Label><Input type="number" min={1} value={f.maxGroup} onChange={(e) => set("maxGroup", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("capacity")}</Label><Input type="number" min={1} value={f.defaultCapacityPerSlot} onChange={(e) => set("defaultCapacityPerSlot", Number(e.target.value))} /></div>
            </div>
            <div className="mt-4 flex items-center gap-3"><Switch checked={f.pickupIncluded} onCheckedChange={(v) => set("pickupIncluded", v)} id="pickup" /><Label htmlFor="pickup">{t("pickupIncluded")}</Label></div>
          </Panel>
          <Panel title={t("destinations")}>
            <div className="flex flex-wrap gap-3">
              {destinations.map((d) => (
                <label key={d._id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <Checkbox checked={f.destinationIds.includes(d._id)} onCheckedChange={(v) => set("destinationIds", v ? [...f.destinationIds, d._id] : f.destinationIds.filter((x) => x !== d._id))} /> {pick(d.name, locale)}
                </label>
              ))}
            </div>
            <p className="mt-4 mb-2 text-sm font-medium">{t("secondaryCategories")}</p>
            <div className="flex flex-wrap gap-3">
              {categories.filter((c) => c._id !== f.categoryId).map((c) => (
                <label key={c._id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <Checkbox checked={f.secondaryCategoryIds.includes(c._id)} onCheckedChange={(v) => set("secondaryCategoryIds", v ? [...f.secondaryCategoryIds, c._id] : f.secondaryCategoryIds.filter((x) => x !== c._id))} /> {pick(c.name, locale)}
                </label>
              ))}
            </div>
          </Panel>
          <Panel title={t("meetingPoint")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><LocalizedField label={t("meetingLabel")} value={f.meetingLabel} onChange={(v) => set("meetingLabel", v)} /></div>
              <div className="space-y-1.5"><Label>{t("address")}</Label><Input value={f.meetingAddress} onChange={(e) => set("meetingAddress", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Lat</Label><Input value={f.meetingLat} onChange={(e) => set("meetingLat", e.target.value)} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>Lng</Label><Input value={f.meetingLng} onChange={(e) => set("meetingLng", e.target.value)} dir="ltr" /></div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-5 pt-4">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5"><Label>{t("pricingModel")}</Label><Select value={f.pricingModel} onValueChange={(v) => set("pricingModel", v as typeof f.pricingModel)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="per_person">{t("perPerson")}</SelectItem><SelectItem value="per_group">{t("perGroup")}</SelectItem></SelectContent></Select></div>
              {f.pricingModel === "per_group" ? (
                <div className="space-y-1.5"><Label>{t("priceGroup")}</Label><Input type="number" step="0.001" value={f.priceGroupOmr} onChange={(e) => set("priceGroupOmr", Number(e.target.value))} /></div>
              ) : (
                <>
                  <div className="space-y-1.5"><Label>{t("priceAdult")}</Label><Input type="number" step="0.001" value={f.priceAdultOmr} onChange={(e) => set("priceAdultOmr", Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>{t("priceChild")}</Label><Input type="number" step="0.001" value={f.priceChildOmr} onChange={(e) => set("priceChildOmr", Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>{t("childAgeMax")}</Label><Input type="number" value={f.childAgeMax} onChange={(e) => set("childAgeMax", Number(e.target.value))} /></div>
                </>
              )}
              <div className="space-y-1.5"><Label>{t("compareAt")}</Label><Input type="number" step="0.001" value={f.compareAtPriceFromOmr} onChange={(e) => set("compareAtPriceFromOmr", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("deposit")}</Label><Input type="number" min={0} max={100} value={f.depositPercent} onChange={(e) => set("depositPercent", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("freeCancellation")}</Label><Input type="number" min={0} value={f.freeCancellationHours} onChange={(e) => set("freeCancellationHours", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>{t("holdHours")}</Label><Input type="number" min={1} value={f.holdHours} onChange={(e) => set("holdHours", Number(e.target.value))} /></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2"><Switch id="rnpl" checked={f.allowReserveNowPayLater} onCheckedChange={(v) => set("allowReserveNowPayLater", v)} /><Label htmlFor="rnpl">{t("allowPayLater")}</Label></div>
              <div className="flex items-center gap-2"><Switch id="feat" checked={f.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} /><Label htmlFor="feat">{t("featured")}</Label>{f.isFeatured && <Input type="number" className="w-20" value={f.featuredOrder} onChange={(e) => set("featuredOrder", Number(e.target.value))} />}</div>
            </div>
          </Panel>
          {tour && (
            <Panel title={t("seasons")}>
              <ul className="mb-4 divide-y divide-border text-sm">
                {tour.seasons.map((s) => (
                  <li key={s._id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{pick(s.name, locale)} · {s.startDate} → {s.endDate}</span>
                    <span dir="ltr" className="text-muted-foreground">{s.priceAdult ? `A ${s.priceAdult / 1000}` : ""} {s.priceChild ? `C ${s.priceChild / 1000}` : ""} {s.priceGroup ? `G ${s.priceGroup / 1000}` : ""}</span>
                    <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => removeSeason({ id: s._id })}><Trash2 className="size-4" /></Button>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2"><LocalizedField label={t("seasonName")} value={season.name} onChange={(v) => setSeason({ ...season, name: v })} /></div>
                <div className="space-y-1.5"><Label>{t("from")}</Label><Input type="date" value={season.startDate} onChange={(e) => setSeason({ ...season, startDate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("to")}</Label><Input type="date" value={season.endDate} onChange={(e) => setSeason({ ...season, endDate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{f.pricingModel === "per_group" ? t("priceGroup") : t("priceAdult")}</Label><Input type="number" step="0.001" value={f.pricingModel === "per_group" ? season.priceGroupOmr : season.priceAdultOmr} onChange={(e) => setSeason(f.pricingModel === "per_group" ? { ...season, priceGroupOmr: e.target.value } : { ...season, priceAdultOmr: e.target.value })} /></div>
                <div className="flex items-end"><Button size="sm" disabled={!season.startDate || !season.endDate} onClick={async () => { await upsertSeason({ tourId: tour._id, name: season.name, startDate: season.startDate, endDate: season.endDate, priceAdultOmr: season.priceAdultOmr ? Number(season.priceAdultOmr) : undefined, priceGroupOmr: season.priceGroupOmr ? Number(season.priceGroupOmr) : undefined, priceChildOmr: season.priceChildOmr ? Number(season.priceChildOmr) : undefined, isActive: true }); setSeason({ name: L(), startDate: "", endDate: "", priceAdultOmr: "", priceGroupOmr: "", priceChildOmr: "" }); toast.success(t("saved")); }}><Plus className="size-4" /> {t("add")}</Button></div>
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="media" className="space-y-5 pt-4">
          {tour && (
            <Panel title={t("gallery")} actions={<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"><ImagePlus className="size-4" /> {uploading ? t("uploading") : t("upload")}<input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => upload(e.target.files)} /></label>}>
              <p className="mb-3 text-xs text-muted-foreground">{t("galleryHint")}</p>
              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tour.media.map((m, i) => (
                  <li key={m._id} className="group relative overflow-hidden rounded-lg border border-border">
                    {m.media.kind === "video" ? <video src={m.url ?? undefined} className="aspect-[4/3] w-full object-cover" muted /> : <img src={m.url ?? ""} alt="" className="aspect-[4/3] w-full object-cover" />}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-navy-950/80 p-1">
                      <Button size="icon-xs" variant="ghost" className="text-sand-50" onClick={() => reorderMedia({ tourId: tour._id, orderedIds: [...tour.media.slice(0, Math.max(0, i - 1)).map((x) => x._id), m._id, ...tour.media.filter((_, j) => j !== i).slice(Math.max(0, i - 1)).map((x) => x._id)] })} aria-label="up"><ArrowUp className="size-3" /></Button>
                      <Button size="icon-xs" variant="ghost" className="text-sand-50" onClick={() => reorderMedia({ tourId: tour._id, orderedIds: [...tour.media.filter((_, j) => j !== i).slice(0, i + 1).map((x) => x._id), m._id, ...tour.media.filter((_, j) => j !== i).slice(i + 1).map((x) => x._id)] })} aria-label="down"><ArrowDown className="size-3" /></Button>
                      <Button size="icon-xs" variant="ghost" className="text-gold-400" onClick={() => setCover({ tourId: tour._id, mediaId: m._id }).then(() => toast.success(t("coverSet")))} aria-label="cover"><Star className="size-3" /></Button>
                      <Button size="icon-xs" variant="ghost" className="text-danger" onClick={() => removeMedia({ id: m._id })} aria-label="remove"><Trash2 className="size-3" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{t("coverUrl")}</Label><Input value={f.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} dir="ltr" placeholder="/media/placeholders/muscat.jpg" /></div>
                <div className="space-y-1.5"><Label>{t("videoUrl")}</Label><Input value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} dir="ltr" placeholder="https://…/tour.mp4" /></div>
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="availability" className="space-y-5 pt-4">
          {tour && (
            <Panel title={t("availabilityTitle")}>
              <p className="mb-3 text-xs text-muted-foreground">{t("availabilityHint", { capacity: tour.defaultCapacityPerSlot })}</p>
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="space-y-1.5"><Label>{t("date")}</Label><Input type="date" value={avail.date} onChange={(e) => setAvail({ ...avail, date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("time")}</Label><Select value={avail.startTime || "all"} onValueChange={(v) => setAvail({ ...avail, startTime: v === "all" ? "" : v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("allSlots")}</SelectItem>{tour.startTimes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>{t("capacity")}</Label><Input type="number" value={avail.capacity} onChange={(e) => setAvail({ ...avail, capacity: e.target.value })} /></div>
                <div className="flex items-end gap-2"><Switch id="bo" checked={avail.isBlackout} onCheckedChange={(v) => setAvail({ ...avail, isBlackout: v })} /><Label htmlFor="bo">{t("blackout")}</Label></div>
                <div className="space-y-1.5"><Label>{t("note")}</Label><Input value={avail.note} onChange={(e) => setAvail({ ...avail, note: e.target.value })} /></div>
                <div className="flex items-end"><Button size="sm" disabled={!avail.date} onClick={async () => { await setAvailability({ tourId: tour._id, date: avail.date, startTime: avail.startTime || undefined, capacity: avail.capacity ? Number(avail.capacity) : undefined, isBlackout: avail.isBlackout, note: avail.note || undefined }); toast.success(t("saved")); }}>{t("apply")}</Button></div>
              </div>
              <ul className="mt-4 divide-y divide-border text-sm">
                {tour.availability.sort((a, b) => a.date.localeCompare(b.date)).map((a) => (
                  <li key={a._id} className="flex items-center gap-3 py-2">
                    <span className="w-28" dir="ltr">{a.date}</span>
                    <span className="w-16" dir="ltr">{a.startTime ?? t("allSlots")}</span>
                    <span className="flex-1">{a.isBlackout ? <span className="text-danger">{t("blackout")}</span> : `${t("capacity")}: ${a.capacity} · ${t("booked")}: ${a.booked}`} {a.note ? `· ${a.note}` : ""}</span>
                    <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => clearAvailability({ id: a._id })}><Trash2 className="size-4" /></Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="seo" className="space-y-5 pt-4">
          <Panel>
            <div className="space-y-4">
              <LocalizedField label={t("seoTitle")} value={f.seoTitle} onChange={(v) => set("seoTitle", v)} />
              <LocalizedField label={t("seoDescription")} value={f.seoDescription} onChange={(v) => set("seoDescription", v)} multiline rows={2} />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>{t("tags")}</Label><Input value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="desert, 4x4" dir="ltr" /></div>
                <div className="space-y-1.5"><Label>Tripadvisor URL</Label><Input value={f.tripadvisorUrl} onChange={(e) => set("tripadvisorUrl", e.target.value)} dir="ltr" /></div>
                <div className="space-y-1.5"><Label>{t("externalReviews")}</Label><Input type="number" value={f.externalReviewCount} onChange={(e) => set("externalReviewCount", Number(e.target.value))} /></div>
              </div>
              <div className="space-y-1.5"><Label>Viator URL</Label><Input value={f.viatorUrl} onChange={(e) => set("viatorUrl", e.target.value)} dir="ltr" /></div>
              <Textarea readOnly rows={3} className="font-mono text-xs" dir="ltr" value={`/${locale}/tours/${f.slug.en || "…"}\nschema.org/TouristTrip + Offer + FAQPage generated automatically.`} />
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
