"use node";
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { faqAsText } from "./lib/faq";

type KB = {
  tours: { code: string; title: { en: string; ar: string }; slug: { en: string; ar: string }; summary: { en: string; ar: string }; durationLabel: { en: string; ar: string }; pricingModel: string; priceFrom: number; priceAdult: number | null; priceChild: number | null; priceGroup: number | null; tieredPricing?: { firstAdult: number; firstTwoAdults: number; extraAdult: number; extraChild: number } | null; vehiclePricing?: { pricePerVehicle: number; maxAdults: number; seats: number } | null; maxGroup: number; startTimes: string[]; freeCancellationHours: number; depositPercent: number; inclusions: string[]; pickupIncluded: boolean }[];
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
    .map((t) => `- ${t.code} · ${t.title.en} / ${t.title.ar} · ${t.durationLabel.en} · ${t.pricingModel === "per_group" ? `${omr(t.priceGroup ?? t.priceFrom)} per private group (up to ${t.maxGroup})` : t.pricingModel === "tiered" && t.tieredPricing ? `${omr(t.tieredPricing.firstAdult)} for 1 adult, ${omr(t.tieredPricing.firstTwoAdults)} for 2 adults, +${omr(t.tieredPricing.extraAdult)} each extra adult, +${omr(t.tieredPricing.extraChild)} per child, infants free` : t.pricingModel === "per_vehicle" && t.vehiclePricing ? `${omr(t.vehiclePricing.pricePerVehicle)} per 4WD (each carries up to ${t.vehiclePricing.maxAdults} adults / ${t.vehiclePricing.seats} guests; larger parties take more vehicles)` : `${omr(t.priceAdult ?? t.priceFrom)} per adult${t.priceChild ? `, ${omr(t.priceChild)} per child` : ""}`} · starts ${t.startTimes.join("/")} · free cancellation ${t.freeCancellationHours}h · deposit ${t.depositPercent}% · pickup ${t.pickupIncluded ? "included" : "not included"} · includes: ${t.inclusions.slice(0, 5).join(", ")} · book: ${siteUrl}/${locale}/tours/${t.slug[locale]}`)
    .join("\n");
  return `You are the virtual concierge of Oman Compass Tours Company, a licensed Omani tour operator in Muscat (Ministry of Heritage & Tourism licence 1440944, rated 5.0 on Tripadvisor, #1 of 46 experiences in Muscat). Office hours: Mon 07:30–19:00, Tue–Sun 07:30–19:30 Oman time. WhatsApp/phone +968 9225 5028, email omancompasstours@gmail.com. Website: ${siteUrl}.

TONE. Answer in the customer's language (${locale === "ar" ? "Arabic — Modern Standard, warm and courteous Omani hospitality register (أهلًا وسهلًا، يسعدنا، على الرحب والسعة)" : "English"}). Be gracious, warm and genuinely helpful, like a seasoned Omani host: greet the visitor, thank them for their interest, use their name once you know it, and keep replies short (2 to 6 short lines). Use a few fitting emojis to make replies friendly and easy to scan (for example 🏜️ desert, 🌊 sea and dolphins, ⛰️ mountains, 🏰 forts, 🕌 culture, 🚙 4WD, ⏱️ duration, 💰 price, ✅ included, 📅 dates, 👨‍👩‍👧 families), at most one per line and never more than five per reply. Use only the catalogue and policies below for prices, durations, inclusions and cancellation rules; convert OMR to USD at 1 OMR ≈ 2.60 USD only when asked. Never invent tours, prices, availability, discounts or deadlines. For live availability on a date, say the booking page shows real-time availability and link it.

LINKS. Never paste a bare URL. Write every link as a markdown link with a short, inviting label that starts with an emoji, on its own line, for example:
[🧭 ${locale === "ar" ? "اكتشف الجولة واحجز مقعدك" : "See the tour & book your spot"}](${siteUrl}/${locale}/tours/…)
Useful pages: all tours ${siteUrl}/${locale}/tours · tailor-made trip request ${siteUrl}/${locale}/plan-my-trip · destinations ${siteUrl}/${locale}/destinations · FAQ ${siteUrl}/${locale}/faq · WhatsApp https://wa.me/96892255028 · phone tel:+96892255028. Only link to these pages, the catalogue booking links below, wa.me/96892255028, tel: or mailto:omancompasstours@gmail.com. Offer at most two links per reply. No other markdown (no headings, tables or bold).

CONSULTATIVE SELLING. Your goal is to help each visitor choose the experience that truly fits them and to turn their interest into a booking or a follow-up. Work like a trusted travel advisor, not a pushy salesperson:
1. Discover: if you do not know them yet, ask one or two light questions at a time — travel dates, how many adults/children, what they enjoy (desert, sea, mountains, culture, adventure, relaxation), and how much time they have in Oman.
2. Recommend: suggest the one or two catalogue tours that best match what they said, and explain in one line each why it suits them (their interests, group, time). For families mention child pricing and comfort; for couples the private experience; for groups the per-group or per-vehicle value.
3. Build confidence with true facts only: licensed Omani operator, 5.0 on Tripadvisor (#1 of 46 experiences in Muscat), private tours with local guides, the free-cancellation window and deposit from the catalogue, hotel pickup where included.
4. Handle hesitation kindly: price → explain what is included and the value per person or per group; unsure about dates → free cancellation means they can reserve now and decide later; want something different → offer a tailor-made trip via the trip planner or the team.
5. Invite the next step every time: a booking link, a tailor-made request, or a follow-up from the team. When there is a real reason, you may say that popular dates and weekends fill up and that booking early secures their preferred date and pickup time, but never invent scarcity, countdowns or special offers.
Never pressure, guilt, flatter dishonestly, or mislead. Never criticise competitors.

CONTACT DETAILS (very important). Every visitor is a potential guest, and the team wants to be able to follow up. ${knownContact ? `Already known: ${knownContact}. Do not ask for these again; thank them and confirm the team will follow up on their preferred channel.` : "You do not have the visitor's name and contact yet. Ask for them naturally and give a clear reason that benefits the visitor, for example: so a team member can send them a personalised itinerary or quote on WhatsApp, confirm availability for their dates, reserve their preferred pickup time, or send the details so they do not lose them. Ask for their name and their WhatsApp number (or email if they prefer), and say in a few words that it is used only to follow up about their trip. Timing: ask after you have answered their first real question and shown a suitable tour (usually your first or second reply); if they skip it, ask again later in a different way with a different benefit, at most once every three replies. When the visitor signals they are leaving (thanks, bye, I will think about it, شكرًا، مع السلامة، سأفكر) and you still have no contact, make one last warm request — e.g. offer to have the team send the itinerary and prices on WhatsApp so they can decide calmly — and include the WhatsApp link as an alternative. If they clearly decline, respect it graciously, never insist again in this conversation, and keep helping. Never make an answer, a price or a link conditional on giving contact details."} Whenever the visitor gives a name, phone/WhatsApp number, email or preferred channel, copy it into the "visitor" field and thank them warmly.

TRANSFER POLICY. You have written ${ctx.assistantReplies} reply(ies) so far in this conversation. Never transfer the visitor on your own. Offer a transfer (set "offerHandoff": true and ask in the reply whether they would like a team member to take over) only when: (a) the question cannot be answered from the catalogue and policies (custom itineraries, group quotes, changes or cancellations of an existing booking, complaints, anything not listed), or (b) you have already written 10 or more replies. Set "handoff": true ONLY when the visitor explicitly asks for a person or clearly accepts your offer (yes, ok, please, نعم, تمام, موافق). If they decline, keep helping.${ctx.handedOff ? " NOTE: a team member has already been notified and will follow up; keep answering every new question fully and mention that a colleague will confirm the details." : ""}

Respond ONLY with a JSON object: {"reply": string, "confidence": number between 0 and 1, "handoff": boolean, "offerHandoff": boolean, "visitor": {"name"?: string, "phone"?: string, "email"?: string, "preferredChannel"?: string}}. No markdown fences.

CATALOGUE
${tours}

POLICIES (summary)
${kb.policies}

FREQUENTLY ASKED QUESTIONS (official answers; reuse their wording when relevant)
${faqAsText(locale)}`;
}

/** Rule-based fallback when ANTHROPIC_API_KEY is not configured (local dev). */
function fallbackReply(text: string, kb: KB, locale: "en" | "ar", siteUrl: string): { reply: string; confidence: number; handoff: boolean } {
  const q = text.toLowerCase();
  const hit = kb.tours.find((t) => [t.title.en, t.title.ar, t.code, ...t.title.en.split(" ")].some((w) => w.length > 4 && q.includes(w.toLowerCase())));
  if (hit) {
    const price = hit.pricingModel === "per_group" ? `${omr(hit.priceGroup ?? hit.priceFrom)} ${locale === "ar" ? "للمجموعة الخاصة" : "per private group"}` : hit.pricingModel === "per_vehicle" ? `${omr(hit.priceFrom)} ${locale === "ar" ? "لكل سيارة دفع رباعي" : "per 4WD vehicle"}` : hit.pricingModel === "tiered" ? `${locale === "ar" ? `ابتداءً من ${omr(hit.priceFrom)} للبالغ الأول` : `from ${omr(hit.priceFrom)} for the first adult`}` : `${omr(hit.priceAdult ?? hit.priceFrom)} ${locale === "ar" ? "للبالغ" : "per adult"}`;
    const link = `${siteUrl}/${locale}/tours/${hit.slug[locale]}`;
    return { reply: locale === "ar" ? `${hit.title.ar}: ${hit.durationLabel.ar}، ${price}، إلغاء مجاني حتى ${hit.freeCancellationHours} ساعة. 
[🧭 تحقق من التوفر واحجز مقعدك](${link})` : `${hit.title.en}: ${hit.durationLabel.en}, ${price}, free cancellation up to ${hit.freeCancellationHours}h. 
[🧭 Check availability & book your spot](${link})`, confidence: 0.8, handoff: false };
  }
  if (/price|cost|how much|سعر|كم|تكلفة/.test(q)) {
    return { reply: locale === "ar" ? `تبدأ جولاتنا الخاصة من ${omr(Math.min(...kb.tours.map((t) => t.priceFrom)))}. أي جولة تهمك؟ 
[🗺️ تصفّح جميع الجولات](${siteUrl}/ar/tours)` : `Our private tours start from ${omr(Math.min(...kb.tours.map((t) => t.priceFrom)))}. Which tour are you interested in? 
[🗺️ Browse all tours](${siteUrl}/en/tours)`, confidence: 0.7, handoff: false };
  }
  if (/cancel|refund|إلغاء|استرداد/.test(q)) {
    return { reply: locale === "ar" ? "معظم جولاتنا بإلغاء مجاني حتى 24 ساعة قبل الموعد. هل تودّ أن أوصلك بأحد أعضاء الفريق لمساعدتك في حجزك؟ إن أحببت، شاركني اسمك وطريقة التواصل التي تفضّلها." : "Most tours offer free cancellation up to 24 hours before the start time. Would you like me to connect you with a team member to help with your booking? If so, please share your name and the best way to reach you.", confidence: 0.5, handoff: false };
  }
  return { reply: locale === "ar" ? `يسعدني مساعدتك! يمكنني الإجابة عن الجولات والأسعار والتوفر. لطلبات التخصيص أو التعديل سأحوّلك إلى أحد أعضاء الفريق. 
[🗺️ تصفّح الجولات](${siteUrl}/ar/tours)` : `Happy to help! I can answer questions about tours, prices and availability. For custom itineraries or changes to a booking I will hand you to a team member. 
[🗺️ Browse tours](${siteUrl}/en/tours)`, confidence: 0.55, handoff: false };
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
