import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Creates an email+password account through Convex Auth's sign-up flow so the
 * password hash is stored exactly as it would be for a real sign-up.
 */
export const createPasswordAccount = internalAction({
  args: { email: v.string(), password: v.string(), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: { email: args.email, password: args.password, name: args.name, flow: "signUp" },
    });
    return null;
  },
});
