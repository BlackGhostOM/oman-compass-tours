import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CompassRose } from "@/components/brand/compass-rose";

export default function NotFound() {
  const t = useTranslations("errors.notFound");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center surface-dark px-6 text-center">
      <CompassRose className="size-24 opacity-70" />
      <p className="eyebrow mt-8">404</p>
      <h1 className="mt-3 font-heading text-3xl text-sand-50">{t("title")}</h1>
      <p className="mt-3 max-w-md text-sand-100/70">{t("body")}</p>
      <Button asChild className="mt-8 bg-gold-gradient text-navy-950">
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
}
