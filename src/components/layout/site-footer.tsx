import { getLocale, getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { Logo } from "@/components/brand/logo";
import { CompassRose } from "@/components/brand/compass-rose";
import { footerCompany, footerExplore, policyLinks } from "@/components/layout/nav-links";
import { CookieSettingsButton } from "@/components/analytics/cookie-settings-button";
import { NewsletterForm } from "@/components/shared/newsletter-form";
import { PaymentLogos } from "@/components/shared/payment-logos";
import { SocialLinks } from "@/components/shared/social-links";

export async function SiteFooter() {
  const locale = (await getLocale()) as "en" | "ar";
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const tp = await getTranslations("policies");
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden surface-dark">
      <div className="hairline" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-24 -top-24 opacity-[0.05]"
      >
        <CompassRose className="size-[28rem]" strokeWidth={0.6} />
      </div>

      <div className="container-brand relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12">
        {/* Brand */}
        <div className="space-y-5 lg:col-span-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-sand-100/75">{t("blurb")}</p>
          <a
            href={site.tripadvisor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-900/70 px-4 py-3 transition hover:border-gold-500/60"
          >
            <div className="flex items-center gap-0.5 text-gold-400" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </div>
            <div className="text-sm leading-tight">
              <div className="font-semibold text-sand-50">
                {t("rating", { rating: site.tripadvisor.rating.toFixed(1), count: site.tripadvisor.reviewCount })}
              </div>
              <div className="text-xs text-sand-100/70">
                {t("ranked", { position: site.tripadvisor.rank.position, of: site.tripadvisor.rank.of })}
              </div>
            </div>
          </a>
          <SocialLinks className="pt-1" />
        </div>

        {/* Explore */}
        <nav aria-label={t("explore")} className="lg:col-span-2">
          <h3 className="eyebrow mb-4">{t("explore")}</h3>
          <ul className="space-y-2.5 text-sm">
            {footerExplore.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="text-sand-100/80 transition hover:text-gold-400">
                  {tn(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label={t("company")} className="lg:col-span-2">
          <h3 className="eyebrow mb-4">{t("company")}</h3>
          <ul className="space-y-2.5 text-sm">
            {footerCompany.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="text-sand-100/80 transition hover:text-gold-400">
                  {tn(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div className="space-y-4 lg:col-span-4">
          <h3 className="eyebrow">{t("contact")}</h3>
          <ul className="space-y-3 text-sm text-sand-100/80">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-500" />
              <span>{site.address[locale]}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-gold-500" />
              <a href={`tel:${site.phoneE164}`} dir="ltr" className="hover:text-gold-400">
                {site.phoneDisplay}
              </a>
              <span className="text-sand-100/50">·</span>
              <a
                href={site.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold-400"
              >
                WhatsApp
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-gold-500" />
              <a href={`mailto:${site.email}`} className="hover:text-gold-400">
                {site.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-gold-500" />
              <div>
                {site.hours.map((h) => (
                  <div key={h.days.en}>
                    <span className="text-sand-50">{h.days[locale]}</span>{" "}
                    <span dir="ltr">
                      {h.open} – {h.close}
                    </span>
                  </div>
                ))}
                <div className="text-xs text-sand-100/60">{t("timezone")}</div>
              </div>
            </li>
          </ul>
          <NewsletterForm />
        </div>
      </div>

      {/* Trust strip */}
      <div className="border-t border-navy-800/80">
        <div className="container-brand flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sand-100/70">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-gold-500" />
              {t("license", { number: site.licenseNumber })}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" />
              {t("secureCheckout")}
            </span>
          </div>
          <PaymentLogos />
        </div>
      </div>

      <div className="border-t border-navy-800/80">
        <div className="container-brand flex flex-col gap-3 py-5 text-xs text-sand-100/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {locale === "ar" ? site.nameAr : site.name}. {t("rights")}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {policyLinks.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="hover:text-gold-400">
                  {tp(`titles.${l.key}`)}
                </Link>
              </li>
            ))}
            <li><CookieSettingsButton className="hover:text-gold-400" /></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
