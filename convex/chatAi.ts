"use node";
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

type KB = {
  tours: { code: string; title: { en: string; ar: string }; slug: { en: string; ar: string }; summary: { en: string; ar: string }; durationLabel: { en: string; ar: string }; pricingModel: string; priceFrom: number; priceAdult: number | null; priceChild: number | null; priceGroup: number | null; maxGroup: number; startTimes: string[]; freeCancellationHours: number; depositPercent: number; inclusions: string[]; pickupIncluded: boolean }[];
  policies: string;
  hours: unknown;
};

const omr = (baisa: number) => `OMR ${(baisa / 1000).toFixed(baisa % 1000 === 0 ? 0 : 3)}`;

function buildSystemPrompt(kb: KB, locale: "en" | "ar", siteUrl: string): string {
  const tours = kb.tours
    .map((t) => `- ${t.code} · ${t.title.en} / ${t.title.ar} · ${t.durationLabel.en} · ${t.pricingModel === "per_group" ? `${omr(t.priceGroup ?? t.priceFrom)} per private group (up to ${t.maxGroup})` : `${omr(t.priceAdult ?? t.priceFrom)} per adult${t.priceChild ? `, ${omr(t.priceChild)} per child` : ""}`} · starts ${t.startTimes.join("/")} · free cancellation ${t.freeCancellationHours}h · deposit ${t.depositPercent}% · pickup ${t.pickupIncluded ? "included" : "not included"} · includes: ${t.inclusions.slice(0, 5).join(", ")} · book: ${siteUrl}/${locale}/tours/${t.slug[locale]}`)
    .join("\n");
  return `You are the virtual concierge of Oman Compass Tours Company, a licensed Omani tour operator in Muscat (Ministry of Heritage & Tourism licence 1440944, rated 5.0 on Tripadvisor, #1 of 46 experiences in Muscat). Office hours: Mon 07:30–19:00, Tue–Sun 07:30–19:30 Oman time. WhatsApp/phone +968 9225 5028, email omancompasstours@gmail.com. Website: ${siteUrl}.

Answer in the customer's language (${locale === "ar" ? "Arabic — Modern Standard, warm tourism register" : "English"}), briefly and warmly, like an experienced Omani guide. Use only the catalogue and policies below for prices, durations, inclusions and cancellation rules; convert OMR to USD at 1 OMR ≈ 2.60 USD only when asked. Give direct booking links from the catalogue. Never invent tours, prices, availability or discounts. For live availability on a date, say the booking page shows real-time availability and link it.

Hand off to a human (set "handoff": true) when: the customer asks for a person; they want to change, cancel or refund a booking; they report a problem or complaint; they ask for a custom itinerary or group quote; or you are not confident (confidence below 0.6). Before handing off, ask for their name and phone number if not already given.

Respond ONLY with a JSON object: {"reply": string, "confidence": number between 0 and 1, "handoff": boolean}. No markdown fences.

CATALOGUE
${tours}

POLICIES (summary)
${kb.policies}`;
}

/** Rule-based fallback when ANTHROPIC_API_KEY is not configured (local dev). */
function fallbackReply(text: string, kb: KB, locale: "en" | "ar", siteUrl: string): { reply: string; confidence: number; handoff: boolean } {
  const q = text.toLowerCase();
  const hit = kb.tours.find((t) => [t.title.en, t.title.ar, t.code, ...t.title.en.split(" ")].some((w) => w.length > 4 && q.includes(w.toLowerCase())));
  if (hit) {
    const price = hit.pricingModel === "per_group" ? `${omr(hit.priceGroup ?? hit.priceFrom)} ${locale === "ar" ? "للمجموعة الخاصة" : "per private group"}` : `${omr(hit.priceAdult ?? hit.priceFrom)} ${locale === "ar" ? "للبالغ" : "per adult"}`;
    const link = `${siteUrl}/${locale}/tours/${hit.slug[locale]}`;
    return { reply: locale === "ar" ? `${hit.title.ar}: ${hit.durationLabel.ar}، ${price}، إلغاء مجاني حتى ${hit.freeCancellationHours} ساعة. يمكنك التحقق من التوفر والحجز هنا: ${link}` : `${hit.title.en}: ${hit.durationLabel.en}, ${price}, free cancellation up to ${hit.freeCancellationHours}h. Check availability and book here: ${link}`, confidence: 0.8, handoff: false };
  }
  if (/price|cost|how much|سعر|كم|تكلفة/.test(q)) {
    return { reply: locale === "ar" ? `تبدأ جولاتنا الخاصة من ${omr(Math.min(...kb.tours.map((t) => t.priceFrom)))}. أي جولة تهمك؟ يمكنك تصفح الكتالوج: ${siteUrl}/ar/tours` : `Our private tours start from ${omr(Math.min(...kb.tours.map((t) => t.priceFrom)))}. Which tour are you interested in? Browse the catalogue: ${siteUrl}/en/tours`, confidence: 0.7, handoff: false };
  }
  if (/cancel|refund|إلغاء|استرداد/.test(q)) {
    return { reply: locale === "ar" ? "معظم جولاتنا بإلغاء مجاني حتى 24 ساعة قبل الموعد. سأحوّلك إلى أحد أعضاء الفريق لمساعدتك في حجزك؛ يرجى مشاركة اسمك ورقم هاتفك." : "Most tours offer free cancellation up to 24 hours before the start time. Let me hand you to a team member who can help with your booking — please share your name and phone number.", confidence: 0.5, handoff: true };
  }
  return { reply: locale === "ar" ? `يسعدني مساعدتك! يمكنني الإجابة عن الجولات والأسعار والتوفر. لطلبات التخصيص أو التعديل سأحوّلك إلى أحد أعضاء الفريق. تصفح الجولات: ${siteUrl}/ar/tours` : `Happy to help! I can answer questions about tours, prices and availability. For custom itineraries or changes to a booking I will hand you to a team member. Browse tours: ${siteUrl}/en/tours`, confidence: 0.55, handoff: false };
}

export const respond = internalAction({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    const data = (await ctx.runQuery(internal.chat.getForAi, { conversationId })) as { conversation: Doc<"conversations">; history: { role: string; body: string }[]; tour: unknown } | null;
    if (!data || data.conversation.status !== "ai") return null;
    const kb = (await ctx.runQuery(internal.chat.knowledgeBase, {})) as KB;
    const locale = data.conversation.locale;
    const siteUrl = process.env.SITE_URL ?? "https://omancompasstours.com";
    const lastCustomer = [...data.history].reverse().find((m) => m.role === "customer");
    if (!lastCustomer) return null;

    let result: { reply: string; confidence: number; handoff: boolean };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      result = fallbackReply(lastCustomer.body, kb, locale, siteUrl);
    } else {
      try {
        const client = new Anthropic({ apiKey });
        const messages: Anthropic.MessageParam[] = data.history
          .filter((m) => m.role === "customer" || m.role === "assistant")
          .map((m) => ({ role: m.role === "customer" ? "user" : "assistant", content: m.body }));
        if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: locale === "ar" ? "مرحبًا" : "Hello" });
        const response = await client.messages.create({
          model: "claude-opus-5",
          max_tokens: 2000,
          output_config: { effort: "low" },
          system: [{ type: "text", text: buildSystemPrompt(kb, locale, siteUrl), cache_control: { type: "ephemeral" } }],
          messages,
        });
        if (response.stop_reason === "refusal") {
          result = { reply: locale === "ar" ? "سأحوّلك إلى أحد أعضاء الفريق لمساعدتك." : "Let me hand you to a team member who can help.", confidence: 0.3, handoff: true };
        } else {
          const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
          try {
            const parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as { reply?: string; confidence?: number; handoff?: boolean };
            result = { reply: String(parsed.reply ?? text), confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7))), handoff: !!parsed.handoff };
          } catch {
            result = { reply: text, confidence: 0.6, handoff: false };
          }
        }
      } catch (err) {
        console.error("[chatAi] Claude request failed:", (err as Error).message);
        result = fallbackReply(lastCustomer.body, kb, locale, siteUrl);
      }
    }

    const handoff = result.handoff || result.confidence < 0.6;
    await ctx.runMutation(internal.chat.postAssistantMessage, { conversationId, body: result.reply, confidence: result.confidence, suggestHandoff: handoff });
    return null;
  },
});
