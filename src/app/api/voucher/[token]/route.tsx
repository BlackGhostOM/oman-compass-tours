import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import QRCode from "qrcode";
import path from "node:path";
import { Document, Font, Page, Text, View, Image as PdfImage, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { api } from "../../../../../convex/_generated/api";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Arabic-capable font for bilingual text (Helvetica has no Arabic glyphs)
Font.register({
  family: "Tajawal",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Tajawal-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "public", "fonts", "Tajawal-Bold.ttf"), fontWeight: "bold" },
  ],
});

const NAVY = "#0E0B2E";
const GOLD = "#C9A15C";
const SAND = "#F6EFE2";
const INK = "#1A1A2E";
const MUTED = "#5C5A6E";

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: INK, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: NAVY, padding: 20, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: GOLD, fontSize: 14, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  brandSub: { color: SAND, fontSize: 8, letterSpacing: 2, marginTop: 4 },
  ref: { color: SAND, fontSize: 9, textAlign: "right" },
  refCode: { color: GOLD, fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 2, textAlign: "right" },
  hairline: { height: 1, backgroundColor: GOLD, opacity: 0.5, marginVertical: 14 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  row: { flexDirection: "row", marginTop: 6 },
  label: { width: 120, color: MUTED },
  value: { flex: 1, color: INK },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  table: { marginTop: 6, borderTopWidth: 1, borderTopColor: "#EBE1CC" },
  tr: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#EBE1CC" },
  tdLabel: { flex: 1 },
  tdAmount: { width: 90, textAlign: "right" },
  total: { flexDirection: "row", marginTop: 6, paddingTop: 6 },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold", color: NAVY },
  totalAmount: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 12 },
  qrBox: { alignItems: "center", justifyContent: "center", padding: 8, borderWidth: 1, borderColor: "#EBE1CC", borderRadius: 8 },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, fontSize: 8, color: MUTED, textAlign: "center", lineHeight: 1.5 },
  badge: { backgroundColor: SAND, color: NAVY, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, fontSize: 8, alignSelf: "flex-start", marginTop: 6 },
  note: { fontSize: 9, color: MUTED, marginTop: 4, lineHeight: 1.4 },
});

const omr = (baisa: number) => `OMR ${(baisa / 1000).toFixed(3)}`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await fetchQuery(api.bookings.byToken, { token }).catch(() => null);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["confirmed", "in_progress", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "not_confirmed", status: booking.status }, { status: 409 });
  }

  const verifyUrl = `${site.url}/en/booking/${booking.reference}?t=${booking.voucherToken}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: NAVY, light: "#FFFFFF" } });
  const date = new Date(booking.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const guests = `${booking.adults} adult(s)${booking.children ? `, ${booking.children} child(ren)` : ""}${booking.infants ? `, ${booking.infants} infant(s)` : ""}`;

  const doc = (
    <Document title={`Voucher ${booking.reference}`} author={site.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>OMAN COMPASS TOURS</Text>
            <Text style={styles.brandSub}>COMPANY · MUSCAT · LICENCE 1440944</Text>
          </View>
          <View>
            <Text style={styles.ref}>BOOKING VOUCHER</Text>
            <Text style={styles.refCode}>{booking.reference}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.title}>{booking.tourTitle.en}</Text>
            <Text style={{ fontSize: 11, color: MUTED, marginTop: 4, fontFamily: "Tajawal" }}>{booking.tourTitle.ar}</Text>
            <Text style={styles.badge}>{booking.status.toUpperCase()}</Text>
            <View style={styles.hairline} />
            <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{date}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Start time</Text><Text style={styles.value}>{booking.startTime ?? "—"} (Oman time, UTC+4)</Text></View>
            <View style={styles.row}><Text style={styles.label}>Duration</Text><Text style={styles.value}>{booking.tour?.durationLabel.en ?? "—"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Guests</Text><Text style={styles.value}>{guests}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Lead traveller</Text><Text style={styles.value}>{booking.traveller.firstName} {booking.traveller.lastName} ({booking.traveller.nationality})</Text></View>
            <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{booking.traveller.phone}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Pickup</Text><Text style={styles.value}>{booking.traveller.pickupLocation || booking.traveller.hotel || booking.tour?.meetingPoint?.label.en || "As agreed"}</Text></View>
            {booking.traveller.specialRequests ? <View style={styles.row}><Text style={styles.label}>Requests</Text><Text style={styles.value}>{booking.traveller.specialRequests}</Text></View> : null}
          </View>
          <View style={{ width: 150 }}>
            <View style={styles.qrBox}>
              <PdfImage src={qr} style={{ width: 130, height: 130 }} />
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 4, textAlign: "center" }}>Scan to verify booking</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment summary</Text>
          <View style={styles.table}>
            {booking.items.map((it, i) => (
              <View key={i} style={styles.tr}>
                <Text style={styles.tdLabel}>{it.label.en}{it.quantity > 1 && it.kind !== "discount" ? ` × ${it.quantity}` : ""}</Text>
                <Text style={styles.tdAmount}>{omr(it.total)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.total}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalAmount}>{omr(booking.total)}</Text></View>
          <View style={styles.row}><Text style={styles.tdLabel}>Paid</Text><Text style={styles.tdAmount}>{omr(booking.amountPaid)}</Text></View>
          {booking.total - booking.amountPaid > 0 ? <View style={styles.row}><Text style={styles.tdLabel}>Balance due before departure</Text><Text style={styles.tdAmount}>{omr(booking.total - booking.amountPaid)}</Text></View> : null}
        </View>

        {booking.tour?.inclusions?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Included</Text>
            {booking.tour.inclusions.map((inc, i) => (
              <Text key={i} style={styles.note}>• {inc.en}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Good to know</Text>
          <Text style={styles.note}>Present this voucher (printed or on your phone) to your guide. Please be at the pickup point 5 minutes early; waiting time is limited to 20 minutes for tours.</Text>
          <Text style={styles.note}>{booking.tour && booking.tour.freeCancellationHours > 0 ? `Free cancellation up to ${booking.tour.freeCancellationHours} hours before the start time.` : "This booking is non-refundable."} Full terms: {site.url}/en/policies/cancellation</Text>
          <Text style={styles.note}>24/7 support: WhatsApp {site.phoneDisplay} · {site.email}</Text>
        </View>

        <Text style={styles.footer}>
          {site.name} · {site.address.en}{"\n"}Ministry of Heritage & Tourism licence no. {site.licenseNumber} · {site.url}
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="voucher-${booking.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
