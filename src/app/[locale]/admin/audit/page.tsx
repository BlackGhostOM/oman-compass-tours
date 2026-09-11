"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvButton, DateTime, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export default function AdminAuditPage() {
  const t = useTranslations("admin.audit");
  const [entity, setEntity] = useState("all");
  const rows = useQuery(api.admin.audit.list, { entityType: entity === "all" ? undefined : entity, limit: 500 });
  const notifications = useQuery(api.admin.audit.notifications, { limit: 300 });
  const dataRequests = useQuery(api.admin.audit.dataRequests);

  return (
    <div>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} actions={<CsvButton filename="audit-log.csv" rows={rows?.map((r) => ({ at: new Date(r.createdAt).toISOString(), actor: r.actorEmail ?? "", action: r.action, entity: r.entityType, entityId: r.entityId ?? "", before: JSON.stringify(r.before ?? null), after: JSON.stringify(r.after ?? null) }))} label={t("exportCsv")} />} />
      <Tabs defaultValue="audit">
        <TabsList><TabsTrigger value="audit">{t("tabs.audit")}</TabsTrigger><TabsTrigger value="notifications">{t("tabs.notifications")}</TabsTrigger><TabsTrigger value="data">{t("tabs.data")}</TabsTrigger></TabsList>
        <TabsContent value="audit" className="pt-4">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="mb-4 w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t("allEntities")}</SelectItem>{["bookings", "tours", "payments", "users", "leads", "reviews", "siteSettings", "policies", "coupons"].map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
          {rows === undefined ? <Skeleton className="h-96 rounded-xl" /> : rows.length === 0 ? <EmptyState title={t("empty")} /> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>{t("cols.when")}</TableHead><TableHead>{t("cols.actor")}</TableHead><TableHead>{t("cols.action")}</TableHead><TableHead>{t("cols.entity")}</TableHead><TableHead>{t("cols.change")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell><DateTime value={r.createdAt} /></TableCell>
                      <TableCell>{r.actorEmail ?? <span className="text-muted-foreground">system</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell className="font-mono text-xs">{r.entityType}{r.entityId ? `/${r.entityId.slice(-6)}` : ""}</TableCell>
                      <TableCell className="max-w-md truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{r.before !== undefined ? JSON.stringify(r.before) + " → " : ""}{r.after !== undefined ? JSON.stringify(r.after) : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="notifications" className="pt-4">
          {notifications === undefined ? <Skeleton className="h-64 rounded-xl" /> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>{t("cols.when")}</TableHead><TableHead>{t("cols.channel")}</TableHead><TableHead>{t("cols.template")}</TableHead><TableHead>{t("cols.to")}</TableHead><TableHead>{t("cols.status")}</TableHead></TableRow></TableHeader>
                <TableBody>{notifications.map((n) => <TableRow key={n._id}><TableCell><DateTime value={n.sentAt ?? n._creationTime} /></TableCell><TableCell>{n.channel}</TableCell><TableCell className="font-mono text-xs">{n.template}</TableCell><TableCell>{n.to}</TableCell><TableCell><StatusBadge status={n.status === "sent" ? "succeeded" : n.status === "skipped" ? "draft" : n.status} label={n.status} />{n.error && <div className="max-w-56 truncate text-xs text-danger">{n.error}</div>}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="data" className="pt-4">
          {dataRequests === undefined ? <Skeleton className="h-64 rounded-xl" /> : dataRequests.length === 0 ? <EmptyState title={t("noDataRequests")} /> : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4 text-sm">{dataRequests.map((r) => <li key={r._id} className="flex items-center gap-3 py-2"><DateTime value={r._creationTime} /><span className="flex-1">{r.userName ?? r.userEmail} · {r.type}</span><StatusBadge status={r.status === "processing" ? "pending" : r.status === "completed" ? "succeeded" : r.status === "rejected" ? "failed" : "pending"} label={r.status} /></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t("dataHint")}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
