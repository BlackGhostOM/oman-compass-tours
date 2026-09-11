import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import path from "node:path";
import { Document, Font, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { api } from "../../../../../convex/_generated/api";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

Font.register({
  family: "Tajawal",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Tajawal-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "public", "fonts", "Tajawal-Bold.ttf"), fontWeight: "bold" },
  ],
});

const NAVY = "#0E0B2E";
const GOLD = "#C9A15C";
const MUTED = "#5C5A6E";
const INK = "#1A1A2E";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: INK },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { color: NAVY, fontSize: 14, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  meta: { fontSize: 9, color: MUTED, textAlign: "right", lineHeight: 1.5 },
  hairline: { height: 1, backgroundColor: GOLD, marginVertical: 16, opacity: 0.6 },
  section: { marginTop: 10 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  th: { flexDirection: "row", backgroundColor: "#F6EFE2", paddingVertical: 6, paddingHorizontal: 6, marginTop: 10 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#EBE1CC" },
  c1: { flex: 1 },
  c2: { width: 50, textAlign: "right" },
  c3: { width: 90, textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 12 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: MUTED, textAlign: "center", lineHeight: 1.5 },
  ar: { fontFamily: "Tajawal" },
});

const omr = (baisa: number) => `OMR ${(baisa / 1000).toFixed(3)}`;
const VAT_RATE = 0.05;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await fetchQuery(api.bookings.byToken, { token }).catch(() => null);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.amountPaid <= 0) return NextResponse.json({ error: "nothing_paid" }, { status: 409 });

  const paymentId = new URL(req.url).searchParams.get("p");
  const invoiceNo = `INV-${booking.reference}${paymentId ? `-${paymentId.slice(-4).toUpperCase()}` : ""}`;
  const issued = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const net = Math.round(booking.total / (1 + VAT_RATE));
  const vat = booking.total - net;

  const doc = (
    <Document title={invoiceNo} author={site.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>OMAN COMPASS TOURS</Text>
            <Text style={s.small}>{site.name}{"\n"}{site.address.en}{"\n"}Licence no. {site.licenseNumber} · {site.email} · {site.phoneDisplay}</Text>
          </View>
          <View>
            <Text style={s.h1}>TAX INVOICE</Text>
            <Text style={s.meta}>{invoiceNo}{"\n"}Issued {issued}{"\n"}Booking {booking.reference}</Text>
          </View>
        </View>
        <View style={s.hairline} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={s.label}>Billed to</Text>
            <Text style={{ marginTop: 3 }}>{booking.traveller.firstName} {booking.traveller.lastName}</Text>
            <Text style={s.small}>{booking.traveller.email}{"\n"}{booking.traveller.phone} · {booking.traveller.nationality}</Text>
          </View>
          <View>
            <Text style={s.label}>Service</Text>
            <Text style={{ marginTop: 3 }}>{booking.tourTitle.en}</Text>
            <Text style={[s.small, s.ar]}>{booking.tourTitle.ar}</Text>
            <Text style={s.small}>{booking.date} · {booking.startTime ?? ""}</Text>
          </View>
        </View>

        <View style={s.th}><Text style={[s.c1, s.label]}>Description</Text><Text style={[s.c2, s.label]}>Qty</Text><Text style={[s.c3, s.label]}>Amount</Text></View>
        {booking.items.map((it, i) => (
          <View key={i} style={s.tr}><Text style={s.c1}>{it.label.en}</Text><Text style={s.c2}>{it.kind === "discount" ? "" : it.quantity}</Text><Text style={s.c3}>{omr(it.total)}</Text></View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Net (excl. VAT)</Text><Text>{omr(net)}</Text></View>
          <View style={s.totalRow}><Text>VAT 5% (included)</Text><Text>{omr(vat)}</Text></View>
          <View style={s.totalRow}><Text style={s.grand}>Total</Text><Text style={s.grand}>{omr(booking.total)}</Text></View>
          <View style={s.totalRow}><Text>Paid</Text><Text>{omr(booking.amountPaid)}</Text></View>
          {booking.amountRefunded > 0 ? <View style={s.totalRow}><Text>Refunded</Text><Text>-{omr(booking.amountRefunded)}</Text></View> : null}
          <View style={s.totalRow}><Text>Balance</Text><Text>{omr(Math.max(0, booking.total - booking.amountPaid))}</Text></View>
        </View>

        <Text style={[s.small, { marginTop: 24 }]}>Prices are in Omani Rial. VAT is shown for information where applicable under Omani VAT law; the operator&apos;s VAT registration number, if any, will appear here once configured in Admin → Settings → Company. This document was generated electronically and is valid without a signature.</Text>

        <Text style={s.footer}>{site.name} · {site.url} · Thank you for travelling with us · <Text style={s.ar}>شكرًا لسفرك معنا</Text></Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoiceNo}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
