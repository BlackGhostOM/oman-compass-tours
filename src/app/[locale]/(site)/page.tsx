import { setRequestLocale } from "next-intl/server";
import { api } from "../../../../convex/_generated/api";
import { fetchPublic } from "@/lib/convex-server";
import { site } from "@/lib/site";
import { Hero } from "@/components/home/hero";
import { PromoBannerStrip } from "@/components/home/promo-banner";
import { FeaturedTours } from "@/components/home/featured-tours";
import { WhyUs } from "@/components/home/why-us";
import { DestinationsGrid } from "@/components/home/destinations-grid";
import { ReelsSection } from "@/components/home/reels";
import { ReviewsSection } from "@/components/home/reviews-section";
import { TrustStrip } from "@/components/home/trust-strip";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 300;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [content, featured, destinations, reviews, stats] = await Promise.all([
    fetchPublic(api.content.home, {}),
    fetchPublic(api.tours.featured, { limit: 8 }),
    fetchPublic(api.catalog.destinations, {}),
    fetchPublic(api.reviews.featured, { limit: 6 }),
    fetchPublic(api.reviews.stats, {}),
  ]);

  const reels = [1, 2, 3, 4].map((i) => ({
    posterUrl: `/media/placeholders/reel-${i}.jpg`,
    alt: { en: "Oman Compass Tours reel", ar: "مقطع من جولات بوصلة عُمان" },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: site.name,
    url: `${site.url}/${locale}`,
    logo: `${site.url}/brand/logo.png`,
    image: `${site.url}/og-default.jpg`,
    telephone: site.phoneE164,
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Office 07, Building 3888, Way 2555, Bawshar",
      addressLocality: "Muscat",
      addressCountry: "OM",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "07:30", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "07:30", closes: "19:30" },
    ],
    aggregateRating: { "@type": "AggregateRating", ratingValue: site.tripadvisor.rating, reviewCount: site.tripadvisor.reviewCount, bestRating: 5 },
    sameAs: Object.values(site.social),
    priceRange: "OMR 45 – OMR 790",
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Hero banner={content?.hero ?? null} videoUrl={content?.heroVideoUrl ?? null} posterUrl={content?.heroPosterUrl ?? "/media/placeholders/hero.jpg"} />
      <PromoBannerStrip promos={(content?.promos ?? []).map((b) => ({ _id: b._id, key: b.key, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, countdownTo: b.countdownTo, endsAt: b.endsAt }))} />
      <FeaturedTours tours={featured ?? []} />
      <WhyUs />
      <DestinationsGrid destinations={destinations ?? []} />
      <ReelsSection items={reels} />
      <ReviewsSection reviews={reviews ?? []} stats={stats} />
      <TrustStrip />
    </>
  );
}
