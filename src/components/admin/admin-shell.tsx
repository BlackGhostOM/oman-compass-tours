"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { BarChart3, CalendarCheck, CreditCard, FileText, Handshake, Inbox, LayoutDashboard, Map, MessageSquareWarning, Package, ScrollText, Settings, Star, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const viewer = useQuery(api.users.viewer);
  const stats = useQuery(api.admin.overview.stats, viewer && viewer.role !== "customer" ? {} : "skip");

  if (viewer === undefined) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!viewer || viewer.role === "customer") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 surface-sand p-8 text-center">
        <MessageSquareWarning className="size-12 text-warning" />
        <h1 className="font-heading text-2xl text-navy-950">{t("forbiddenTitle")}</h1>
        <p className="max-w-md text-ink-500">{t("forbiddenBody")}</p>
        <Button asChild><Link href="/account">{t("goToAccount")}</Link></Button>
      </div>
    );
  }

  const items: NavItem[] = [
    { key: "overview", href: "/admin", Icon: LayoutDashboard, exact: true },
    { key: "bookings", href: "/admin/bookings", Icon: CalendarCheck, badge: stats?.pendingPayment || undefined },
    { key: "products", href: "/admin/products", Icon: Package },
    { key: "customers", href: "/admin/customers", Icon: Users },
    { key: "leads", href: "/admin/leads", Icon: Map, badge: stats?.openLeads || undefined },
    { key: "partners", href: "/admin/partners", Icon: Handshake, badge: stats?.openPartners || undefined },
    { key: "inbox", href: "/admin/inbox", Icon: Inbox, badge: stats?.unreadInbox || undefined },
    { key: "reviews", href: "/admin/reviews", Icon: Star, badge: stats?.pendingReviews || undefined },
    { key: "content", href: "/admin/content", Icon: FileText },
    { key: "payments", href: "/admin/payments", Icon: CreditCard },
    { key: "reports", href: "/admin/reports", Icon: BarChart3 },
    { key: "settings", href: "/admin/settings", Icon: Settings },
    { key: "audit", href: "/admin/audit", Icon: ScrollText },
  ];

  return (
    <DashboardShell items={items} namespace="admin.nav" title={t("title")}>
      {children}
    </DashboardShell>
  );
}
