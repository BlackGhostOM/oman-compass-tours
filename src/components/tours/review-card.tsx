import { useLocale, useTranslations } from "next-intl";
import { Quote } from "lucide-react";
import { RatingStars } from "@/components/tours/rating-stars";
import { cn } from "@/lib/utils";

const sourceLabel: Record<string, string> = {
  tripadvisor: "Tripadvisor",
  viator: "Viator",
  google: "Google",
  site: "",
};

export function ReviewCard({
  review,
  tone = "light",
  className,
}: {
  review: {
    authorName: string;
    authorCountry?: string | null;
    rating: number;
    title?: string | null;
    body: string;
    language: "en" | "ar";
    source: string;
    travelDate?: string | null;
    staffReply?: string | null;
  };
  tone?: "light" | "dark";
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("reviews");
  const dark = tone === "dark";
  const flag = review.authorCountry
    ? String.fromCodePoint(...[...review.authorCountry.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "";
  const date = review.travelDate
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { month: "long", year: "numeric" }).format(
        new Date(review.travelDate + (review.travelDate.length === 7 ? "-01" : "") + "T00:00:00"),
      )
    : null;

  return (
    <figure
      dir={review.language === "ar" ? "rtl" : "ltr"}
      className={cn(
        "flex h-full flex-col rounded-xl border p-6",
        dark ? "border-navy-800 bg-navy-900 text-sand-50" : "border-sand-200 bg-white text-ink-900",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <RatingStars rating={review.rating} size="md" label={t("ratingLabel", { rating: review.rating })} />
        <Quote className="size-5 text-gold-500/60" />
      </div>
      {review.title && <h3 className="mt-3 font-heading text-base">{review.title}</h3>}
      <blockquote className={cn("mt-2 flex-1 text-sm leading-relaxed", dark ? "text-sand-100/80" : "text-ink-500")}>
        {review.body}
      </blockquote>
      {review.staffReply && (
        <p className={cn("mt-3 rounded-lg border-s-2 border-gold-500 px-3 py-2 text-xs", dark ? "bg-navy-950 text-sand-100/70" : "bg-sand-100 text-ink-500")}>
          <span className="font-semibold text-gold-700">{t("replyFrom")}: </span>
          {review.staffReply}
        </p>
      )}
      <figcaption className={cn("mt-4 flex items-center justify-between text-xs", dark ? "text-sand-100/60" : "text-ink-500")}>
        <span className="font-medium">
          {flag} {review.authorName}
        </span>
        <span>
          {date}
          {sourceLabel[review.source] ? ` · ${sourceLabel[review.source]}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
