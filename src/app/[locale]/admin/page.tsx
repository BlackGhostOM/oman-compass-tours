"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { ArrowRight, Phone } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatOmr, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniBars, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";

export default function AdminOverviewPage() {
  const locale = useLocale();
  const t = useTranslations("admin.overview");
  const stats = useQuery(api.admin.overview.stats);
  if (!stats) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const occupancyPct = stats.occupancy.capacity ? Math.round((stats.occupancy.booked / stats.occupancy.capacity) * 100) : 0;
  const conv = stats.funnel.drafts ? Math.round((stats.funnel.confirmed / stats.funnel.drafts) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={stats.today} title={t("title")} description={t("subtitle")} actions={<Button asChild className="bg-gold-gradient text-navy-950"><Link href="/admin/bookings?new=1">{t("newBooking")}</Link></Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("departuresToday")} value={stats.departuresToday.length} hint={t("tomorrow", { count: stats.departuresTomorrow })} tone="gold" />
        <StatCard label={t("newBookings")} value={stats.newBookings.day} hint={t("weekMonth", { week: stats.newBookings.week, month: stats.newBookings.month })} />
        <StatCard label={t("revenueToday")} value={formatOmr(stats.revenue.day, locale, { compact: true })} hint={`${t("week")}: ${formatOmr(stats.revenue.week, locale, { compact: true })} · ${t("month")}: ${formatOmr(stats.revenue.month, locale, { compact: true })}`} tone="success" />
        <StatCard label={t("occupancy")} value={`${occupancyPct}%`} hint={t("occupancyHint", { booked: stats.occupancy.booked, capacity: stats.occupancy.capacity })} />
        <StatCard label={t("pendingPayment")} value={stats.pendingPayment} tone={stats.pendingPayment ? "warning" : "default"} />
        <StatCard label={t("openLeads")} value={stats.openLeads} hint={stats.overdueLeads ? t("overdue", { count: stats.overdueLeads }) : undefined} tone={stats.overdueLeads ? "danger" : "default"} />
        <StatCard label={t("waitingChats")} value={stats.waitingChats} hint={t("unread", { count: stats.unreadInbox })} tone={stats.waitingChats ? "warning" : "default"} />
        <StatCard label={t("pendingReviews")} value={stats.pendingReviews} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("departuresTitle")} className="lg:col-span-2" actions={<Button asChild variant="ghost" size="sm"><Link href="/admin/bookings">{t("allBookings")} <ArrowRight className="size-4 rtl-flip" /></Link></Button>}>
          {stats.departuresToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDepartures")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.departuresToday.map((d) => (
                <li key={d._id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="w-12 font-heading text-gold-700 dark:text-gold-400" dir="ltr">{d.startTime ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/bookings/${d._id}`} className="font-medium text-foreground hover:text-gold-700">{pick(d.tourTitle, locale)}</Link>
                    <p className="text-xs text-muted-foreground">{d.reference} · {d.traveller} · {t("guests", { count: d.groupSize })}{d.pickup ? ` · ${d.pickup}` : ""}{d.guide ? ` · ${t("guide")}: ${d.guide}` : ""}</p>
                  </div>
                  <StatusBadge status={d.status} />
                  <Button asChild variant="ghost" size="icon-sm" aria-label="WhatsApp"><a href={`https://wa.me/${d.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"><Phone className="size-4 text-[#25D366]" /></a></Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("revenue14")}>
          <MiniBars data={stats.revenueSeries.map((d) => ({ label: d.date.slice(8), value: d.amount / 1000 }))} />
        </Panel>

        <Panel title={t("funnel")}>
          <dl className="space-y-2 text-sm">
            {([["drafts", stats.funnel.drafts], ["bookings", stats.funnel.bookings], ["confirmed", stats.funnel.confirmed], ["cancelled", stats.funnel.cancelled]] as const).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <dt className="w-24 text-muted-foreground">{t(`funnelKeys.${k}`)}</dt>
                <dd className="flex flex-1 items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gold-gradient" style={{ width: `${Math.min(100, (v / Math.max(1, stats.funnel.drafts)) * 100)}%` }} /></div><span className="w-8 text-end tabular-nums">{v}</span></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("conversion", { pct: conv })}</p>
        </Panel>

        <Panel title={t("topTours")} className="lg:col-span-2">
          {stats.topTours.length === 0 ? <p className="text-sm text-muted-foreground">{t("noData")}</p> : (
            <ol className="space-y-2 text-sm">
              {stats.topTours.map((tt, i) => (
                <li key={tt.tourId} className="flex items-center gap-3">
                  <span className="w-5 font-heading text-gold-700">{i + 1}</span>
                  <span className="flex-1 truncate">{pick(tt.title, locale)}</span>
                  <span className="text-muted-foreground">{t("bookingsCount", { count: tt.count })}</span>
                  <span className="w-28 text-end tabular-nums" dir="ltr">{formatOmr(tt.revenue, locale, { compact: true })}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
