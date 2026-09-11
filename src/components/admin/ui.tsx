"use client";

import { useLocale, useTranslations } from "next-intl";
import { Download, Plus, Trash2 } from "lucide-react";
import { formatOmr, type LocalizedString } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: React.ReactNode; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 font-heading text-2xl text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default", className }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "gold" | "success" | "warning" | "danger"; className?: string }) {
  const toneClass = { default: "text-foreground", gold: "text-gold-700 dark:text-gold-400", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-2xl", toneClass)} dir="ltr">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-heading text-foreground">{title}</p>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          {title && <h3 className="font-heading text-base text-foreground">{title}</h3>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

export function Money({ baisa, className }: { baisa: number; className?: string }) {
  const locale = useLocale();
  return <span dir="ltr" className={cn("tabular-nums", className)}>{formatOmr(baisa, locale)}</span>;
}

const statusTone: Record<string, string> = {
  inquiry: "bg-warning/15 text-warning",
  pending_payment: "bg-warning/15 text-warning",
  confirmed: "bg-success/15 text-success",
  in_progress: "bg-navy-950 text-gold-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-danger/15 text-danger",
  refunded: "bg-muted text-muted-foreground",
  succeeded: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  created: "bg-muted text-muted-foreground",
  failed: "bg-danger/15 text-danger",
  partially_refunded: "bg-warning/15 text-warning",
  new: "bg-gold-500/15 text-gold-700 dark:text-gold-400",
  contacted: "bg-navy-950/10 text-foreground",
  qualified: "bg-success/15 text-success",
  converted: "bg-success text-white",
  lost: "bg-muted text-muted-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success",
  archived: "bg-danger/15 text-danger",
  ai: "bg-gold-500/15 text-gold-700 dark:text-gold-400",
  waiting_human: "bg-warning/15 text-warning",
  human: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const t = useTranslations("admin.status");
  return <Badge className={cn("whitespace-nowrap", statusTone[status] ?? "bg-muted text-muted-foreground")}>{label ?? (t.has(status) ? t(status) : status)}</Badge>;
}

export function DateTime({ value, withTime = true }: { value: number | string; withTime?: boolean }) {
  const locale = useLocale();
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
  return <span className="whitespace-nowrap tabular-nums">{new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric", ...(withTime && typeof value === "number" ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(d)}</span>;
}

/* ------------------------------------------------------------------ */
/* Bilingual inputs                                                    */
/* ------------------------------------------------------------------ */

export function LocalizedField({ label, value, onChange, multiline = false, rows = 3, required }: { label: string; value: LocalizedString; onChange: (v: LocalizedString) => void; multiline?: boolean; rows?: number; required?: boolean }) {
  const Comp = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-danger"> *</span>}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <span className="pointer-events-none absolute end-2 top-1.5 text-[10px] font-semibold text-muted-foreground">EN</span>
          <Comp dir="ltr" value={value.en} rows={rows} onChange={(e) => onChange({ ...value, en: e.target.value })} className="pe-8" />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute start-2 top-1.5 text-[10px] font-semibold text-muted-foreground">AR</span>
          <Comp dir="rtl" value={value.ar} rows={rows} onChange={(e) => onChange({ ...value, ar: e.target.value })} className="ps-8 font-sans" />
        </div>
      </div>
    </div>
  );
}

export function LocalizedListField({ label, value, onChange, addLabel }: { label: string; value: LocalizedString[]; onChange: (v: LocalizedString[]) => void; addLabel: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Input dir="ltr" value={item.en} placeholder="EN" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
              <Input dir="rtl" value={item.ar} placeholder="AR" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} />
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="remove"><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { en: "", ar: "" }])}><Plus className="size-4" /> {addLabel}</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvButton({ filename, rows, label }: { filename: string; rows: Record<string, unknown>[] | undefined; label: string }) {
  return (
    <Button variant="outline" size="sm" disabled={!rows?.length} onClick={() => rows && downloadCsv(filename, rows)}>
      <Download className="size-4" /> {label}
    </Button>
  );
}

/** Minimal bar chart (no external deps). */
export function MiniBars({ data, className }: { data: { label: string; value: number }[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex h-28 items-end gap-1", className)} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      {data.map((d) => (
        <div key={d.label} className="group relative flex h-full flex-1 flex-col items-center justify-end">
          <div className="w-full rounded-t bg-gold-gradient transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} />
          <span className="mt-1 text-[9px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
