"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { MailX } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Landing page for the unsubscribe link in newsletter emails. */
export default function UnsubscribePage() {
  const t = useTranslations("newsletter");
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const unsubscribe = useMutation(api.newsletter.unsubscribe);
  const [state, setState] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    if (!token) return setState("error");
    unsubscribe({ token }).then(() => setState("done")).catch(() => setState("error"));
  }, [token, unsubscribe]);

  return (
    <div className="surface-sand pt-28 pb-16">
      <div className="container-brand max-w-xl">
        <div className="rounded-xl border border-sand-200 bg-white p-8 text-center">
          <MailX className="mx-auto size-10 text-gold-500" />
          <h1 className="mt-4 font-heading text-2xl text-navy-950">{t("unsubscribeTitle")}</h1>
          <p className="mt-2 text-sm text-ink-500">{state === "working" ? t("unsubscribeWorking") : state === "done" ? t("unsubscribeDone") : t("unsubscribeError")}</p>
          <Button asChild className="mt-6 bg-gold-gradient text-navy-950"><Link href="/">{t("backHome")}</Link></Button>
        </div>
      </div>
    </div>
  );
}
