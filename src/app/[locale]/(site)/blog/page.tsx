import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { fetchPublic } from "@/lib/convex-server";
import { formatDate, pick } from "@/lib/content";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = (await fetchPublic(api.blog.list, {})) ?? [];

  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-14">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>
      <section className="surface-sand py-14">
        <div className="container-brand">
          {posts.length === 0 ? (
            <p className="text-ink-500">{t("empty")}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <article key={p._id} className="group flex flex-col overflow-hidden rounded-xl border border-sand-200 bg-white transition hover:border-gold-500/60">
                  <Link href={`/blog/${pick(p.slug, locale)}`} className="relative block aspect-[16/10] overflow-hidden">
                    <Image src={p.cover?.url ?? "/media/placeholders/hero.jpg"} alt={pick(p.cover?.alt, locale) || pick(p.title, locale)} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="eyebrow">{t(`categories.${p.category}`)}</p>
                    <h2 className="mt-2 font-heading text-lg leading-snug text-navy-950">
                      <Link href={`/blog/${pick(p.slug, locale)}`} className="hover:text-gold-700">{pick(p.title, locale)}</Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-500">{pick(p.excerpt, locale)}</p>
                    <p className="mt-4 flex items-center gap-3 text-xs text-ink-500">
                      <span>{formatDate(p.publishedAt, locale, "short")}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {t("readingTime", { minutes: p.readingMinutes })}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
