"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/content";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrivacyPage() {
  const locale = useLocale();
  const t = useTranslations("account.privacy");
  const convex = useConvex();
  const requests = useQuery(api.account.dataRequests);
  const request = useMutation(api.account.requestData);
  const [busy, setBusy] = useState(false);

  async function exportNow() {
    setBusy(true);
    try {
      const data = await convex.query(api.account.exportMyData, {});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oman-compass-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await request({ type: "export" });
      toast.success(t("exported"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (requests === undefined) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.rich("subtitle", { link: (c) => <Link href="/policies/privacy" className="text-gold-700 underline-offset-4 hover:underline">{c}</Link> })}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <Download className="size-6 text-gold-500" />
          <h3 className="mt-3 font-heading text-base text-foreground">{t("exportTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("exportBody")}</p>
          <Button onClick={exportNow} disabled={busy} className="mt-4 bg-gold-gradient text-navy-950">{t("exportCta")}</Button>
        </div>
        <div className="rounded-xl border border-danger/30 bg-card p-5">
          <Trash2 className="size-6 text-danger" />
          <h3 className="mt-3 font-heading text-base text-foreground">{t("deleteTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("deleteBody")}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" className="mt-4 border-danger/40 text-danger hover:bg-danger/10">{t("deleteCta")}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={async () => { await request({ type: "deletion" }); toast.success(t("deleteRequested")); }}>{t("deleteConfirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-heading text-base text-foreground"><ShieldCheck className="size-4 text-gold-500" /> {t("history")}</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {requests.map((r) => (
              <li key={String(r._id)} className="flex items-center justify-between py-2">
                <span>{t(`types.${r.type}`)} · {formatDate(r.createdAt, locale, "short")}</span>
                <Badge className={cn(r.status === "completed" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning")}>{t(`statuses.${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
