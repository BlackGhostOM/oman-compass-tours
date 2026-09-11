import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { createEvent } from "ics";
import { api } from "../../../../../convex/_generated/api";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await fetchQuery(api.bookings.byToken, { token }).catch(() => null);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [y, m, d] = booking.date.split("-").map(Number);
  const [hh, mm] = (booking.startTime ?? "08:00").split(":").map(Number);
  const durationMinutes = booking.tour?.durationMinutes ?? 240;
  const days = booking.tour?.durationDays ?? 1;

  const { error, value } = createEvent({
    title: `${booking.tourTitle.en} — Oman Compass Tours (${booking.reference})`,
    description: [
      `Booking ${booking.reference}`,
      booking.tourTitle.ar,
      `Guests: ${booking.adults} adult(s), ${booking.children} child(ren), ${booking.infants} infant(s)`,
      `Pickup: ${booking.traveller.pickupLocation || booking.traveller.hotel || booking.tour?.meetingPoint?.label.en || "As agreed"}`,
      `Voucher: ${site.url}/api/voucher/${booking.voucherToken}`,
      `WhatsApp: ${site.phoneDisplay}`,
    ].join("\n"),
    location: booking.traveller.pickupLocation || booking.traveller.hotel || booking.tour?.meetingPoint?.label.en || "Muscat, Oman",
    start: [y, m, d, hh, mm],
    startInputType: "local",
    startOutputType: "local",
    ...(days > 1 ? { end: [y, m, d + days - 1, 18, 0] as [number, number, number, number, number] } : { duration: { minutes: Math.min(durationMinutes, 1439) } }),
    status: booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    organizer: { name: site.name, email: site.email },
    url: `${site.url}/en/booking/${booking.reference}?t=${booking.voucherToken}`,
    uid: `${booking.reference}@omancompasstours.com`,
    productId: "omancompasstours/booking",
    alarms: [{ action: "display", description: "Tour tomorrow — Oman Compass Tours", trigger: { hours: 24, before: true } }],
  });
  if (error || !value) return NextResponse.json({ error: "ics_failed" }, { status: 500 });

  // The ics library emits floating local times; declare Oman's zone for calendar apps.
  const withTz = value.replace("BEGIN:VEVENT", "BEGIN:VEVENT\r\nX-WR-TIMEZONE:Asia/Muscat");
  return new NextResponse(withTz, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="oman-compass-${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
