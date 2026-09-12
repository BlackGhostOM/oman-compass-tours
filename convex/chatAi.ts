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

type PromptContext = {
  handedOff: boolean;
  assistantReplies: number;
  known: { name?: string; phone?: string; email?: string; preferredChannel?: string };
};

function buildSystemPrompt(kb: KB, locale: "en" | "ar", siteUrl: string, ctx: PromptContext): string {
  const knownContact = [ctx.known.name && `name: ${ctx.known.name}`, ctx.known.phone && `phone: ${ctx.known.phone}`, ctx.known.email && `email: ${ctx.known.email}`, ctx.known.preferredChannel && `preferred channel: ${ctx.known.preferredChannel}`].filter(Boolean).join(", ");
  const tours = kb.tours
    .map((t) => `- ${t.code} · ${t.title.en} / ${t.title.ar} · ${t.durationLabel.en} · ${t.pricingModel === "per_group" ? `${omr(t.priceGroup ?? t.priceFrom)} per private group (up to ${t.maxGroup})` : `${omr(t.priceAdult ?? t.priceFrom)} per adult${t.priceChild ? `, ${omr(t.priceChild)} per child` : ""}`} · starts ${t.startTimes.join("/")} · free cancellation ${t.freeCancellationHours}h · deposit ${t.depositPercent}% · pickup ${t.pickupIncluded ? "included" : "not included"} · includes: ${t.inclusions.slice(0, 5).join(", ")} · book: ${siteUrl}/${locale}/tours/${t.slug[locale]}`)
    .join("\n");
  return `You are the virtual concierge of Oman Compass Tours Company, a licensed Omani tour operator in Muscat (Ministry of Heritage & Tourism licence 1440944, rated 5.0 on Tripadvisor, #1 of 46 experiences in Muscat). Office hours: Mon 07:30–19:00, Tue–Sun 07:30–19:30 Oman time. WhatsApp/phone +968 9225 5028, email omancompasstours@gmail.com. Website: ${siteUrl}.

Answer in the customer's language (${locale === "ar" ? "Arabic — Modern Standard, warm tourism register" : "English"}), briefly and warmly, like an experienced Omani guide. Use only the catalogue and policies below for prices, durations, inclusions and cancellation rules; convert OMR to USD at 1 OMR ≈ 2.60 USD only when asked. Give direct booking links from the catalogue. Never invent tours, prices, availability or discounts. For live availability on a date, say the booking page shows real-time availability and link it.

CONTACT DETAILS. Every visitor is a potential customer. ${knownContact ? `Already known: ${knownContact}. Do not ask for these again.` : "You do not know the visitor's name or how to reach them yet: in your first or second reply, after answering, politely ask for their name and the way they prefer to be contacted (WhatsApp number, phone or email) so the team can follow up with details or a quote. Ask at most once every three replies, never as a condition for answering."} Whenever the visitor gives a name, phone/WhatsApp number, email or preferred channel, copy it into the "visitor" field.

TRANSFER POLICY. You have written ${ctx.assistantReplies} reply(ies) so far in this conversation. Never transfer the visitor on your own. Offer a transfer (set "offerHandoff": true and ask in the reply whether they would like a team member to take over) only when: (a) the question cannot be answered from the catalogue and policies (custom itineraries, group quotes, changes or cancellations of an existing booking, complaints, anything not listed), or (b) you have already written 10 or more replies. Set "handoff": true ONLY when the visitor explicitly asks for a person or clearly accepts your offer (yes, ok, please, نعم, تمام, موافق). If they decline, keep helping.${ctx.handedOff ? " NOTE: a team member has already been notified and will follow up; keep answering every new question fully and mention that a colleague will confirm the details." : ""}

Respond ONLY with a JSON object: {"reply": string, "confidence": number between 0 and 1, "handoff": boolean, "offerHandoff": boolean, "visitor": {"name"?: string, "phone"?: string, "email"?: string, "preferredChannel"?: string}}. No markdown fences.

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
    return { reply: locale === "ar" ? "معظم جولاتنا بإلغاء مجاني حتى 24 ساعة قبل الموعد. هل تودّ أن أوصلك بأحد أعضاء الفريق لمساعدتك في حجزك؟ إن أحببت، شاركني اسمك وطريقة التواصل التي تفضّلها." : "Most tours offer free cancellation up to 24 hours before the start time. Would you like me to connect you with a team member to help with your booking? If so, please share your name and the best way to reach you.", confidence: 0.5, handoff: false };
  }
  return { reply: locale === "ar" ? `يسعدني مساعدتك! يمكنني الإجابة عن الجولات والأسعار والتوفر. لطلبات التخصيص أو التعديل سأحوّلك إلى أحد أعضاء الفريق. تصفح الجولات: ${siteUrl}/ar/tours` : `Happy to help! I can answer questions about tours, prices and availability. For custom itineraries or changes to a booking I will hand you to a team member. Browse tours: ${siteUrl}/en/tours`, confidence: 0.55, handoff: false };
}

export const respond = internalAction({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    const data = (await ctx.runQuery(internal.chat.getForAi, { conversationId })) as { conversation: Doc<"conversations">; history: { role: string; body: string }[]; tour: unknown } | null;
    if (!data || (data.conversation.status !== "ai" && data.conversation.status !== "waiting_human")) return null;
    const promptCtx: PromptContext = {
      handedOff: data.conversation.status === "waiting_human",
      assistantReplies: data.history.filter((m) => m.role === "assistant").length,
      known: { name: data.conversation.guestName, phone: data.conversation.guestPhone, email: data.conversation.guestEmail, preferredChannel: data.conversation.guestPreferredChannel },
    };
    const kb = (await ctx.runQuery(internal.chat.knowledgeBase, {})) as KB;
    const locale = data.conversation.locale;
    const siteUrl = process.env.SITE_URL ?? "https://omancompasstours.com";
    const lastCustomer = [...data.history].reverse().find((m) => m.role === "customer");
    if (!lastCustomer) return null;

    type Visitor = { name?: string; phone?: string; email?: string; preferredChannel?: string };
    let result: { reply: string; confidence: number; handoff: boolean; offerHandoff?: boolean; visitor?: Visitor };
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
          system: [{ type: "text", text: buildSystemPrompt(kb, locale, siteUrl, promptCtx), cache_control: { type: "ephemeral" } }],
          messages,
        });
        if (response.stop_reason === "refusal") {
          result = { reply: locale === "ar" ? "هذا سؤال يحتاج أحد أعضاء الفريق. هل تودّ أن أوصلك به؟" : "That one needs a team member. Would you like me to connect you?", confidence: 0.3, handoff: false, offerHandoff: true };
        } else {
          const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
          try {
            const parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as { reply?: string; confidence?: number; handoff?: boolean; offerHandoff?: boolean; visitor?: Visitor };
            const visitor = parsed.visitor && typeof parsed.visitor === "object" ? (Object.fromEntries(Object.entries(parsed.visitor).filter(([, value]) => typeof value === "string" && value.trim())) as Visitor) : undefined;
            result = { reply: String(parsed.reply ?? text), confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7))), handoff: parsed.handoff === true, offerHandoff: parsed.offerHandoff === true, visitor };
          } catch {
            result = { reply: text, confidence: 0.6, handoff: false };
          }
        }
      } catch (err) {
        console.error("[chatAi] Claude request failed:", (err as Error).message);
        result = fallbackReply(lastCustomer.body, kb, locale, siteUrl);
      }
    }

    // The assistant only transfers when the visitor asked for a person or accepted its offer; low confidence alone never transfers.
    await ctx.runMutation(internal.chat.postAssistantMessage, { conversationId, body: result.reply, confidence: result.confidence, suggestHandoff: result.handoff, offerHandoff: result.offerHandoff ?? false, visitor: result.visitor });
    return null;
  },
});
