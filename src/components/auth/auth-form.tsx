"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { z } from "zod";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
const MAGIC_ENABLED = process.env.NEXT_PUBLIC_AUTH_MAGIC_LINK === "1";

const passwordSchema = z.string().min(8).regex(/[0-9]/).regex(/[A-Za-z]/);

/**
 * Normalises the `?redirect=` target to an in-site, locale-less path.
 * Older links (and the Convex Auth middleware before the fix) carried the
 * locale prefix; the locale-aware router adds it again, so strip it here.
 * Protocol-relative and absolute URLs are rejected to avoid open redirects.
 */
function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  const stripped = raw.replace(/^\/(en|ar)(?=\/|$|\?)/, "");
  if (stripped === "" || stripped.startsWith("?")) return `/${stripped}`;
  return stripped.startsWith("/") ? stripped : "/account";
}

export function AuthForm({ mode }: { mode: "signIn" | "signUp" | "magic" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuthActions();
  const claim = useMutation(api.bookings.claimGuestBookings);
  const redirect = safeRedirect(params.get("redirect"));
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function afterSignIn() {
    try {
      await claim({});
    } catch {
      /* not signed in yet or nothing to claim */
    }
    router.replace(redirect);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!z.string().email().safeParse(email).success) return setError(t("errors.email"));
    if (mode === "signUp" && !passwordSchema.safeParse(password).success) return setError(t("errors.weakPassword"));
    setBusy(true);
    try {
      const params: Record<string, string> = { email: email.trim().toLowerCase(), password, locale, flow: mode === "signUp" ? "signUp" : "signIn" };
      if (name.trim()) params.name = name.trim();
      await signIn("password", params);
      toast.success(mode === "signUp" ? t("welcome") : t("welcomeBack"));
      await afterSignIn();
    } catch (err) {
      console.error("[auth] sign-in failed", err);
      const msg = String((err as Error).message ?? "");
      setError(msg.includes("InvalidAccountId") || msg.includes("InvalidSecret") || msg.includes("Invalid") ? t("errors.invalidCredentials") : msg.includes("already") ? t("errors.exists") : t("errors.generic"));
      setBusy(false);
    }
  }

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!z.string().email().safeParse(email).success) return setError(t("errors.email"));
    setBusy(true);
    try {
      await signIn("resend", { email: email.trim().toLowerCase(), redirectTo: `/${locale}${redirect}` });
      setMagicSent(true);
    } catch {
      setError(t("errors.magicFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await signIn("google", { redirectTo: `/${locale}${redirect}` });
    } catch {
      setError(t("errors.generic"));
      setBusy(false);
    }
  }

  const passwordForm = (
    <form onSubmit={submitPassword} className="space-y-4" noValidate>
      {mode === "signUp" && (
        <div className="space-y-1.5">
          <Label htmlFor="auth-name">{t("name")}</Label>
          <Input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="auth-email">{t("email")}</Label>
        <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="auth-password">{t("password")}</Label>
          {mode === "signIn" && <Link href="/forgot-password" className="text-xs text-gold-700 underline-offset-4 hover:underline">{t("forgot")}</Link>}
        </div>
        <Input id="auth-password" type="password" autoComplete={mode === "signUp" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {mode === "signUp" && <p className="text-xs text-ink-500">{t("passwordHint")}</p>}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full bg-gold-gradient font-semibold text-navy-950">
        <KeyRound className="size-4" /> {busy ? t("working") : mode === "signUp" ? t("createAccount") : t("signIn")}
      </Button>
    </form>
  );

  const magicForm = magicSent ? (
    <div className="rounded-lg border border-success/40 bg-success/5 p-5 text-center">
      <Mail className="mx-auto size-8 text-success" />
      <p className="mt-2 font-medium text-ink-900">{t("magicSentTitle")}</p>
      <p className="mt-1 text-sm text-ink-500">{t("magicSentBody", { email })}</p>
    </div>
  ) : (
    <form onSubmit={submitMagic} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="magic-email">{t("email")}</Label>
        <Input id="magic-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || !MAGIC_ENABLED} className="w-full bg-gold-gradient font-semibold text-navy-950">
        <Sparkles className="size-4" /> {busy ? t("working") : t("sendMagic")}
      </Button>
      {!MAGIC_ENABLED && <p className="text-xs text-ink-500">{t("magicDisabled")}</p>}
    </form>
  );

  return (
    <div className="space-y-6">
      {mode === "magic" ? (
        magicForm
      ) : (
        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">{t("tabPassword")}</TabsTrigger>
            <TabsTrigger value="magic">{t("tabMagic")}</TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="pt-4">{passwordForm}</TabsContent>
          <TabsContent value="magic" className="pt-4">{magicForm}</TabsContent>
        </Tabs>
      )}

      <div className="relative">
        <div className="hairline" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-ink-500">{t("or")}</span>
      </div>

      <Button type="button" variant="outline" size="lg" onClick={google} disabled={busy || !GOOGLE_ENABLED} className={cn("w-full", !GOOGLE_ENABLED && "opacity-60")}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" /><path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" /></svg>
        {t("google")}
      </Button>
      {!GOOGLE_ENABLED && <p className="-mt-3 text-center text-xs text-ink-500">{t("googleDisabled")}</p>}

      <p className="text-center text-sm text-ink-500">
        {mode === "signUp" ? (
          <>{t("haveAccount")} <Link href={`/sign-in?redirect=${encodeURIComponent(redirect)}`} className="text-gold-700 underline-offset-4 hover:underline">{t("signIn")}</Link></>
        ) : (
          <>{t("noAccount")} <Link href={`/sign-up?redirect=${encodeURIComponent(redirect)}`} className="text-gold-700 underline-offset-4 hover:underline">{t("createAccount")}</Link></>
        )}
      </p>
    </div>
  );
}
