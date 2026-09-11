import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = "customer" | "staff" | "admin" | "owner";

export const STAFF_ROLES: Role[] = ["staff", "admin", "owner"];
export const ADMIN_ROLES: Role[] = ["admin", "owner"];

const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
};

type Ctx = QueryCtx | MutationCtx;

/** Returns the signed-in user document, or null. */
export async function getViewer(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user || user.deletedAt) return null;
  return user;
}

/** Throws unless a user is signed in. */
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getViewer(ctx);
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return user;
}

/** Throws unless the signed-in user has one of the given roles. */
export async function requireRole(ctx: Ctx, roles: Role[]): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const role = (user.role ?? "customer") as Role;
  if (!roles.includes(role)) {
    throw new ConvexError({ code: "FORBIDDEN", required: roles, actual: role });
  }
  return user;
}

export const requireStaff = (ctx: Ctx) => requireRole(ctx, STAFF_ROLES);
export const requireAdmin = (ctx: Ctx) => requireRole(ctx, ADMIN_ROLES);
export const requireOwner = (ctx: Ctx) => requireRole(ctx, ["owner"]);

export function isStaff(user: Doc<"users"> | null): boolean {
  return !!user && STAFF_ROLES.includes((user.role ?? "customer") as Role);
}

export function hasAtLeastRole(user: Doc<"users"> | null, role: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[(user.role ?? "customer") as Role] >= ROLE_RANK[role];
}

/**
 * Owner-or-staff check for a customer-owned entity.
 * Returns the viewer if allowed; throws otherwise.
 */
export async function requireOwnerOrStaff(
  ctx: Ctx,
  ownerId: Id<"users"> | undefined,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (isStaff(user)) return user;
  if (ownerId && ownerId === user._id) return user;
  throw new ConvexError({ code: "FORBIDDEN" });
}

/** Writes an audit-log row for a staff action. */
export async function audit(
  ctx: MutationCtx,
  actor: Doc<"users"> | null,
  action: string,
  entityType: string,
  entityId?: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: actor?._id,
    actorEmail: actor?.email,
    action,
    entityType,
    entityId,
    before: before === undefined ? undefined : before,
    after: after === undefined ? undefined : after,
    createdAt: Date.now(),
  });
}

/**
 * Sliding-window rate limiter backed by the `rateLimits` table.
 * Throws ConvexError({ code: "RATE_LIMITED" }) when exceeded.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing || now - existing.windowStart > windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    }
    return;
  }
  if (existing.count >= limit) {
    throw new ConvexError({ code: "RATE_LIMITED", retryAfterMs: windowMs - (now - existing.windowStart) });
  }
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

/** Ensures a number is finite, integer and within bounds. */
export function assertInt(value: number, min: number, max: number, field: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", field, min, max });
  }
  return value;
}

export function assertString(value: string, max: number, field: string, min = 0): string {
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", field, max, min });
  }
  return trimmed;
}
