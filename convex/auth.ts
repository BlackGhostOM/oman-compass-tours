import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Resend as ResendApi } from "resend";
import type { DataModel } from "./_generated/dataModel";
import { generateReferralCode } from "./lib/ids";

/**
 * Magic-link provider (Resend). The email copy is bilingual; the locale is
 * passed by the client as `params.locale`.
 */
const ResendMagicLink = Resend({
  id: "resend",
  apiKey: process.env.AUTH_RESEND_KEY,
  from: process.env.EMAIL_FROM ?? "Oman Compass Tours <no-reply@omancompasstours.com>",
  async sendVerificationRequest({ identifier: email, provider, url }) {
    const resend = new ResendApi(provider.apiKey);
    const { error } = await resend.emails.send({
      from: provider.from as string,
      to: [email],
      subject: "Sign in to Oman Compass Tours · تسجيل الدخول",
      html: `<!doctype html><html><body style="margin:0;background:#0E0B2E;font-family:Inter,Arial,sans-serif;color:#F6EFE2;padding:32px">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#14113A;border:1px solid #1E1A4F;border-radius:12px;padding:32px">
    <tr><td style="text-align:center;letter-spacing:.12em;font-size:14px;color:#C9A15C">OMAN COMPASS TOURS</td></tr>
    <tr><td style="padding-top:24px;font-size:16px;line-height:1.6">Click the button below to sign in. This link expires in 20 minutes.</td></tr>
    <tr><td style="padding-top:8px;font-size:16px;line-height:1.8;direction:rtl;text-align:right">اضغط على الزر أدناه لتسجيل الدخول. تنتهي صلاحية هذا الرابط خلال 20 دقيقة.</td></tr>
    <tr><td style="padding-top:24px;text-align:center"><a href="${url}" style="display:inline-block;padding:12px 28px;border-radius:12px;background:linear-gradient(135deg,#DDB97A,#C9A15C,#A8843F);color:#0E0B2E;font-weight:600;text-decoration:none">Sign in · تسجيل الدخول</a></td></tr>
    <tr><td style="padding-top:24px;font-size:12px;color:#9C99AE">If you did not request this email you can safely ignore it. · إذا لم تطلب هذه الرسالة فيمكنك تجاهلها.</td></tr>
  </table></body></html>`,
    });
    if (error) {
      throw new Error(`Could not send magic link: ${JSON.stringify(error)}`);
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("invalid_email");
        }
        return {
          email,
          name: typeof params.name === "string" ? params.name.slice(0, 120) : undefined,
          locale: params.locale === "ar" ? "ar" : "en",
        };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
          throw new Error("weak_password");
        }
      },
    }),
    ResendMagicLink,
    Google,
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId) return;
      const user = await ctx.db.get(userId);
      const patch: Record<string, unknown> = {};
      if (!user?.role) patch.role = "customer";
      if (!user?.locale) patch.locale = "en";
      if (!user?.referralCode) patch.referralCode = generateReferralCode();
      if (user?.loyaltyPoints === undefined) patch.loyaltyPoints = 0;
      if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    },
  },
});
