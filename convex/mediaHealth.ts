import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { collectMediaRefs, liveFiles } from "./lib/mediaRefs";

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
 * References are matched by storage id AND by resolved URL, so a row written by
 * the admin upload widget (which keeps no id) is checked just like a CLI import.
 *
 * It only ever clears references to files that are genuinely gone, so a healthy
 * deployment is left untouched. Run it by hand with:
 *   npx convex run mediaHealth:healDangling [--prod]
 */
export const healDangling = internalMutation({
  args: {},
  returns: v.object({ checked: v.number(), files: v.number(), cleared: v.array(v.string()), unverifiable: v.number(), truncated: v.boolean() }),
  handler: async (ctx) => {
    const refs = await collectMediaRefs(ctx);
    const live = await liveFiles(ctx);
    const cleared: string[] = [];
    // A reference with neither an id nor a storage URL has nothing to check: it points at a
    // static /media/placeholders/… file, which ships with the site and cannot go missing.
    let unverifiable = 0;

    for (const ref of refs) {
      const idGone = ref.ids.some((id) => !live.ids.has(String(id)));
      // A URL missing from a TRUNCATED listing proves nothing, so only trust a complete one.
      const urlGone = live.complete && ref.urls.some((u) => !live.urls.has(u));
      if (ref.ids.length === 0 && ref.urls.length > 0 && !live.complete) unverifiable += 1;
      if (idGone || urlGone) {
        await ref.clear();
        cleared.push(ref.where);
      }
    }

    if (cleared.length > 0) {
      console.warn(`[media] cleared ${cleared.length} reference(s) to deleted files: ${cleared.join(", ")}`);
    }
    if (!live.complete) console.warn(`[media] storage listing hit the ${live.count}-file cap; URL-only references were left alone`);
    return { checked: refs.length, files: live.count, cleared, unverifiable, truncated: !live.complete };
  },
});
