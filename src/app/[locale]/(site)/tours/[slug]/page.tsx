import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Clock, Languages, MapPin, ShieldCheck, Users, X } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { fetchPublic } from "@/lib/convex-server";
import { decodeSlug, pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { MediaGallery } from "@/components/tours/media-gallery";
import { ItineraryAccordion } from "@/components/tours/itinerary-accordion";
import { FaqAccordion } from "@/components/tours/faq-accordion";
import { BookPanel, MobileBookBar } from "@/components/tours/book-panel";
import { ShareButtons } from "@/components/tours/share-buttons";
import { WishlistButton } from "@/components/account/wishlist-button";
import { RatingStars } from "@/components/tours/rating-stars";
import { ReviewCard } from "@/components/tours/review-card";
import { TourCard } from "@/components/tours/tour-card";
import { AvailabilityPreview } from "@/components/tours/availability-preview";
import { MapEmbed } from "@/components/shared/map-embed";
import { JsonLd } from "@/components/shared/json-ld";
import { CompassPoint } from "@/components/brand/compass-rose";

export const revalidate = 300;

type Props = { params: Promise<{ locale: "en" | "ar"; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = await fetchPublic(api.tours.bySlug, { slug: decodeSlug(slug), locale });
  if (!tour) return {};
  const title = pick(tour.seo?.title ?? tour.title, locale);
  const description = pick(tour.seo?.description ?? tour.summary, locale);
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/tours/${pick(tour.slug, locale)}`,
      languages: { en: `/en/tours/${tour.slug.en}`, ar: `/ar/tours/${tour.slug.ar}` },
    },
    openGraph: { title, description, images: [{ url: tour.seo?.ogImageUrl ?? tour.coverImage?.url ?? "/og-default.jpg" }] },
  };
}

export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = await fetchPublic(api.tours.bySlug, { slug: decodeSlug(slug), locale });
  if (!tour) notFound();

  const t = await getTranslations("tour");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  const title = pick(tour.title, locale);
  const path = `/tours/${pick(tour.slug, locale)}`;
  const reviewsTotal = tour.ratingCount + (tour.externalReviewCount ?? 0);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: title,
      description: pick(tour.summary, locale),
      image: tour.gallery.map((g) => (g.url?.startsWith("http") ? g.url : `${site.url}${g.url}`)),
      touristType: tour.kind === "service" ? "Transfer" : "Private tour",
      itinerary: {
        "@type": "ItemList",
        itemListElement: tour.itinerary.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: pick(d.title, locale), description: pick(d.body, locale) })),
      },
      provider: { "@type": "TravelAgency", name: site.name, url: site.url, telephone: site.phoneE164 },
      offers: {
        "@type": "Offer",
        price: (tour.priceFrom / 1000).toFixed(3),
        priceCurrency: "OMR",
        availability: "https://schema.org/InStock",
        url: `${site.url}/${locale}${path}`,
        validFrom: new Date().toISOString().slice(0, 10),
      },
      ...(tour.ratingAverage > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: tour.ratingAverage, reviewCount: Math.max(reviewsTotal, 1), bestRating: 5 } }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tour.faqs.map((f) => ({ "@type": "Question", name: pick(f.question, locale), acceptedAnswer: { "@type": "Answer", text: pick(f.answer, locale) } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${site.url}/${locale}` },
        { "@type": "ListItem", position: 2, name: tn("tours"), item: `${site.url}/${locale}/tours` },
        { "@type": "ListItem", position: 3, name: title },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="surface-sand pt-24 pb-24 lg:pb-16">
        <div className="container-brand">
          <Breadcrumb className="mb-5">
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/">{tn("home")}</Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator className="rtl-flip" />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/tours">{tn("tours")}</Link></BreadcrumbLink></BreadcrumbItem>
              {tour.category && (
                <>
                  <BreadcrumbSeparator className="rtl-flip" />
                  <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/tours?category=${tour.category.key}`}>{pick(tour.category.name, locale)}</Link></BreadcrumbLink></BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator className="rtl-flip" />
              <BreadcrumbItem><BreadcrumbPage className="line-clamp-1">{title}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                {tour.category && <Badge className="bg-navy-950 text-gold-400">{pick(tour.category.name, locale)}</Badge>}
                {tour.destinations.map((d) => (
                  <Link key={d.key} href={`/destinations/${pick(d.slug, locale)}`}>
                    <Badge variant="outline" className="border-gold-500/50 text-ink-500 hover:bg-gold-500/10">
                      <MapPin className="size-3" /> {pick(d.name, locale)}
                    </Badge>
                  </Link>
                ))}
                {tour.tags.includes("price-placeholder") && <Badge variant="outline" className="border-warning text-warning">{t("pricePlaceholder")}</Badge>}
              </div>
              <h1 className="heading-brand mt-3 font-heading text-3xl leading-tight text-navy-950 sm:text-4xl">{title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
                {tour.ratingAverage > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <RatingStars rating={tour.ratingAverage} size="md" />
                    <span className="font-semibold text-ink-900">{tour.ratingAverage.toFixed(1)}</span>
                    <span>({tc("reviews", { count: reviewsTotal })})</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-gold-500" /> {pick(tour.durationLabel, locale)}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-gold-500" /> {t("privateUpTo", { count: tour.maxGroup })}</span>
                <span className="inline-flex items-center gap-1.5"><Languages className="size-4 text-gold-500" /> {tour.guideLanguages.map((l) => (l === "ar" ? "العربية" : "English")).join(" · ")}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <WishlistButton tourId={tour._id} className="bg-navy-950 text-sand-50" />
              <ShareButtons title={title} path={path} />
            </div>
          </div>

          <MediaGallery className="mt-6" items={tour.gallery.length ? tour.gallery : tour.coverImage ? [tour.coverImage] : []} title={title} />

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
            <div className="min-w-0 space-y-12">
              {/* Overview */}
              <section>
                <h2 className="font-heading text-2xl text-navy-950">{t("overview")}</h2>
                <div className="hairline mt-3 w-16" />
                <div className="mt-4 space-y-4 text-ink-500 leading-relaxed">
                  {pick(tour.description, locale).split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>

              {/* Highlights */}
              <section>
                <h2 className="font-heading text-2xl text-navy-950">{t("highlights")}</h2>
                <div className="hairline mt-3 w-16" />
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {tour.highlights.map((h, i) => (
                    <li key={i} className="flex gap-3 rounded-lg border border-sand-200 bg-white px-4 py-3 text-sm text-ink-900">
                      <CompassPoint point={(["N", "E", "S", "W"] as const)[i % 4]} className="mt-1" />
                      {pick(h, locale)}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Itinerary */}
              <section>
                <h2 className="font-heading text-2xl text-navy-950">{tour.durationDays > 1 ? t("itineraryDays") : t("itinerary")}</h2>
                <div className="hairline mt-3 w-16" />
                <div className="mt-2">
                  <ItineraryAccordion items={tour.itinerary} />
                </div>
              </section>

              {/* Inclusions / Exclusions */}
              <section className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-sand-200 bg-white p-5">
                  <h3 className="font-heading text-lg text-navy-950">{t("included")}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-ink-900">
                    {tour.inclusions.map((x, i) => (
                      <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> {pick(x, locale)}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white p-5">
                  <h3 className="font-heading text-lg text-navy-950">{t("excluded")}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-ink-500">
                    {tour.exclusions.map((x, i) => (
                      <li key={i} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-danger/70" /> {pick(x, locale)}</li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Pricing table */}
              <section>
                <h2 className="font-heading text-2xl text-navy-950">{t("pricing")}</h2>
                <div className="hairline mt-3 w-16" />
                <div className="mt-4 overflow-x-auto rounded-xl border border-sand-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-sand-100 text-start text-ink-500">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">{t("priceType")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("priceOmr")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("priceUsd")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200">
                      {tour.pricingModel === "per_group" ? (
                        <PriceRow label={t("privateGroup", { count: tour.maxGroup })} baisa={tour.priceGroup ?? tour.priceFrom} locale={locale} />
                      ) : (
                        <>
                          <PriceRow label={tc("perAdult")} baisa={tour.priceAdult ?? tour.priceFrom} locale={locale} />
                          {tour.priceChild ? <PriceRow label={`${tc("perChild")} (${t("ages", { min: (tour.infantAgeMax ?? 2) + 1, max: tour.childAgeMax ?? 11 })})`} baisa={tour.priceChild} locale={locale} /> : null}
                          <tr><td className="px-4 py-3">{t("infants", { max: tour.infantAgeMax ?? 2 })}</td><td className="px-4 py-3 text-success" colSpan={2}>{t("free")}</td></tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-ink-500">{t("pricingNote")}</p>
              </section>

              {/* Availability */}
              <section>
                <h2 className="font-heading text-2xl text-navy-950">{t("availability")}</h2>
                <div className="hairline mt-3 w-16" />
                <div className="mt-4">
                  <AvailabilityPreview tourId={tour._id} slug={pick(tour.slug, locale)} />
                </div>
              </section>

              {/* Meeting point */}
              {tour.meetingPoint && (
                <section>
                  <h2 className="font-heading text-2xl text-navy-950">{t("meetingPoint")}</h2>
                  <div className="hairline mt-3 w-16" />
                  <p className="mt-3 flex items-center gap-2 text-ink-900"><MapPin className="size-4 text-gold-500" /> {pick(tour.meetingPoint.label, locale)}</p>
                  {tour.pickupIncluded && <p className="mt-1 text-sm text-success"><ShieldCheck className="me-1 inline size-4" /> {t("pickupIncluded")}</p>}
                  <MapEmbed className="mt-4 h-72" title={pick(tour.meetingPoint.label, locale)} lat={tour.meetingPoint.lat} lng={tour.meetingPoint.lng} query={tour.meetingPoint.lat ? undefined : "Muscat, Oman"} />
                </section>
              )}

              {/* FAQs */}
              {tour.faqs.length > 0 && (
                <section>
                  <h2 className="font-heading text-2xl text-navy-950">{t("faqs")}</h2>
                  <div className="hairline mt-3 w-16" />
                  <div className="mt-2"><FaqAccordion items={tour.faqs} /></div>
                </section>
              )}

              {/* Reviews */}
              <section>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-heading text-2xl text-navy-950">{t("reviews")}</h2>
                  {tour.tripadvisorUrl && (
                    <a href={tour.tripadvisorUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-gold-600 underline-offset-4 hover:underline">
                      {t("readOnTripadvisor")}
                    </a>
                  )}
                </div>
                <div className="hairline mt-3 w-16" />
                {tour.reviews.length ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {tour.reviews.map((r) => (
                      <ReviewCard key={String(r._id)} review={r} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-500">{t("noReviewsYet")}</p>
                )}
              </section>
            </div>

            {/* Sticky panel */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <BookPanel tour={tour} />
              </div>
            </div>
          </div>

          {/* Related */}
          {tour.related.length > 0 && (
            <section className="mt-16">
              <h2 className="font-heading text-2xl text-navy-950">{t("related")}</h2>
              <div className="hairline mt-3 w-16" />
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {tour.related.map((r) => (
                  <TourCard key={r._id} tour={r} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <MobileBookBar tour={tour} />
    </>
  );
}

function PriceRow({ label, baisa, locale }: { label: string; baisa: number; locale: string }) {
  const omr = new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", { style: "currency", currency: "OMR", minimumFractionDigits: 3 }).format(baisa / 1000);
  const usd = new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((baisa / 1000) * 2.6008);
  return (
    <tr>
      <td className="px-4 py-3 text-ink-900">{label}</td>
      <td className="px-4 py-3 font-semibold text-navy-950" dir="ltr">{omr}</td>
      <td className="px-4 py-3 text-ink-500" dir="ltr">≈ {usd}</td>
    </tr>
  );
}
