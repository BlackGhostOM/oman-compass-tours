import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { POLICY_TEXTS } from "./seedData/policyTexts2026";

/**
 * One-off data migrations, run with `npx convex run migrations:<name> [--prod]`.
 * They are idempotent: running them twice changes nothing the second time.
 */

/** Publishes the September 2026 wording of the payment, cancellation, refund and waiver policies as a new version. */
export const publishSeededPolicies = internalMutation({
  args: { changeNote: v.optional(v.string()) },
  returns: v.array(v.object({ key: v.string(), version: v.number(), changed: v.boolean() })),
  handler: async (ctx, { changeNote }) => {
    const out: { key: string; version: number; changed: boolean }[] = [];
    for (const key of Object.keys(POLICY_TEXTS) as (keyof typeof POLICY_TEXTS)[]) {
      const policy = await ctx.db.query("policies").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (!policy) continue;
      const latest = (await ctx.db.query("policyVersions").withIndex("by_policy_version", (q) => q.eq("policyId", policy._id)).order("desc").take(1))[0];
      const body = POLICY_TEXTS[key];
      if (latest && latest.body.en === body.en && latest.body.ar === body.ar) {
        out.push({ key, version: latest.version, changed: false });
        continue;
      }
      const version = (latest?.version ?? 0) + 1;
      const vid = await ctx.db.insert("policyVersions", { policyId: policy._id, version, body, effectiveAt: Date.now(), changeNote: changeNote ?? "Official terms, September 2026" });
      await ctx.db.patch(policy._id, { currentVersionId: vid });
      out.push({ key, version, changed: true });
    }
    return out;
  },
});

/** Aligns every tour with the published terms: 35% deposit, free cancellation 72 h (day tours) or 30 days (multi-day). */
export const applyPolicyTerms = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const tours = await ctx.db.query("tours").take(500);
    let updated = 0;
    for (const t of tours) {
      const freeCancellationHours = t.durationDays > 1 ? 24 * 30 : 72;
      const depositPercent = 35;
      if (t.depositPercent !== depositPercent || t.freeCancellationHours !== freeCancellationHours) {
        await ctx.db.patch(t._id, { depositPercent, freeCancellationHours, updatedAt: Date.now() });
        updated += 1;
      }
    }
    return { updated, total: tours.length };
  },
});
