import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { button, escapeHtml, layout, row, sendEmail, STAFF_EMAIL, table } from "./lib/email";

const SITE_URL = () => process.env.SITE_URL ?? "http://localhost:3000";

type Kind = "new" | "handoff";

/**
 * Emails the company inbox when a visitor starts a live chat and again when a
 * conversation is handed to the team. Each kind is sent once per conversation.
 */
export const notifyStaff = internalAction({
  args: { conversationId: v.id("conversations"), kind: v.union(v.literal("new"), v.literal("handoff")) },
  returns: v.null(),
  handler: async (ctx, { conversationId, kind }): Promise<null> => {
    const data = (await ctx.runQuery(internal.chat.getForAi, { conversationId })) as {
      conversation: Doc<"conversations">;
      history: { role: string; body: string }[];
      tour: { title: { en: string; ar: string } } | null;
    } | null;
    if (!data) return null;
    const c = data.conversation;
    if ((kind === "new" && c.notifiedNewAt) || (kind === "handoff" && c.notifiedHandoffAt)) return null;

    const visitor = c.guestName ?? "Anonymous visitor";
    const contact = [c.guestEmail, c.guestPhone].filter(Boolean).join(" · ") || "no contact details yet";
    const transcript = data.history
      .filter((m) => m.role === "customer" || m.role === "assistant" || m.role === "staff")
      .slice(-8)
      .map((m) => `<p style="margin:0 0 8px"><strong>${m.role === "customer" ? escapeHtml(visitor) : m.role === "assistant" ? "AI assistant" : "Team"}:</strong> ${escapeHtml(m.body)}</p>`)
      .join("");
    const inboxUrl = `${SITE_URL()}/en/admin/inbox?c=${conversationId}`;
    const subjectKind: Record<Kind, string> = {
      new: `New live chat from ${visitor}`,
      handoff: `Live chat needs a team member: ${visitor}`,
    };
    const titleKind: Record<Kind, string> = {
      new: "A visitor started a live chat · بدأ زائر محادثة مباشرة",
      handoff: "A live chat is waiting for a person · محادثة بانتظار أحد أعضاء الفريق",
    };
    const html = layout(
      "en",
      titleKind[kind],
      table(
        [
          row("Visitor", escapeHtml(visitor)),
          row("Contact", escapeHtml(contact)),
          row("Language", c.locale === "ar" ? "Arabic" : "English"),
          row("Page", escapeHtml(c.pagePath ?? "—")),
          row("Tour", escapeHtml(data.tour?.title.en ?? "—")),
          row("Reason", escapeHtml(kind === "handoff" ? (c.handoffReason ?? "handoff") : "first message")),
        ].join(""),
      ) +
        `<h3 style="margin:20px 0 8px;font-size:15px">Latest messages</h3>${transcript}` +
        `<p style="margin:20px 0 0">${button(inboxUrl, "Open in the staff inbox")}</p>`,
      "Reply from the staff inbox; the visitor sees your answer instantly in the chat.",
    );

    const result = await sendEmail({ to: STAFF_EMAIL, subject: subjectKind[kind], html, replyTo: c.guestEmail ?? undefined });
    await ctx.runMutation(internal.notifications.log, {
      channel: "email",
      template: kind === "new" ? "staff_chat_new" : "staff_chat_handoff",
      to: STAFF_EMAIL,
      locale: c.locale,
      userId: c.userId,
      status: result.status,
      providerMessageId: result.id,
      error: result.error,
      payload: { conversationId },
    });
    await ctx.runMutation(internal.chat.markStaffNotified, { conversationId, kind });
    return null;
  },
});
