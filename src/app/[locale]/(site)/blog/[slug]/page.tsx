import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, UserRound } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { fetchPublic } from "@/lib/convex-server";
import { decodeSlug, formatDate, pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Markdown } from "@/components/shared/markdown";
import { ShareButtons } from "@/components/tours/share-buttons";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 300;

type Props = { params: Promise<{ locale: "en" | "ar"; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await fetchPublic(api.blog.bySlug, { slug: decodeSlug(slug), locale });
  if (!post) return {};
  return {
    title: pick(post.seo?.title ?? post.title, locale),
    description: pick(post.seo?.description ?? post.excerpt, locale),
    alternates: { languages: { en: `/en/blog/${post.slug.en}`, ar: `/ar/blog/${post.slug.ar}` } },
    openGraph: { type: "article", images: [{ url: post.cover?.url ?? "/og-default.jpg" }] },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await fetchPublic(api.blog.bySlug, { slug: decodeSlug(slug), locale });
  if (!post) notFound();
  const t = await getTranslations("blog");
  const title = pick(post.title, locale);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: title,
          description: pick(post.excerpt, locale),
          image: post.cover?.url ? `${site.url}${post.cover.url}` : undefined,
          datePublished: new Date(post.publishedAt).toISOString(),
          dateModified: new Date(post.updatedAt).toISOString(),
          author: { "@type": "Organization", name: post.authorName },
          publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.url}/brand/logo.png` } },
          inLanguage: locale,
        }}
      />
      <article className="surface-sand pt-28 pb-16">
        <div className="container-brand max-w-4xl">
          <p className="eyebrow">{t(`categories.${post.category}`)}</p>
          <h1 className="heading-brand mt-3 font-heading text-3xl leading-tight text-navy-950 sm:text-4xl">{title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-500">
            <span className="inline-flex items-center gap-1.5"><UserRound className="size-4 text-gold-500" /> {post.authorName}</span>
            <span>{formatDate(post.publishedAt, locale)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-gold-500" /> {t("readingTime", { minutes: post.readingMinutes })}</span>
          </p>
          {post.cover?.url && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl">
              <Image src={post.cover.url} alt={pick(post.cover.alt, locale) || title} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            </div>
          )}
          <div className="mt-8 rounded-xl border border-sand-200 bg-white p-6 sm:p-10">
            <Markdown content={pick(post.body, locale)} />
            <div className="hairline my-8" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <ul className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-sand-200 px-3 py-1 text-xs text-ink-500">#{tag}</li>
                ))}
              </ul>
              <ShareButtons title={title} path={`/blog/${pick(post.slug, locale)}`} />
            </div>
          </div>

          {post.more.length > 0 && (
            <section className="mt-12">
              <h2 className="font-heading text-2xl text-navy-950">{t("more")}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {post.more.map((p) => (
                  <Link key={p._id} href={`/blog/${pick(p.slug, locale)}`} className="group overflow-hidden rounded-xl border border-sand-200 bg-white transition hover:border-gold-500/60">
                    <div className="relative aspect-[16/10]">
                      <Image src={p.cover?.url ?? "/media/placeholders/hero.jpg"} alt="" fill sizes="33vw" className="object-cover transition group-hover:scale-105" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading text-base text-navy-950">{pick(p.title, locale)}</h3>
                      <p className="mt-1 text-xs text-ink-500">{formatDate(p.publishedAt, locale, "short")}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </>
  );
}
