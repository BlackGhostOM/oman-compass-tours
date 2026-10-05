"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Archive, Copy, Eye, EyeOff, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, EmptyState, Money, PageHeader, StatusBadge } from "@/components/admin/ui";

type Status = "draft" | "published" | "archived";

export default function AdminProductsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.products");
  const router = useRouter();
  const [status, setStatus] = useState<string>("all");
  const rows = useQuery(api.admin.products.list, { status: status === "all" ? undefined : (status as Status) });
  const setTourStatus = useMutation(api.admin.products.setStatus);
  const setStatusMany = useMutation(api.admin.products.setStatusMany);
  const duplicate = useMutation(api.admin.products.duplicate);
  const importTours = useMutation(api.admin.products.importTours);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  /** Dry-run result: which codes the import would create or update, shown for confirmation before anything is written. */
  const [importPlan, setImportPlan] = useState<{ list: unknown[]; creates: string[]; updates: string[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<Id<"tours">>>(new Set());

  const visibleIds = rows?.map((r) => r._id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));
  const toggleOne = (id: Id<"tours">) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulk(next: Status) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const r = await setStatusMany({ ids: [...selected], status: next });
      toast.success(t("bulkDone", { count: r.changed }));
      if (r.unpriced.length) toast.warning(t("bulkUnpriced", { codes: r.unpriced.join(", ") }));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  /** Step 1: validate every row on the server without writing (dry run) and show what would change. */
  async function checkImport() {
    setBusy(true);
    try {
      const parsed = JSON.parse(importText) as { tours?: unknown[] } | unknown[];
      const list = Array.isArray(parsed) ? parsed : (parsed.tours ?? []);
      const r = await importTours({ tours: list, dryRun: true });
      setImportPlan({ list, creates: r.creates, updates: r.updates, errors: r.errors });
    } catch (err) {
      toast.error(`${t("importError")}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  /** Step 2: staff confirmed the plan; rows with errors are skipped again by the server. */
  async function doImport() {
    if (!importPlan) return;
    setBusy(true);
    try {
      const r = await importTours({ tours: importPlan.list });
      toast.success(t("imported", { created: r.created, updated: r.updated }));
      if (r.errors.length) toast.warning(r.errors.slice(0, 3).join("\n"));
      setImportOpen(false);
      setImportText("");
      setImportPlan(null);
    } catch (err) {
      toast.error(`${t("importError")}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" /> {t("import")}</Button>
            <Button asChild className="bg-gold-gradient text-navy-950"><Link href="/admin/products/new"><Plus className="size-4" /> {t("new")}</Link></Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setSelected(new Set()); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="published"><StatusBadge status="published" /></SelectItem>
            <SelectItem value="draft"><StatusBadge status="draft" /></SelectItem>
            <SelectItem value="archived"><StatusBadge status="archived" /></SelectItem>
          </SelectContent>
        </Select>
        <a href="/templates/tours-import-template.json" download className="text-sm text-gold-700 hover:underline">{t("templateJson")}</a>
        <a href="/templates/tours-import-template.csv" download className="text-sm text-gold-700 hover:underline">{t("templateCsv")}</a>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("visibilityHint")}</p>

      {/* Bulk visibility bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">{t("selected", { count: selected.size })}</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("published")}><Eye className="size-4" /> {t("bulkShow")}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("draft")}><EyeOff className="size-4" /> {t("bulkHide")}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("archived")}><Archive className="size-4" /> {t("bulkArchive")}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>{t("clearSelection")}</Button>
        </div>
      )}

      {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t("selectAll")} title={t("selectAll")} /></TableHead>
                <TableHead>{t("cols.code")}</TableHead>
                <TableHead>{t("cols.title")}</TableHead>
                <TableHead>{t("cols.category")}</TableHead>
                <TableHead className="text-end">{t("cols.priceFrom")}</TableHead>
                <TableHead>{t("cols.status")}</TableHead>
                <TableHead>{t("cols.updated")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tr) => (
                <TableRow key={tr._id} data-state={selected.has(tr._id) ? "selected" : undefined}>
                  <TableCell><Checkbox checked={selected.has(tr._id)} onCheckedChange={() => toggleOne(tr._id)} aria-label={pick(tr.title, locale)} /></TableCell>
                  <TableCell className="font-mono text-xs">{tr.code}</TableCell>
                  <TableCell>
                    <Link href={`/admin/products/${tr._id}`} className="font-medium text-foreground hover:text-gold-700">{pick(tr.title, locale)}</Link>
                    <div className="text-xs text-muted-foreground">{tr.kind} {tr.isFeatured ? `· ${t("featured")}` : ""} {tr.tags.includes("price-placeholder") ? `· ${t("pricePlaceholder")}` : ""}</div>
                  </TableCell>
                  <TableCell>{tr.category ? pick(tr.category, locale) : "—"}</TableCell>
                  <TableCell className="text-end"><Money baisa={tr.priceFrom} /> <span className="text-xs text-muted-foreground">{tr.pricingModel === "per_group" ? t("perGroup") : tr.pricingModel === "per_vehicle" ? t("perVehicle") : tr.pricingModel === "tiered" ? t("forFirstAdult") : t("perAdult")}</span></TableCell>
                  <TableCell>
                    <Select value={tr.status} onValueChange={(v) => setTourStatus({ id: tr._id, status: v as Status }).then(() => toast.success(t("statusUpdated"))).catch((err) => toast.error(err instanceof ConvexError && (err.data as { code?: string })?.code === "PRICE_MISSING" ? t("priceMissing") : String((err as Error).message)))}>
                      <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="published">{t("statuses.published")}</SelectItem><SelectItem value="draft">{t("statuses.draft")}</SelectItem><SelectItem value="archived">{t("statuses.archived")}</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><DateTime value={tr.updatedAt} /></TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon-sm" aria-label={t("duplicate")} title={t("duplicate")} onClick={async () => { const id = await duplicate({ id: tr._id }); router.push(`/admin/products/${id}`); }}><Copy className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportPlan(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("import")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("importHint")}</p>
          {importPlan === null ? (
            <>
              <Textarea rows={14} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"tours": [ ... ]}' className="max-h-[50vh] font-mono text-xs" dir="ltr" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>{t("cancel")}</Button>
                <Button disabled={busy || !importText.trim()} onClick={checkImport} className="bg-gold-gradient text-navy-950">{busy ? t("importing") : t("checkImport")}</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium">{t("importPlanTitle")}</p>
              {importPlan.updates.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                  <p>{t("importPlanUpdates", { count: importPlan.updates.length })}</p>
                  <p className="mt-1 font-mono text-xs" dir="ltr">{importPlan.updates.join(", ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("importPlanUpdatesHint")}</p>
                </div>
              )}
              {importPlan.creates.length > 0 && (
                <div className="rounded-md border border-border p-3">
                  <p>{t("importPlanCreates", { count: importPlan.creates.length })}</p>
                  <p className="mt-1 font-mono text-xs" dir="ltr">{importPlan.creates.join(", ")}</p>
                </div>
              )}
              {importPlan.errors.length > 0 && (
                <div className="rounded-md border border-danger/40 bg-danger/5 p-3">
                  <p className="text-danger">{t("importPlanErrors", { count: importPlan.errors.length })}</p>
                  <ul className="mt-1 max-h-40 list-disc overflow-y-auto ps-5 font-mono text-xs" dir="ltr">{importPlan.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportPlan(null)}>{t("importBack")}</Button>
                <Button disabled={busy || importPlan.creates.length + importPlan.updates.length === 0} onClick={doImport} className="bg-gold-gradient text-navy-950">{busy ? t("importing") : t("runImport")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
