import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { FALLBACK_RATES, type Currency } from "./lib/money";

const QUOTES: Currency[] = ["USD", "EUR", "GBP", "AED", "SAR"];

/** Display rates: 1 OMR = rate × quote. */
export const rates = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("fxRates").take(20);
    const out: Record<string, number> = { ...FALLBACK_RATES };
    let fetchedAt: number | null = null;
    for (const r of rows) {
      out[r.quote] = r.rate;
      fetchedAt = Math.max(fetchedAt ?? 0, r.fetchedAt);
    }
    return { rates: out, fetchedAt };
  },
});

export const upsert = internalMutation({
  args: { quotes: v.array(v.object({ quote: v.string(), rate: v.number() })), source: v.string() },
  returns: v.null(),
  handler: async (ctx, { quotes, source }) => {
    const now = Date.now();
    for (const q of quotes) {
      if (!Number.isFinite(q.rate) || q.rate <= 0 || q.rate > 1000) continue;
      const quote = q.quote as Currency;
      if (!QUOTES.includes(quote)) continue;
      const existing = await ctx.db.query("fxRates").withIndex("by_quote", (x) => x.eq("quote", quote)).unique();
      if (existing) await ctx.db.patch(existing._id, { rate: q.rate, fetchedAt: now, source });
      else await ctx.db.insert("fxRates", { base: "OMR", quote, rate: q.rate, fetchedAt: now, source });
    }
    return null;
  },
});

/** Daily refresh from FX_API_URL (defaults to open.er-api.com, base OMR). */
export const refresh = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const url = process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/OMR";
    try {
      const res = await fetch(url);
      const json = (await res.json()) as { rates?: Record<string, number>; result?: string };
      if (!json.rates) return null;
      const quotes = QUOTES.filter((q) => json.rates![q]).map((q) => ({ quote: q, rate: json.rates![q] }));
      await ctx.runMutation(internal.fx.upsert, { quotes, source: new URL(url).hostname });
    } catch (err) {
      console.error("[fx] refresh failed:", (err as Error).message);
    }
    return null;
  },
});
