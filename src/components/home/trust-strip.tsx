import { getTranslations } from "next-intl/server";
import { Award, LockKeyhole, ShieldCheck } from "lucide-react";
import { site } from "@/lib/site";
import { PaymentLogos } from "@/components/shared/payment-logos";

export async function TrustStrip() {
  const t = await getTranslations("home.trust");
  return (
    <section className="surface-dark border-y border-navy-800">
      <div className="container-brand grid gap-8 py-10 md:grid-cols-3">
        <div className="flex gap-4">
          <ShieldCheck className="size-8 shrink-0 text-gold-500" />
          <div>
            <h3 className="font-heading text-sm tracking-wide text-sand-50">{t("licenseTitle")}</h3>
            <p className="mt-1 text-sm text-sand-100/70">{t("licenseBody", { number: site.licenseNumber })}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Award className="size-8 shrink-0 text-gold-500" />
          <div>
            <h3 className="font-heading text-sm tracking-wide text-sand-50">{t("ratedTitle")}</h3>
            <p className="mt-1 text-sm text-sand-100/70">{t("ratedBody", { count: site.tripadvisor.reviewCount })}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <LockKeyhole className="size-8 shrink-0 text-gold-500" />
          <div>
            <h3 className="font-heading text-sm tracking-wide text-sand-50">{t("secureTitle")}</h3>
            <p className="mt-1 text-sm text-sand-100/70">{t("secureBody")}</p>
            <PaymentLogos className="mt-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
