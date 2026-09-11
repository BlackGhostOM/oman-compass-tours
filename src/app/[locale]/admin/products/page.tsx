"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { Copy, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, EmptyState, Money, PageHeader, StatusBadge } from "@/components/admin/ui";

export default function AdminProductsPage() {
  const locale = useLocale();
  const t = useTranslations("admin.products");
  const router = useRouter();
  const [status, setStatus] = useState<string>("all");
  const rows = useQuery(api.admin.products.list, { status: status === "all" ? undefined : (status as "draft" | "published" | "archived") });
  const setTourStatus = useMutation(api.admin.products.setStatus);
  const duplicate = useMutation(api.admin.products.duplicate);
  const importTours = useMutation(api.admin.products.importTours);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);

  async function doImport() {
    setBusy(true);
    try {
      const parsed = JSON.parse(importText) as { tours?: unknown[] } | unknown[];
      const list = Array.isArray(parsed) ? parsed : (parsed.tours ?? []);
      const r = await importTours({ tours: list });
      toast.success(t("imported", { created: r.created, updated: r.updated }));
      if (r.errors.length) toast.warning(r.errors.slice(0, 3).join("\n"));
      setImportOpen(false);
      setImportText("");
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
      <div className="mb-4 flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
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

      {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={tr._id}>
                  <TableCell className="font-mono text-xs">{tr.code}</TableCell>
                  <TableCell>
                    <Link href={`/admin/products/${tr._id}`} className="font-medium text-foreground hover:text-gold-700">{pick(tr.title, locale)}</Link>
                    <div className="text-xs text-muted-foreground">{tr.kind} {tr.isFeatured ? `· ${t("featured")}` : ""} {tr.tags.includes("price-placeholder") ? `· ${t("pricePlaceholder")}` : ""}</div>
                  </TableCell>
                  <TableCell>{tr.category ? pick(tr.category, locale) : "—"}</TableCell>
                  <TableCell className="text-end"><Money baisa={tr.priceFrom} /> <span className="text-xs text-muted-foreground">{tr.pricingModel === "per_group" ? t("perGroup") : t("perAdult")}</span></TableCell>
                  <TableCell>
                    <Select value={tr.status} onValueChange={(v) => setTourStatus({ id: tr._id, status: v as "draft" | "published" | "archived" }).then(() => toast.success(t("statusUpdated")))}>
                      <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="published">{t("statuses.published")}</SelectItem><SelectItem value="draft">{t("statuses.draft")}</SelectItem><SelectItem value="archived">{t("statuses.archived")}</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><DateTime value={tr.updatedAt} /></TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon-sm" aria-label={t("duplicate")} onClick={async () => { const id = await duplicate({ id: tr._id }); router.push(`/admin/products/${id}`); }}><Copy className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("import")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("importHint")}</p>
          <Textarea rows={14} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"tours": [ ... ]}' className="font-mono text-xs" dir="ltr" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t("cancel")}</Button>
            <Button disabled={busy || !importText.trim()} onClick={doImport} className="bg-gold-gradient text-navy-950">{busy ? t("importing") : t("runImport")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
