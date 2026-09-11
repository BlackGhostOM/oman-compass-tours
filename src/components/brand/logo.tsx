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
    <Link href="/" aria-label={label} className={cn("group inline-flex items-center gap-3", className)}>
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={522}
        height={522}
        priority={priority}
        className={cn("size-11 rounded-full ring-1 ring-gold-500/30 transition group-hover:ring-gold-500/70", markClassName)}
      />
      {variant === "lockup" && (
        <span className="hidden flex-col leading-none whitespace-nowrap sm:flex">
          <span className="font-heading text-[0.95rem] font-semibold tracking-[0.14em] text-gold-400 sm:text-base">
            {locale === "ar" ? "بوصلة عُمان للسياحة" : "OMAN COMPASS TOURS"}
          </span>
          <span className="mt-1 text-[0.6rem] font-medium tracking-[0.3em] text-sand-100/70 uppercase">
            {locale === "ar" ? "شركة" : "Company"}
          </span>
        </span>
      )}
    </Link>
  );
}
