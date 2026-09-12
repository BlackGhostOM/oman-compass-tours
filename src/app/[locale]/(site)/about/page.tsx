import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Award, BadgeCheck, Bus, CarFront, Download, ExternalLink, HeartHandshake, Leaf, Star } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { fetchPublic } from "@/lib/convex-server";
import { pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassPoint, CompassWatermark } from "@/components/brand/compass-rose";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const team = (await fetchPublic(api.content.team, {})) ?? [];
  const profilePdf = await fetchPublic(api.content.setting, { key: "company.profilePdfUrl" });
  const values = ["authenticity", "safety", "hospitality", "sustainability"] as const;
  const timeline = ["2014", "2017", "2020", "2023", "2026"] as const;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: t("metaTitle"),
          mainEntity: { "@type": "TravelAgency", name: site.name, foundingDate: String(site.foundedYear), telephone: site.phoneE164, email: site.email },
        }}
      />
      {/* Story */}
      <section className="relative overflow-hidden surface-dark pt-32 pb-20">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} tone="dark" align="start" />
            <div className="mt-6 space-y-4 text-sand-100/80 leading-relaxed">
              <p>{t("story1")}</p>
              <p>{t("story2")}</p>
              <p>{t("story3")}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={site.tripadvisor.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gold-500/40 bg-navy-900 px-4 py-3 text-sm text-sand-50 transition hover:border-gold-500">
                <span className="flex text-gold-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</span>
                {t("tripadvisorBadge", { rating: "5.0", position: site.tripadvisor.rank.position, of: site.tripadvisor.rank.of })}
                <ExternalLink className="size-3.5 text-gold-500" />
              </a>
              <a href={site.viatorUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gold-500/40 bg-navy-900 px-4 py-3 text-sm text-sand-50 transition hover:border-gold-500">
                <Award className="size-4 text-gold-500" /> {t("viatorPartner")}
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-navy-800">
            <Image src="/media/placeholders/about.jpg" alt={t("imageAlt")} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <Image src="/brand/logo-mark.png" alt="" width={522} height={522} className="absolute bottom-4 end-4 size-20 rounded-full ring-1 ring-gold-500/50" />
          </div>
        </div>
      </section>

      {/* Mission / vision / values */}
      <section className="surface-sand py-20">
        <div className="container-brand">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-sand-200 bg-white p-8">
              <p className="eyebrow">{t("missionLabel")}</p>
              <p className="mt-3 font-editorial text-2xl leading-snug text-navy-950">{t("mission")}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-white p-8">
              <p className="eyebrow">{t("visionLabel")}</p>
              <p className="mt-3 font-editorial text-2xl leading-snug text-navy-950">{t("vision")}</p>
            </div>
          </div>
          <SectionHeading className="mt-20" eyebrow={t("valuesEyebrow")} title={t("valuesTitle")} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <li key={v} className="rounded-xl border border-sand-200 bg-white p-6">
                <CompassPoint point={(["N", "E", "S", "W"] as const)[i]} className="size-5" />
                <h3 className="mt-4 font-heading text-lg text-navy-950">{t(`values.${v}.title`)}</h3>
                <p className="mt-2 text-sm text-ink-500">{t(`values.${v}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Team */}
      <section className="surface-dark py-20">
        <div className="container-brand">
          <SectionHeading eyebrow={t("teamEyebrow")} title={t("teamTitle")} description={t("teamDescription")} tone="dark" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <article key={m._id} className="card-dark overflow-hidden">
                <div className="relative aspect-[9/10]">
                  <Image src={m.photo?.url ?? "/media/placeholders/team-1.jpg"} alt={pick(m.photo?.alt, locale) || pick(m.name, locale)} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="font-heading text-lg text-sand-50">{pick(m.name, locale)}</h3>
                  <p className="text-sm text-gold-400">{pick(m.roleTitle, locale)}</p>
                  <p className="mt-3 text-sm text-sand-100/70">{pick(m.bio, locale)}</p>
                  <p className="mt-3 text-xs text-sand-100/50">{m.languages.map((l) => (l === "ar" ? "العربية" : "English")).join(" · ")}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fleet + licences */}
      <section className="surface-sand py-20">
        <div className="container-brand grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow={t("fleetEyebrow")} title={t("fleetTitle")} align="start" />
            <ul className="mt-8 space-y-4">
              <li className="flex gap-4 rounded-xl border border-sand-200 bg-white p-5">
                <CarFront className="size-8 shrink-0 text-gold-500" />
                <div><h3 className="font-heading text-navy-950">{t("fleet.4wd.title")}</h3><p className="mt-1 text-sm text-ink-500">{t("fleet.4wd.body")}</p></div>
              </li>
              <li className="flex gap-4 rounded-xl border border-sand-200 bg-white p-5">
                <Bus className="size-8 shrink-0 text-gold-500" />
                <div><h3 className="font-heading text-navy-950">{t("fleet.bus.title")}</h3><p className="mt-1 text-sm text-ink-500">{t("fleet.bus.body")}</p></div>
              </li>
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow={t("licenceEyebrow")} title={t("licenceTitle")} align="start" />
            <ul className="mt-8 space-y-4">
              <li className="flex gap-4 rounded-xl border border-sand-200 bg-white p-5">
                <BadgeCheck className="size-8 shrink-0 text-success" />
                <div><h3 className="font-heading text-navy-950">{t("licence.mht.title")}</h3><p className="mt-1 text-sm text-ink-500">{t("licence.mht.body", { number: site.licenseNumber })}</p></div>
              </li>
              <li className="flex gap-4 rounded-xl border border-sand-200 bg-white p-5">
                <Leaf className="size-8 shrink-0 text-success" />
                <div><h3 className="font-heading text-navy-950">{t("licence.animal.title")}</h3><p className="mt-1 text-sm text-ink-500">{t("licence.animal.body")}</p></div>
              </li>
              <li className="flex gap-4 rounded-xl border border-sand-200 bg-white p-5">
                <HeartHandshake className="size-8 shrink-0 text-gold-500" />
                <div><h3 className="font-heading text-navy-950">{t("licence.partners.title")}</h3><p className="mt-1 text-sm text-ink-500">{t("licence.partners.body")}</p></div>
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-dashed border-gold-500/50 bg-white p-5">
              <h3 className="font-heading text-navy-950">{t("profileTitle")}</h3>
              <p className="mt-1 text-sm text-ink-500">{typeof profilePdf === "string" && profilePdf ? t("profileBody") : t("profileSoon")}</p>
              {typeof profilePdf === "string" && profilePdf ? (
                <Button asChild className="mt-3 bg-gold-gradient text-navy-950 shadow-gold">
                  <a href={profilePdf} target="_blank" rel="noopener noreferrer" download><Download className="size-4" /> {t("profileDownload")}</a>
                </Button>
              ) : (
                <Button disabled className="mt-3 bg-gold-gradient text-navy-950"><Download className="size-4" /> {t("profileDownload")}</Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="surface-dark py-20">
        <div className="container-brand">
          <SectionHeading eyebrow={t("timelineEyebrow")} title={t("timelineTitle")} tone="dark" />
          <ol className="relative mt-12 space-y-8 border-s border-gold-500/40 ps-8">
            {timeline.map((y) => (
              <li key={y} className="relative">
                <span className="absolute -start-[2.35rem] top-1 size-3 rounded-full bg-gold-gradient ring-4 ring-navy-950" />
                <p className="font-heading text-gold-400">{y}</p>
                <h3 className="mt-1 font-heading text-lg text-sand-50">{t(`timeline.${y}.title`)}</h3>
                <p className="mt-1 text-sm text-sand-100/70">{t(`timeline.${y}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
