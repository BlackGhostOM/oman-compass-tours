import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { layout, sendEmail, STAFF_EMAIL } from "./lib/email";

/**
 * Deliverability check: sends one branded test email through Resend and records
 * the outcome in `notifications` (template "email_test"), like every other email.
 *   npx convex run emailTest:send --prod                  → to STAFF_NOTIFICATION_EMAIL
 *   npx convex run emailTest:send '{"to":"x@y.z"}' --prod
 * Internal only: it is a CLI tool, not callable from the website.
 */
export const send = internalAction({
  args: { to: v.optional(v.string()) },
  returns: v.object({ to: v.string(), status: v.string(), id: v.optional(v.string()), error: v.optional(v.string()) }),
  handler: async (ctx, { to }) => {
    const recipient = to ?? STAFF_EMAIL;
    const sentAt = new Date().toISOString();
    const html = layout(
      "en",
      "Test email · رسالة اختبار",
      `<p>This is a test message from the Oman Compass Tours website to confirm that email delivery works.</p>
       <p dir="rtl" style="text-align:right">هذه رسالة اختبار من موقع بوصلة عُمان للسياحة للتأكد من أن إرسال البريد يعمل.</p>
       <p style="color:#9C99AE;font-size:12px">${sentAt}</p>`,
    );
    const result = await sendEmail({ to: recipient, subject: "Oman Compass Tours · email test / اختبار البريد", html });
    await ctx.runMutation(internal.notifications.log, {
      channel: "email",
      template: "email_test",
      to: recipient,
      locale: "en",
      status: result.status,
      providerMessageId: result.id,
      error: result.error,
      payload: { sentAt },
    });
    return { to: recipient, status: result.status, id: result.id, error: result.error };
  },
});
