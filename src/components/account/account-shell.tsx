"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { CalendarCheck, CreditCard, Gift, Heart, MessagesSquare, ShieldCheck, Star, UserRound, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";

const items: NavItem[] = [
  { key: "bookings", href: "/account", Icon: CalendarCheck, exact: true },
  { key: "payments", href: "/account/payments", Icon: CreditCard },
  { key: "profile", href: "/account/profile", Icon: UserRound },
  { key: "travellers", href: "/account/travellers", Icon: Users },
  { key: "wishlist", href: "/account/wishlist", Icon: Heart },
  { key: "reviews", href: "/account/reviews", Icon: Star },
  { key: "messages", href: "/account/messages", Icon: MessagesSquare },
  { key: "loyalty", href: "/account/loyalty", Icon: Gift },
  { key: "privacy", href: "/account/privacy", Icon: ShieldCheck },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("account");
  const claim = useMutation(api.bookings.claimGuestBookings);
  // Attach any guest bookings made with this email before signing up
  useEffect(() => {
    void claim({}).catch(() => {});
  }, [claim]);
  return (
    <DashboardShell items={items} namespace="account.nav" title={t("title")}>
      {children}
    </DashboardShell>
  );
}
