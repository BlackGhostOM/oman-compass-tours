import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { audit, requireStaff } from "../lib/access";

const statusValidator = v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost"));

/** Partnership requests (leads with source "partner") with their structured profile. */
export const list = query({
  args: { status: v.optional(statusValidator) },
  handler: async (ctx, { status }) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("leads").withIndex("by_source", (q) => q.eq("source", "partner")).order("desc").take(500);
    const rows = status ? all.filter((l) => l.status === status) : all;
    const staff = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "staff")).take(50);
    const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(50);
    const owners = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "owner")).take(10);
    const people = [...staff, ...admins, ...owners];
    const now = Date.now();
    return rows
      .filter((l) => l.partner)
      .map((l) => ({
        _id: l._id,
        name: l.name,
        email: l.email ?? null,
        phone: l.phone ?? null,
        locale: l.locale,
        status: l.status,
        assignee: people.find((p) => p._id === l.assigneeId)?.name ?? null,
        assigneeId: l.assigneeId ?? null,
        slaDueAt: l.slaDueAt,
        overdue: l.status === "new" && l.slaDueAt < now,
        firstResponseAt: l.firstResponseAt ?? null,
        createdAt: l._creationTime,
        notes: l.notes ?? null,
        partner: l.partner!,
      }));
  },
});

export const counts = query({
  args: {},
  returns: v.object({ total: v.number(), new: v.number(), contacted: v.number(), qualified: v.number(), converted: v.number(), lost: v.number() }),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("leads").withIndex("by_source", (q) => q.eq("source", "partner")).take(1000);
    const out = { total: rows.length, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
    for (const r of rows) out[r.status] += 1;
    return out;
  },
});

export const remove = mutation({
  args: { id: v.id("leads") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const lead = await ctx.db.get(id);
    if (!lead || lead.source !== "partner") throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    await audit(ctx, staff, "partner.delete", "leads", String(id));
    return null;
  },
});
