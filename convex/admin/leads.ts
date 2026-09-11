import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertString, audit, requireStaff } from "../lib/access";
import { localeValidator } from "../schema";

const statusValidator = v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost"));

export const list = query({
  args: { status: v.optional(statusValidator), assigneeId: v.optional(v.id("users")), limit: v.optional(v.number()) },
  handler: async (ctx, { status, assigneeId, limit }) => {
    await requireStaff(ctx);
    const rows = status
      ? await ctx.db.query("leads").withIndex("by_status", (q) => q.eq("status", status)).order("asc").take(Math.min(limit ?? 300, 1000))
      : await ctx.db.query("leads").order("desc").take(Math.min(limit ?? 300, 1000));
    const staff = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "staff")).take(50);
    const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(50);
    const owners = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "owner")).take(10);
    const people = [...staff, ...admins, ...owners];
    const now = Date.now();
    return rows
      .filter((l) => !assigneeId || l.assigneeId === assigneeId)
      .map((l) => ({
        _id: l._id,
        name: l.name,
        email: l.email ?? null,
        phone: l.phone ?? null,
        message: l.message,
        locale: l.locale,
        source: l.source,
        status: l.status,
        assignee: people.find((p) => p._id === l.assigneeId)?.name ?? null,
        assigneeId: l.assigneeId ?? null,
        slaDueAt: l.slaDueAt,
        overdue: l.status === "new" && l.slaDueAt < now,
        firstResponseAt: l.firstResponseAt ?? null,
        tripDetails: l.tripDetails ?? null,
        tourId: l.tourId ?? null,
        conversationId: l.conversationId ?? null,
        createdAt: l._creationTime,
        notes: l.notes ?? null,
      }));
  },
});

export const update = mutation({
  args: { id: v.id("leads"), status: v.optional(statusValidator), assigneeId: v.optional(v.union(v.id("users"), v.null())), notes: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, status, assigneeId, notes }) => {
    const staff = await requireStaff(ctx);
    const lead = await ctx.db.get(id);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND" });
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (status) {
      patch.status = status;
      if (status !== "new" && !lead.firstResponseAt) patch.firstResponseAt = Date.now();
    }
    if (assigneeId !== undefined) patch.assigneeId = assigneeId ?? undefined;
    if (notes !== undefined) patch.notes = assertString(notes, 4000, "notes");
    await ctx.db.patch(id, patch);
    await audit(ctx, staff, "lead.update", "leads", String(id), { status: lead.status, assigneeId: lead.assigneeId }, patch);
    return null;
  },
});

export const create = mutation({
  args: { name: v.string(), email: v.optional(v.string()), phone: v.optional(v.string()), message: v.string(), locale: localeValidator, source: v.union(v.literal("whatsapp"), v.literal("phone"), v.literal("manual")) },
  returns: v.id("leads"),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const id = await ctx.db.insert("leads", { name: assertString(args.name, 120, "name", 1), email: args.email?.toLowerCase(), phone: args.phone, message: assertString(args.message, 4000, "message"), locale: args.locale, source: args.source, status: "contacted", assigneeId: staff._id, slaDueAt: Date.now(), firstResponseAt: Date.now(), updatedAt: Date.now() });
    await audit(ctx, staff, "lead.create", "leads", String(id), undefined, { source: args.source });
    return id;
  },
});

export const staffMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const out = [];
    for (const role of ["staff", "admin", "owner"] as const) {
      const rows = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).take(50);
      out.push(...rows.map((u) => ({ _id: u._id, name: u.name ?? u.email ?? "?", email: u.email ?? null, role })));
    }
    return out;
  },
});
