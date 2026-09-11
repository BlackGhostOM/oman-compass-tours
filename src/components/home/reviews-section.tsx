import { getTranslations } from "next-intl/server";
import { ExternalLink, Star } from "lucide-react";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { ReviewCard } from "@/components/tours/review-card";

type Review = {
  _id: unknown;
  authorName: string;
  authorCountry: string | null;
  rating: number;
  title: string | null;
  body: string;
  language: "en" | "ar";
  source: string;
  travelDate: string | null;
  staffReply: string | null;
};

export async function ReviewsSection({ reviews, stats }: { reviews: Review[]; stats: { count: number; average: number } | null }) {
  const t = await getTranslations("home.reviews");
  return (
    <section className="cv-auto surface-sand py-20 sm:py-24">
      <div className="container-brand">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-sand-200 bg-white p-5 sm:flex-row sm:gap-8">
          <div className="text-center">
            <div className="font-heading text-4xl text-navy-950">{site.tripadvisor.rating.toFixed(1)}</div>
            <div className="mt-1 flex justify-center gap-0.5 text-gold-500" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </div>
            <div className="mt-1 text-xs text-ink-500">{t("tripadvisor", { count: site.tripadvisor.reviewCount })}</div>
          </div>
          <div className="hairline-vertical hidden h-16 sm:block" />
          <div className="text-center text-sm text-ink-500">
            <p className="font-medium text-ink-900">{t("rank", { position: site.tripadvisor.rank.position, of: site.tripadvisor.rank.of })}</p>
            {stats && stats.count > 0 && <p className="mt-1">{t("siteStats", { count: stats.count, average: stats.average })}</p>}
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-gold-700">
              <a href={site.tripadvisor.url} target="_blank" rel="noopener noreferrer">
                {t("readReviews")} <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <ReviewCard key={String(r._id)} review={r} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-ink-500">{t("empty")}</p>
        )}
      </div>
    </section>
  );
}
