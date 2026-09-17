import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: compass mark + spaced serif wordmark.
 * `variant="mark"` renders the compass only (header on scroll, favicons).
 */
export function Logo({
  variant = "lockup",
  className,
  markClassName,
  priority = false,
}: {
  variant?: "lockup" | "mark" | "full";
  className?: string;
  markClassName?: string;
  priority?: boolean;
}) {
  const locale = useLocale();
  const label = locale === "ar" ? site.nameAr : site.name;

  if (variant === "full") {
    return (
      <Link href="/" aria-label={label} className={cn("inline-flex", className)}>
        <Image
          src="/brand/logo.png"
          alt={label}
          width={1273}
          height={1000}
          priority={priority}
          className="h-auto w-full"
        />
      </Link>
    );
  }

  return (
    <Link href="/" className={cn("group inline-flex shrink-0 items-center gap-2 sm:gap-3", className)}>
      <span className="sr-only">{label}</span>
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={522}
        height={522}
        priority={priority}
        className={cn("size-11 rounded-full ring-1 ring-gold-500/30 transition group-hover:ring-gold-500/70", markClassName)}
      />
      {variant === "lockup" && (
        <span className="flex flex-col leading-none lg:hidden xl:flex">
          {/* Phones: two short lines ("OMAN COMPASS / TOURS") so the language, account and menu controls keep their room */}
          <span className="wordmark-name font-heading max-w-[7.5rem] text-[0.72rem] leading-tight font-semibold tracking-[0.08em] text-gold-400 sm:max-w-none sm:text-base sm:leading-none sm:tracking-[0.14em] sm:whitespace-nowrap">
            {locale === "ar" ? "بوصلة عُمان للسياحة" : "OMAN COMPASS TOURS"}
          </span>
          <span className="wordmark-sub mt-1 hidden text-[0.6rem] font-medium tracking-[0.3em] text-sand-100/70 uppercase sm:block">
            {locale === "ar" ? "شركة" : "Company"}
          </span>
        </span>
      )}
    </Link>
  );
}
