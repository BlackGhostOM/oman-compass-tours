/**
 * Company facts used across header, footer, About, Contact and JSON-LD.
 * Editable overrides live in the `siteSettings` table (admin → Settings).
 */
export const site = {
  name: "Oman Compass Tours Company",
  shortName: "Oman Compass Tours",
  nameAr: "شركة بوصلة عُمان للسياحة",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://omancompasstours.com",
  phoneDisplay: "+968 9225 5028",
  phoneE164: "+96892255028",
  whatsappNumber: "96892255028",
  whatsappUrl: "https://wa.me/96892255028",
  whatsappCatalogUrl: "https://wa.me/c/96892255028",
  email: "omancompasstours@gmail.com",
  licenseNumber: "1440944",
  licenseAuthority: {
    en: "Ministry of Heritage & Tourism, Sultanate of Oman",
    ar: "وزارة التراث والسياحة، سلطنة عُمان",
  },
  address: {
    en: "Office No. 07, Building No. 3888, Complex No. 225, Street No. 2555, Plot No. 70, Block AA42, Way No. 2555, Bawshar, Muscat, Sultanate of Oman",
    ar: "مكتب رقم 07، مبنى رقم 3888، مجمع رقم 225، شارع رقم 2555، قطعة رقم 70، مربع AA42، سكة رقم 2555، بوشر، مسقط، سلطنة عُمان",
    short: { en: "Bawshar, Muscat, Oman", ar: "بوشر، مسقط، عُمان" },
  },
  geo: { lat: 23.5773, lng: 58.4085 },
  mapsEmbedUrl:
    "https://www.google.com/maps?q=Oman+Compass+Tours,+Bawshar,+Muscat,+Oman&output=embed",
  mapsDirectionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=Oman+Compass+Tours+Bawshar+Muscat+Oman",
  hours: [
    { days: { en: "Monday", ar: "الاثنين" }, open: "07:30", close: "19:00" },
    { days: { en: "Tuesday – Sunday", ar: "الثلاثاء – الأحد" }, open: "07:30", close: "19:30" },
  ],
  timezone: "Asia/Muscat",
  tripadvisor: {
    url: "https://www.tripadvisor.com/Attraction_Review-g1940497-d26437481-Reviews-OMAN_COMPASS_TOURS-Muscat_Muscat_Governorate.html",
    rating: 5.0,
    reviewCount: 70,
    rank: { position: 1, of: 46 },
  },
  viatorUrl: "https://www.viator.com/tours/Muscat/",
  social: {
    instagram: "https://www.instagram.com/omancompasstours",
    snapchat: "https://www.snapchat.com/add/omancompasstours",
    tiktok: "https://www.tiktok.com/@omancompasstours",
    facebook: "https://www.facebook.com/omancompasstours",
    x: "https://x.com/omancompasstours",
    tripadvisor:
      "https://www.tripadvisor.com/Attraction_Review-g1940497-d26437481-Reviews-OMAN_COMPASS_TOURS-Muscat_Muscat_Governorate.html",
  },
  foundedYear: 2014,
} as const;

export type SiteLocale = "en" | "ar";

/** Builds a wa.me deep link with a pre-filled bilingual message. */
export function whatsappLink(message: string): string {
  return `${site.whatsappUrl}?text=${encodeURIComponent(message)}`;
}
