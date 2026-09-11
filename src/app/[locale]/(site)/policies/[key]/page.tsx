import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { fetchPublic } from "@/lib/convex-server";
import { formatDate, pick } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";
import { CompassWatermark } from "@/components/brand/compass-rose";

export const revalidate = 300;

type Props = { params: Promise<{ locale: "en" | "ar"; key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key } = await params;
  const policy = await fetchPublic(api.policies.byKey, { key });
  if (!policy) return {};
  return { title: pick(policy.title, locale), alternates: { languages: { en: `/en/policies/${key}`, ar: `/ar/policies/${key}` } } };
}

export default async function PolicyPage({ params }: Props) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const [policy, all] = await Promise.all([fetchPublic(api.policies.byKey, { key }), fetchPublic(api.policies.list, {})]);
  if (!policy) notFound();
  const t = await getTranslations("policies");

  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-12">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="heading-brand mt-3 font-heading text-3xl text-sand-50 sm:text-4xl">{pick(policy.title, locale)}</h1>
          <p className="mt-3 text-sm text-sand-100/70">
            {t("lastUpdated", { date: formatDate(policy.version.effectiveAt, locale), version: policy.version.version })}
          </p>
        </div>
      </section>
      <section className="surface-sand py-12">
        <div className="container-brand grid gap-10 lg:grid-cols-[16rem_1fr]">
          <nav aria-label={t("eyebrow")} className="lg:sticky lg:top-24 lg:self-start">
            <ul className="scrollbar-none flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1">
              {(all ?? []).map((p) => (
                <li key={p.key} className="shrink-0">
                  <Link
                    href={`/policies/${p.key}`}
                    aria-current={p.key === key ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                      p.key === key ? "bg-navy-950 text-gold-400" : "text-ink-500 hover:bg-white hover:text-navy-950",
                    )}
                  >
                    <FileText className="size-4 shrink-0" /> <span className="whitespace-nowrap lg:whitespace-normal">{pick(p.title, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <article className="min-w-0 rounded-xl border border-sand-200 bg-white p-6 sm:p-10">
            <Markdown content={pick(policy.version.body, locale)} />
          </article>
        </div>
      </section>
    </>
  );
}
