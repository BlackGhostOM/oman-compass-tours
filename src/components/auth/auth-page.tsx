import Image from "next/image";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { AuthForm } from "@/components/auth/auth-form";

export async function AuthPage({ mode }: { mode: "signIn" | "signUp" | "magic" }) {
  const t = await getTranslations("auth");
  const title = mode === "signUp" ? t("signUpTitle") : mode === "magic" ? t("magicTitle") : t("signInTitle");
  const body = mode === "signUp" ? t("signUpBody") : mode === "magic" ? t("magicBody") : t("signInBody");
  return (
    <div className="relative min-h-dvh overflow-hidden surface-dark pt-28 pb-16">
      <CompassWatermark opacity={0.05} />
      <div className="container-brand relative grid items-center gap-10 lg:grid-cols-2">
        <div className="hidden lg:block">
          <Image src="/brand/logo.png" alt="Oman Compass Tours" width={1273} height={1000} className="mx-auto w-80" />
          <ul className="mx-auto mt-10 max-w-sm space-y-3 text-sm text-sand-100/80">
            <li>· {t("perk1")}</li>
            <li>· {t("perk2")}</li>
            <li>· {t("perk3")}</li>
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md rounded-xl border border-sand-200 bg-white p-6 text-ink-900 sm:p-8">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="heading-brand mt-2 font-heading text-2xl text-navy-950">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{body}</p>
          <div className="mt-6">
            <Suspense>
              <AuthForm mode={mode} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
