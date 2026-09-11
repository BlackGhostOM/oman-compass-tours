"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { CalendarCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingCard } from "@/components/account/booking-card";

export default function AccountBookingsPage() {
  const t = useTranslations("account.bookings");
  const data = useQuery(api.account.myBookings);

  if (data === undefined) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-1 font-heading text-2xl text-foreground">{t("upcoming")}</h2>
          </div>
          <Button asChild className="bg-gold-gradient text-navy-950"><Link href="/tours">{t("bookAnother")}</Link></Button>
        </div>
        {data.upcoming.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <CalendarCheck className="size-10 text-gold-500" />
            <p className="font-heading text-foreground">{t("emptyUpcomingTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyUpcomingBody")}</p>
            <Button asChild variant="outline"><Link href="/tours">{t("browse")}</Link></Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {data.upcoming.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        )}
      </section>

      {data.past.length > 0 && (
        <section>
          <h2 className="font-heading text-xl text-foreground">{t("past")}</h2>
          <div className="mt-4 grid gap-4">
            {data.past.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
