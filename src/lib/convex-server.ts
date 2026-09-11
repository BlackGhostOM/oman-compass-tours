import { fetchQuery as convexFetchQuery, preloadQuery as convexPreloadQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Server-component query helper. Returns `null` instead of throwing when the
 * Convex deployment is unreachable (e.g. during a static build without a
 * backend) so pages can render an empty state rather than fail.
 */
export async function fetchPublic<Q extends FunctionReference<"query", "public">>(
  query: Q,
  ...args: OptionalRestArgs<Q>
): Promise<FunctionReturnType<Q> | null> {
  if (!url) return null;
  try {
    return await convexFetchQuery(query, ...args);
  } catch (err) {
    console.error("[convex] fetchQuery failed:", (err as Error).message);
    return null;
  }
}

/** Authenticated server-side fetch (passes the Convex Auth token from cookies). */
export async function fetchAuthed<Q extends FunctionReference<"query", "public">>(
  query: Q,
  ...args: OptionalRestArgs<Q>
): Promise<FunctionReturnType<Q> | null> {
  if (!url) return null;
  try {
    const token = await convexAuthNextjsToken();
    const [a] = args as [Record<string, unknown> | undefined];
    return await convexFetchQuery(query, (a ?? {}) as never, { token });
  } catch (err) {
    console.error("[convex] fetchAuthed failed:", (err as Error).message);
    return null;
  }
}

export const preloadQuery = convexPreloadQuery;
