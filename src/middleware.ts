import createIntlMiddleware from "next-intl/middleware";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher(["/(en|ar)/account(.*)", "/(en|ar)/admin(.*)"]);
const isAuthRoute = createRouteMatcher(["/(en|ar)/sign-in(.*)", "/(en|ar)/sign-up(.*)"]);

function localeFromPath(pathname: string): "en" | "ar" {
  return pathname.startsWith("/ar") ? "ar" : "en";
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const { pathname } = request.nextUrl;
    const locale = localeFromPath(pathname);

    // Only redirect page navigations; Server Action POSTs must pass through
    // (a redirect response would break the action's fetch).
    const isNavigation = request.method === "GET";
    if (isNavigation && isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      // The sign-in form navigates with the locale-aware router, so the target
      // must be locale-less ("/admin", not "/ar/admin") or the prefix doubles.
      const target = pathname.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
      const redirectTo = encodeURIComponent(target + request.nextUrl.search);
      return nextjsMiddlewareRedirect(request, `/${locale}/sign-in?redirect=${redirectTo}`);
    }
    if (isNavigation && isAuthRoute(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, `/${locale}/account`);
    }
    return intlMiddleware(request);
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Skip Next internals, API routes (except the Convex Auth proxy at /api/auth) and static files
  matcher: ["/((?!api(?!/auth)|_next|_vercel|.*\\..*).*)"],
};
