"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Copy, FileText, Trash2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { pick, type LocalizedString } from "@/lib/content";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, LocalizedField, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";

function useSetting<T>(settings: Record<string, unknown> | undefined, key: string, fallback: T): [T, (v: T) => void] {
  const [local, setLocal] = useState<T | null>(null);
  const stored = settings?.[key] as T | undefined;
  // Object settings are merged over their defaults so newly added fields still get a fallback value.
  const merged = stored && typeof stored === "object" && !Array.isArray(stored) && fallback && typeof fallback === "object" ? ({ ...(fallback as object), ...(stored as object) } as T) : stored;
  const value = (local ?? merged ?? fallback) as T;
  return [value, setLocal];
}

function CompanyTab({ settings }: { settings: Record<string, unknown> }) {
  const t = useTranslations("admin.settings.company");
  const set = useMutation(api.admin.settings.set);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setProfilePdf = useMutation(api.admin.settings.setProfilePdf);
  const [pdfBusy, setPdfBusy] = useState(false);
  const storedPdfUrl = typeof settings["company.profilePdfUrl"] === "string" ? (settings["company.profilePdfUrl"] as string) : "";
  async function uploadProfilePdf(file: File) {
    if (file.type !== "application/pdf") return toast.error(t("profileNotPdf"));
    if (file.size > 20 * 1024 * 1024) return toast.error(t("profileTooLarge"));
    setPdfBusy(true);
    try {
      const url = await generateUploadUrl({ purpose: "media" });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setProfilePdf({ storageId });
      toast.success(t("profileUploaded"));
    } catch {
      toast.error(t("profileUploadError"));
    } finally {
      setPdfBusy(false);
    }
  }
  const [info, setInfo] = useSetting<Record<string, string>>(settings, "company.info", { name: site.name, nameAr: site.nameAr, phone: site.phoneDisplay, whatsapp: site.whatsappNumber, email: site.email, license: site.licenseNumber, vat: "", addressEn: site.address.en, addressAr: site.address.ar, instagram: site.social.instagram, tiktok: site.social.tiktok, snapchat: site.social.snapchat, facebook: site.social.facebook, x: site.social.x, profilePdfUrl: "" });
  const f = (k: keyof typeof info, label: string, dir?: "ltr" | "rtl") => <div className="space-y-1.5"><Label>{label}</Label><Input value={info[k] ?? ""} dir={dir} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} /></div>;
  return (
    <Panel title={t("title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {f("name", t("name"), "ltr")}{f("nameAr", t("nameAr"), "rtl")}{f("phone", t("phone"), "ltr")}{f("whatsapp", t("whatsapp"), "ltr")}{f("email", t("email"), "ltr")}{f("license", t("license"), "ltr")}{f("vat", t("vat"), "ltr")}{f("profilePdfUrl", t("profilePdf"), "ltr")}
        <div className="space-y-1.5 sm:col-span-2"><Label>{t("addressEn")}</Label><Textarea dir="ltr" rows={2} value={info.addressEn} onChange={(e) => setInfo({ ...info, addressEn: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>{t("addressAr")}</Label><Textarea dir="rtl" rows={2} value={info.addressAr} onChange={(e) => setInfo({ ...info, addressAr: e.target.value })} /></div>
        {f("instagram", "Instagram", "ltr")}{f("tiktok", "TikTok", "ltr")}{f("snapchat", "Snapchat", "ltr")}{f("facebook", "Facebook", "ltr")}{f("x", "X", "ltr")}
      </div>
      <Button size="sm" className="mt-4 bg-gold-gradient text-navy-950" onClick={async () => { await set({ key: "company.info", value: info }); await set({ key: "company.profilePdfUrl", value: info.profilePdfUrl }); toast.success(t("saved")); }}>{t("save")}</Button>
      <p className="mt-2 text-xs text-muted-foreground">{t("note")}</p>
      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
        <p className="font-medium text-foreground">{t("profileTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("profileHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-medium text-navy-950", pdfBusy && "pointer-events-none opacity-60")}>
            <Upload className="size-4" /> {pdfBusy ? t("profileUploading") : t("profileUpload")}
            <input type="file" accept="application/pdf" className="sr-only" disabled={pdfBusy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadProfilePdf(file); e.target.value = ""; }} />
          </label>
          {storedPdfUrl ? (
            <>
              <Button asChild size="sm" variant="outline"><a href={storedPdfUrl} target="_blank" rel="noopener noreferrer"><FileText className="size-4" /> {t("profileCurrent")}</a></Button>
              <Button size="sm" variant="ghost" className="text-danger" disabled={pdfBusy} onClick={async () => { await setProfilePdf({}); toast.success(t("profileRemoved")); }}><Trash2 className="size-4" /> {t("profileRemove")}</Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t("profileNone")}</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

function BookingTab({ settings }: { settings: Record<string, unknown> }) {
  const t = useTranslations("admin.settings.booking");
  const set = useMutation(api.admin.settings.set);
  const [holdHours, setHold] = useSetting<number>(settings, "booking.holdHoursDefault", 24);
  const [reminder, setReminder] = useSetting<number>(settings, "booking.reminderHoursBefore", 24);
  const [abandoned, setAbandoned] = useSetting<number>(settings, "booking.abandonedDraftReminderHours", 3);
  const [sla, setSla] = useSetting<number>(settings, "leads.slaMinutes", 60);
  const [hours, setHours] = useSetting<{ start: string; end: string; timezone: string }>(settings, "chat.onlineHours", { start: "07:30", end: "19:30", timezone: "Asia/Muscat" });
  const [eta, setEta] = useSetting<number>(settings, "chat.expectedResponseMinutes", 10);
  return (
    <Panel title={t("title")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label>{t("holdHours")}</Label><Input type="number" value={holdHours} onChange={(e) => setHold(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>{t("reminder")}</Label><Input type="number" value={reminder} onChange={(e) => setReminder(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>{t("abandoned")}</Label><Input type="number" value={abandoned} onChange={(e) => setAbandoned(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>{t("sla")}</Label><Input type="number" value={sla} onChange={(e) => setSla(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>{t("chatStart")}</Label><Input type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>{t("chatEnd")}</Label><Input type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>{t("eta")}</Label><Input type="number" value={eta} onChange={(e) => setEta(Number(e.target.value))} /></div>
      </div>
      <Button size="sm" className="mt-4 bg-gold-gradient text-navy-950" onClick={async () => { await Promise.all([set({ key: "booking.holdHoursDefault", value: holdHours }), set({ key: "booking.reminderHoursBefore", value: reminder }), set({ key: "booking.abandonedDraftReminderHours", value: abandoned }), set({ key: "leads.slaMinutes", value: sla }), set({ key: "chat.onlineHours", value: hours }), set({ key: "chat.expectedResponseMinutes", value: eta })]); toast.success(t("saved")); }}>{t("save")}</Button>
    </Panel>
  );
}

function PoliciesTab() {
  const t = useTranslations("admin.settings.policies");
  const locale = useLocale();
  const policies = useQuery(api.admin.settings.policies);
  const publish = useMutation(api.admin.settings.publishPolicyVersion);
  const [editing, setEditing] = useState<{ id: Id<"policies">; body: LocalizedString; note: string } | null>(null);
  if (!policies) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      {policies.map((p) => (
        <Panel key={p._id} title={`${pick(p.title, locale)} · v${p.versions[0]?.version ?? 0}`} actions={<Button size="sm" variant="outline" onClick={() => setEditing({ id: p._id, body: p.versions[0]?.body ?? { en: "", ar: "" }, note: "" })}>{t("newVersion")}</Button>}>
          <p className="text-xs text-muted-foreground">{t("required")}: {p.requiredAtCheckout ? "✓" : "✗"} · {t("versions")}: {p.versions.map((v) => `v${v.version}`).join(", ")} {p.versions[0] && <>· <DateTime value={p.versions[0].effectiveAt} /></>}</p>
          {editing?.id === p._id && (
            <div className="mt-3 space-y-3">
              <LocalizedField label={t("body")} value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} multiline rows={16} />
              <Input placeholder={t("changeNote")} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              <div className="flex gap-2"><Button size="sm" className="bg-gold-gradient text-navy-950" onClick={async () => { await publish({ policyId: p._id, body: editing.body, changeNote: editing.note || undefined }); setEditing(null); toast.success(t("published")); }}>{t("publish")}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("cancel")}</Button></div>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

function StaffTab() {
  const t = useTranslations("admin.settings.staff");
  const data = useQuery(api.admin.settings.staffUsers);
  const viewer = useQuery(api.users.viewer);
  const setRole = useMutation(api.admin.settings.setRole);
  const invite = useMutation(api.admin.settings.invite);
  const [email, setEmail] = useState("");
  const [role, setRoleNew] = useState<"staff" | "admin">("staff");
  const [link, setLink] = useState("");
  if (data === undefined) return <Skeleton className="h-64" />;
  return (
    <Panel title={t("title")}>
      <ul className="divide-y divide-border text-sm">
        {data.users.map((u) => (
          <li key={u._id} className="flex items-center gap-3 py-2">
            <span className="flex-1">{u.name ?? u.email}<span className="ms-2 text-xs text-muted-foreground">{u.email}</span></span>
            <Select value={u.role} disabled={u.role === "owner" || u._id === viewer?._id} onValueChange={(v) => setRole({ userId: u._id, role: v as "customer" | "staff" | "admin" | "owner" }).then(() => toast.success(t("updated"))).catch(() => toast.error(t("error")))}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="customer">customer</SelectItem><SelectItem value="staff">staff</SelectItem><SelectItem value="admin">admin</SelectItem><SelectItem value="owner">owner</SelectItem></SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="new.staff@omancompasstours.com" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <Select value={role} onValueChange={(v) => setRoleNew(v as "staff" | "admin")}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="staff">staff</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent></Select>
        <Button size="sm" disabled={!email} onClick={async () => { try { const r = await invite({ email, role }); setLink(r.token ? `${site.url}/en/sign-up?email=${encodeURIComponent(email)}&invite=${r.token}` : ""); toast.success(r.token ? t("invited") : t("roleSet")); setEmail(""); } catch { toast.error(t("error")); } }}>{t("invite")}</Button>
      </div>
      {link && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="truncate" dir="ltr">{link}</span><button type="button" onClick={() => navigator.clipboard.writeText(link)}><Copy className="size-3" /></button></p>}
      {data.invites.length > 0 && <ul className="mt-3 text-xs text-muted-foreground">{data.invites.map((i) => <li key={i._id}>{i.email} · {i.role} · {t("expires")} <DateTime value={i.expiresAt} /></li>)}</ul>}
    </Panel>
  );
}

function ProvidersTab({ providers, settings }: { providers: Record<string, boolean | string>; settings: Record<string, unknown> }) {
  const t = useTranslations("admin.settings.providers");
  const set = useMutation(api.admin.settings.set);
  const disabled = (settings["payments.disabledProviders"] as string[] | undefined) ?? [];
  const Row = ({ k, label, hint }: { k: string; label: string; hint?: string }) => (
    <li className="flex items-center gap-3 py-2 text-sm"><span className="flex-1">{label}{hint && <span className="ms-2 text-xs text-muted-foreground">{hint}</span>}</span>{providers[k] ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}<span className="w-28 text-xs text-muted-foreground">{providers[k] ? t("configured") : t("missing")}</span></li>
  );
  return (
    <div className="space-y-4">
      <Panel title={t("title")}>
        <p className="mb-2 text-xs text-muted-foreground">{t("hint")}</p>
        <ul className="divide-y divide-border">
          <Row k="thawani" label="Thawani" hint={`THAWANI_SECRET_KEY · THAWANI_PUBLISHABLE_KEY · ${String(providers.thawaniMode)}`} />
          <Row k="stripe" label="Stripe" hint="STRIPE_SECRET_KEY" />
          <Row k="stripeWebhook" label="Stripe webhook" hint="STRIPE_WEBHOOK_SECRET" />
          <Row k="paypal" label="PayPal" hint={`PAYPAL_CLIENT_ID · ${String(providers.paypalMode)}`} />
          <Row k="paypalWebhook" label="PayPal webhook" hint="PAYPAL_WEBHOOK_ID" />
          <Row k="resend" label="Resend (email)" hint="AUTH_RESEND_KEY" />
          <Row k="google" label="Google sign-in" hint="AUTH_GOOGLE_ID" />
          <Row k="anthropic" label="Claude AI assistant" hint="ANTHROPIC_API_KEY" />
          <Row k="turnstile" label="Cloudflare Turnstile" hint="TURNSTILE_SECRET_KEY" />
          <Row k="apiVerification" label={t("apiVerification")} hint="PAYMENTS_TRUST_API_VERIFICATION" />
        </ul>
      </Panel>
      <Panel title={t("toggles")}>
        {["thawani", "stripe", "paypal"].map((p) => (
          <div key={p} className="flex items-center justify-between py-2 text-sm capitalize"><span>{p}</span><Switch checked={!disabled.includes(p)} onCheckedChange={async (on) => { const next = on ? disabled.filter((x) => x !== p) : [...disabled, p]; await set({ key: "payments.disabledProviders", value: next }); toast.success(t("saved")); }} /></div>
        ))}
        <p className="text-xs text-muted-foreground">{t("webhookUrls")}: <code dir="ltr">{process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://<deployment>.convex.site"}/webhooks/(stripe|thawani|paypal)</code></p>
      </Panel>
    </div>
  );
}

function TemplatesTab({ settings }: { settings: Record<string, unknown> }) {
  const t = useTranslations("admin.settings.templates");
  const defaults = useQuery(api.admin.settings.notificationTemplates);
  const set = useMutation(api.admin.settings.set);
  const [local, setLocal] = useState<Record<string, LocalizedString> | null>(null);
  const value = local ?? ((settings["notifications.templates"] as Record<string, LocalizedString>) ?? defaults ?? {});
  if (!defaults) return <Skeleton className="h-64" />;
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("hint")}</p>
      <div className="space-y-4">
        {Object.keys(defaults).map((k) => <LocalizedField key={k} label={t(k)} value={value[k] ?? defaults[k]} onChange={(v) => setLocal({ ...value, [k]: v })} multiline rows={2} />)}
      </div>
      <Button size="sm" className="mt-4 bg-gold-gradient text-navy-950" onClick={async () => { await set({ key: "notifications.templates", value }); toast.success(t("saved")); }}>{t("save")}</Button>
    </Panel>
  );
}

function LanguagesTab({ settings }: { settings: Record<string, unknown> }) {
  const t = useTranslations("admin.settings.languages");
  const set = useMutation(api.admin.settings.set);
  const [numerals, setNumerals] = useSetting<string>(settings, "i18n.arabicNumerals", "eastern");
  const [hijri, setHijri] = useSetting<boolean>(settings, "i18n.showHijri", true);
  return (
    <Panel title={t("title")}>
      <ul className="mb-4 divide-y divide-border text-sm">
        <li className="flex items-center gap-3 py-2"><span className="flex-1">English (en) · LTR · default</span><StatusBadge status="published" label={t("active")} /></li>
        <li className="flex items-center gap-3 py-2"><span className="flex-1">العربية (ar) · RTL</span><StatusBadge status="published" label={t("active")} /></li>
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>{t("numerals")}</Label><Select value={numerals} onValueChange={setNumerals}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eastern">٠١٢٣ (Eastern Arabic)</SelectItem><SelectItem value="western">0123 (Western)</SelectItem></SelectContent></Select></div>
        <div className="flex items-end gap-2 pb-1"><Switch checked={hijri} onCheckedChange={setHijri} /><Label>{t("hijri")}</Label></div>
      </div>
      <Button size="sm" className="mt-4 bg-gold-gradient text-navy-950" onClick={async () => { await set({ key: "i18n.arabicNumerals", value: numerals }); await set({ key: "i18n.showHijri", value: hijri }); toast.success(t("saved")); }}>{t("save")}</Button>
      <p className="mt-3 text-xs text-muted-foreground">{t("addLanguage")}</p>
    </Panel>
  );
}

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const data = useQuery(api.admin.settings.all);
  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company">{t("tabs.company")}</TabsTrigger>
          <TabsTrigger value="booking">{t("tabs.booking")}</TabsTrigger>
          <TabsTrigger value="policies">{t("tabs.policies")}</TabsTrigger>
          <TabsTrigger value="staff">{t("tabs.staff")}</TabsTrigger>
          <TabsTrigger value="providers">{t("tabs.providers")}</TabsTrigger>
          <TabsTrigger value="templates">{t("tabs.templates")}</TabsTrigger>
          <TabsTrigger value="languages">{t("tabs.languages")}</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="pt-4"><CompanyTab settings={data.settings} /></TabsContent>
        <TabsContent value="booking" className="pt-4"><BookingTab settings={data.settings} /></TabsContent>
        <TabsContent value="policies" className="pt-4"><PoliciesTab /></TabsContent>
        <TabsContent value="staff" className="pt-4"><StaffTab /></TabsContent>
        <TabsContent value="providers" className="pt-4"><ProvidersTab providers={data.providers} settings={data.settings} /></TabsContent>
        <TabsContent value="templates" className="pt-4"><TemplatesTab settings={data.settings} /></TabsContent>
        <TabsContent value="languages" className="pt-4"><LanguagesTab settings={data.settings} /></TabsContent>
      </Tabs>
    </div>
  );
}
