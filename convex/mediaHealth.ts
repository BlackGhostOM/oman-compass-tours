import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { collectMediaRefs } from "./lib/mediaRefs";

/**
 * Daily safety net for photo references (see convex/lib/mediaRefs.ts).
 *
 * The delete paths that matter already clear the rows pointing at the files they
 * remove. This catches anything that slipped past them — a file deleted straight
 * from the Convex dashboard, or a reference written before that wiring existed —
 * by checking every referenced file still exists and clearing the ones that do
 * not. A cleared field makes the page show its placeholder, which is what the
 * render path already does for a row with no photo.
 *
 * It only ever clears references to files that are genuinely gone, so a healthy
 * deployment is left untouched. Run it by hand with:
 *   npx convex run mediaHealth:healDangling [--prod]
 */
export const healDangling = internalMutation({
  args: {},
  returns: v.object({ checked: v.number(), files: v.number(), cleared: v.array(v.string()), unverifiable: v.number() }),
  handler: async (ctx) => {
    const refs = await collectMediaRefs(ctx);
    const exists = new Map<string, boolean>();
    const cleared: string[] = [];

    // Admin uploads keep only the resolved URL, with no storage id to look up, so those
    // references cannot be checked here. They are counted, not touched. The sweeper no longer
    // deletes their files, so in practice they only break if a file is removed by hand.
    let unverifiable = 0;

    for (const ref of refs) {
      if (ref.ids.length === 0) {
        unverifiable += 1;
        continue;
      }
      let dangling = false;
      for (const id of ref.ids) {
        const key = String(id);
        if (!exists.has(key)) exists.set(key, (await ctx.db.system.get(id)) !== null);
        if (!exists.get(key)) dangling = true;
      }
      if (dangling) {
        await ref.clear();
        cleared.push(ref.where);
      }
    }

    if (cleared.length > 0) {
      console.warn(`[media] cleared ${cleared.length} reference(s) to deleted files: ${cleared.join(", ")}`);
    }
    return { checked: refs.length, files: exists.size, cleared, unverifiable };
  },
});
