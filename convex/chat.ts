import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { assertString, enforceRateLimit, getViewer, isStaff, requireStaff } from "./lib/access";
import { localeValidator } from "./schema";

const HANDOFF_PATTERNS = /\b(human|agent|person|staff|someone|talk to|speak to|refund|cancel|change my booking|modify|complain|manager)\b|موظف|شخص|إنسان|استرداد|إلغاء|تعديل|شكوى|أريد التحدث/i;

async function loadConversationForCaller(ctx: QueryCtx | MutationCtx, conversationId: Id<"conversations">, sessionKey?: string) {
  const c = await ctx.db.get(conversationId);
  if (!c) throw new ConvexError({ code: "NOT_FOUND" });
  const viewer = await getViewer(ctx);
  const allowed = (viewer && (isStaff(viewer) || c.userId === viewer._id)) || (sessionKey && c.sessionKey === sessionKey);
  if (!allowed) throw new ConvexError({ code: "FORBIDDEN" });
  return { c, viewer };
}

const publicMessage = (m: Doc<"messages">) => ({ _id: m._id, role: m.role, body: m.body, createdAt: m._creationTime, aiSuggestedHandoff: m.aiSuggestedHandoff ?? false });

/* ------------------------------------------------------------------ */
/* Customer side                                                       */
/* ------------------------------------------------------------------ */

/** Finds or creates the visitor's open conversation. */
export const open = mutation({
  args: { sessionKey: v.string(), locale: localeValidator, pagePath: v.optional(v.string()), tourId: v.optional(v.id("tours")) },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    assertString(args.sessionKey, 64, "sessionKey", 8);
    const viewer = await getViewer(ctx);
    const existing = viewer
      ? (await ctx.db.query("conversations").withIndex("by_user", (q) => q.eq("userId", viewer._id)).order("desc").take(5)).find((c) => c.status !== "closed")
      : (await ctx.db.query("conversations").withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey)).take(5)).find((c) => c.status !== "closed");
    if (existing) {
      if (viewer && !existing.userId) await ctx.db.patch(existing._id, { userId: viewer._id, guestName: existing.guestName ?? viewer.name, guestEmail: existing.guestEmail ?? viewer.email });
      return existing._id;
    }
    const id = await ctx.db.insert("conversations", {
      userId: viewer?._id,
      sessionKey: args.sessionKey,
      guestName: viewer?.name,
      guestEmail: viewer?.email,
      guestPhone: viewer?.phone,
      locale: args.locale,
      status: "ai",
      tourId: args.tourId,
      pagePath: args.pagePath?.slice(0, 200),
      lastMessageAt: Date.now(),
      unreadForStaff: 0,
      unreadForCustomer: 0,
    });
    return id;
  },
});

export const messages = query({
  args: { conversationId: v.id("conversations"), sessionKey: v.optional(v.string()) },
  handler: async (ctx, { conversationId, sessionKey }) => {
    const { c } = await loadConversationForCaller(ctx, conversationId, sessionKey);
    const rows = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).take(500);
    const assignee = c.assigneeId ? await ctx.db.get(c.assigneeId) : null;
    return { status: c.status, assigneeName: assignee?.name ?? null, guestName: c.guestName ?? null, guestPhone: c.guestPhone ?? null, messages: rows.map(publicMessage) };
  },
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), sessionKey: v.optional(v.string()), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { conversationId, sessionKey, body }) => {
    const { c, viewer } = await loadConversationForCaller(ctx, conversationId, sessionKey);
    const text = assertString(body, 4000, "body", 1);
    await enforceRateLimit(ctx, `chat:${c._id}`, 30, 5 * 60 * 1000);
    const now = Date.now();
    await ctx.db.insert("messages", { conversationId, role: "customer", authorId: viewer?._id, body: text });
    const wantsHuman = HANDOFF_PATTERNS.test(text);
    const nextStatus = c.status === "ai" && wantsHuman ? "waiting_human" : c.status;
    await ctx.db.patch(conversationId, { lastMessageAt: now, lastMessagePreview: text.slice(0, 120), unreadForStaff: c.unreadForStaff + 1, status: nextStatus, handoffReason: nextStatus === "waiting_human" && c.status === "ai" ? "customer_request" : c.handoffReason });
    if (!c.notifiedNewAt) await ctx.scheduler.runAfter(0, internal.chatEmails.notifyStaff, { conversationId, kind: "new" });
    if (nextStatus === "waiting_human" && c.status === "ai") {
      await ctx.db.insert("messages", { conversationId, role: "system", body: c.locale === "ar" ? "تم تحويل المحادثة إلى أحد أعضاء الفريق. سيرد عليك قريبًا." : "Handing you over to a team member. Someone will reply shortly." });
      await ctx.scheduler.runAfter(0, internal.chat.ensureLeadForHandoff, { conversationId });
      await ctx.scheduler.runAfter(0, internal.chatEmails.notifyStaff, { conversationId, kind: "handoff" });
    } else if (c.status === "ai" || c.status === "waiting_human") {
      // Keep answering until a team member actually takes over (status "human"); nobody should be left waiting.
      await ctx.scheduler.runAfter(0, internal.chatAi.respond, { conversationId });
    }
    return null;
  },
});

/** Customer shares name + phone (required before human handoff). */
export const identify = mutation({
  args: { conversationId: v.id("conversations"), sessionKey: v.optional(v.string()), name: v.string(), phone: v.string(), email: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { conversationId, sessionKey, name, phone, email }) => {
    const { c } = await loadConversationForCaller(ctx, conversationId, sessionKey);
    await ctx.db.patch(c._id, { guestName: assertString(name, 120, "name", 1), guestPhone: assertString(phone, 32, "phone", 6), guestEmail: email?.toLowerCase() });
    return null;
  },
});

export const requestHuman = mutation({
  args: { conversationId: v.id("conversations"), sessionKey: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { conversationId, sessionKey }) => {
    const { c } = await loadConversationForCaller(ctx, conversationId, sessionKey);
    if (c.status === "ai") {
      await ctx.db.patch(c._id, { status: "waiting_human", handoffReason: "customer_button", lastMessageAt: Date.now() });
      await ctx.db.insert("messages", { conversationId, role: "system", body: c.locale === "ar" ? "تم تحويل المحادثة إلى أحد أعضاء الفريق." : "Handing you over to a team member." });
      await ctx.scheduler.runAfter(0, internal.chat.ensureLeadForHandoff, { conversationId });
      await ctx.scheduler.runAfter(0, internal.chatEmails.notifyStaff, { conversationId, kind: "handoff" });
    }
    return null;
  },
});

export const markReadByCustomer = mutation({
  args: { conversationId: v.id("conversations"), sessionKey: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { conversationId, sessionKey }) => {
    const { c } = await loadConversationForCaller(ctx, conversationId, sessionKey);
    if (c.unreadForCustomer > 0) await ctx.db.patch(c._id, { unreadForCustomer: 0 });
    return null;
  },
});

export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return [];
    const rows = await ctx.db.query("conversations").withIndex("by_user", (q) => q.eq("userId", viewer._id)).order("desc").take(50);
    return rows.map((c) => ({ _id: c._id, status: c.status, subject: c.subject ?? null, lastMessageAt: c.lastMessageAt, lastMessagePreview: c.lastMessagePreview ?? null, unread: c.unreadForCustomer }));
  },
});

/* ------------------------------------------------------------------ */
/* Staff inbox                                                         */
/* ------------------------------------------------------------------ */

export const inbox = query({
  args: { status: v.optional(v.union(v.literal("ai"), v.literal("waiting_human"), v.literal("human"), v.literal("closed"))) },
  handler: async (ctx, { status }) => {
    await requireStaff(ctx);
    const rows = status
      ? await ctx.db.query("conversations").withIndex("by_status", (q) => q.eq("status", status)).order("desc").take(200)
      : (await ctx.db.query("conversations").order("desc").take(300)).filter((c) => c.status !== "closed");
    return Promise.all(
      rows.map(async (c) => {
        const user = c.userId ? await ctx.db.get(c.userId) : null;
        const assignee = c.assigneeId ? await ctx.db.get(c.assigneeId) : null;
        return { _id: c._id, status: c.status, name: c.guestName ?? user?.name ?? null, email: c.guestEmail ?? user?.email ?? null, phone: c.guestPhone ?? user?.phone ?? null, locale: c.locale, lastMessageAt: c.lastMessageAt, lastMessagePreview: c.lastMessagePreview ?? null, unread: c.unreadForStaff, assignee: assignee?.name ?? null, assigneeId: c.assigneeId ?? null, pagePath: c.pagePath ?? null, handoffReason: c.handoffReason ?? null, bookingId: c.bookingId ?? null };
      }),
    );
  },
});

export const staffReply = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { conversationId, body }) => {
    const staff = await requireStaff(ctx);
    const c = await ctx.db.get(conversationId);
    if (!c) throw new ConvexError({ code: "NOT_FOUND" });
    const text = assertString(body, 4000, "body", 1);
    await ctx.db.insert("messages", { conversationId, role: "staff", authorId: staff._id, body: text });
    await ctx.db.patch(conversationId, { status: "human", assigneeId: c.assigneeId ?? staff._id, lastMessageAt: Date.now(), lastMessagePreview: text.slice(0, 120), unreadForCustomer: c.unreadForCustomer + 1, unreadForStaff: 0 });
    const lead = c.leadId ? await ctx.db.get(c.leadId) : null;
    if (lead && !lead.firstResponseAt) await ctx.db.patch(lead._id, { firstResponseAt: Date.now(), status: lead.status === "new" ? "contacted" : lead.status, assigneeId: lead.assigneeId ?? staff._id, updatedAt: Date.now() });
    return null;
  },
});

export const staffUpdate = mutation({
  args: { conversationId: v.id("conversations"), status: v.optional(v.union(v.literal("ai"), v.literal("waiting_human"), v.literal("human"), v.literal("closed"))), assigneeId: v.optional(v.union(v.id("users"), v.null())), subject: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { conversationId, status, assigneeId, subject }) => {
    await requireStaff(ctx);
    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (assigneeId !== undefined) patch.assigneeId = assigneeId ?? undefined;
    if (subject !== undefined) patch.subject = subject.slice(0, 120);
    if (status === "closed" || status === "human") patch.unreadForStaff = 0;
    await ctx.db.patch(conversationId, patch);
    return null;
  },
});

export const staffMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    await requireStaff(ctx);
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const rows = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).take(500);
    const user = c.userId ? await ctx.db.get(c.userId) : null;
    const booking = c.bookingId ? await ctx.db.get(c.bookingId) : null;
    const lead = c.leadId ? await ctx.db.get(c.leadId) : null;
    return { conversation: { ...c, name: c.guestName ?? user?.name ?? null, email: c.guestEmail ?? user?.email ?? null, phone: c.guestPhone ?? user?.phone ?? null }, messages: rows.map((m) => ({ ...publicMessage(m), aiConfidence: m.aiConfidence ?? null })), customer: user ? { _id: user._id, name: user.name ?? null, email: user.email ?? null } : null, booking: booking ? { _id: booking._id, reference: booking.reference, status: booking.status } : null, lead: lead ? { _id: lead._id, status: lead.status } : null };
  },
});

export const markReadByStaff = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    await requireStaff(ctx);
    await ctx.db.patch(conversationId, { unreadForStaff: 0 });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Internal (AI + leads)                                               */
/* ------------------------------------------------------------------ */

export const getForAi = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const rows = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).order("desc").take(30);
    const tour = c.tourId ? await ctx.db.get(c.tourId) : null;
    return { conversation: c, history: rows.reverse().map((m) => ({ role: m.role, body: m.body })), tour: tour ? { title: tour.title, slug: tour.slug, priceFrom: tour.priceFrom, pricingModel: tour.pricingModel, summary: tour.summary, freeCancellationHours: tour.freeCancellationHours, durationLabel: tour.durationLabel } : null };
  },
});

export const knowledgeBase = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tours = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(100);
    const policies = await ctx.db.query("policies").take(20);
    const settings = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "chat.onlineHours")).unique();
    const policyText: string[] = [];
    for (const p of policies.filter((p) => ["cancellation", "payment", "child"].includes(p.key))) {
      const ver = p.currentVersionId ? await ctx.db.get(p.currentVersionId) : null;
      if (ver) policyText.push(`## ${p.title.en}\n${ver.body.en.replace(/>.*\n\n/, "").slice(0, 1500)}`);
    }
    return {
      tours: tours.map((t) => ({ code: t.code, title: t.title, slug: t.slug, summary: t.summary, durationLabel: t.durationLabel, pricingModel: t.pricingModel, priceFrom: t.priceFrom, priceAdult: t.priceAdult ?? null, priceChild: t.priceChild ?? null, priceGroup: t.priceGroup ?? null, maxGroup: t.maxGroup, startTimes: t.startTimes, freeCancellationHours: t.freeCancellationHours, depositPercent: t.depositPercent, inclusions: t.inclusions.map((i) => i.en), pickupIncluded: t.pickupIncluded })),
      policies: policyText.join("\n\n"),
      hours: settings?.value ?? { start: "07:30", end: "19:30" },
    };
  },
});

export const postAssistantMessage = internalMutation({
  args: { conversationId: v.id("conversations"), body: v.string(), confidence: v.number(), suggestHandoff: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { conversationId, body, confidence, suggestHandoff }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    await ctx.db.insert("messages", { conversationId, role: "assistant", body, aiConfidence: confidence, aiSuggestedHandoff: suggestHandoff });
    const handoff = suggestHandoff && c.status === "ai";
    await ctx.db.patch(conversationId, { lastMessageAt: Date.now(), lastMessagePreview: body.slice(0, 120), unreadForCustomer: c.unreadForCustomer + 1, status: handoff ? "waiting_human" : c.status, handoffReason: handoff ? "low_confidence" : c.handoffReason });
    if (handoff) {
      await ctx.scheduler.runAfter(0, internal.chat.ensureLeadForHandoff, { conversationId });
      await ctx.scheduler.runAfter(0, internal.chatEmails.notifyStaff, { conversationId, kind: "handoff" });
    }
    return null;
  },
});

/** Records that the company was emailed about this conversation (once per kind). */
export const markStaffNotified = internalMutation({
  args: { conversationId: v.id("conversations"), kind: v.union(v.literal("new"), v.literal("handoff")) },
  returns: v.null(),
  handler: async (ctx, { conversationId, kind }) => {
    await ctx.db.patch(conversationId, kind === "new" ? { notifiedNewAt: Date.now() } : { notifiedHandoffAt: Date.now() });
    return null;
  },
});

/** Every handoff (or offline message) becomes a lead for the CRM. */
export const ensureLeadForHandoff = internalMutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.db.get(conversationId);
    if (!c || c.leadId) return null;
    const user = c.userId ? await ctx.db.get(c.userId) : null;
    const last = (await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).order("desc").take(5)).find((m) => m.role === "customer");
    const sla = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "leads.slaMinutes")).unique();
    const leadId = await ctx.db.insert("leads", {
      name: c.guestName ?? user?.name ?? "Chat visitor",
      email: c.guestEmail ?? user?.email,
      phone: c.guestPhone ?? user?.phone,
      message: last?.body ?? "(chat handoff)",
      locale: c.locale,
      source: "chat_handoff",
      tourId: c.tourId,
      conversationId,
      status: "new",
      slaDueAt: Date.now() + (typeof sla?.value === "number" ? sla.value : 60) * 60_000,
      userId: c.userId,
      pagePath: c.pagePath,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(conversationId, { leadId });
    await ctx.scheduler.runAfter(0, internal.notifications.notifyStaffNewLead, { leadId });
    return null;
  },
});
