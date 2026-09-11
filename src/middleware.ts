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

    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      const redirectTo = encodeURIComponent(pathname + request.nextUrl.search);
      return nextjsMiddlewareRedirect(request, `/${locale}/sign-in?redirect=${redirectTo}`);
    }
    if (isAuthRoute(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, `/${locale}/account`);
    }
    return intlMiddleware(request);
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Skip Next internals, API routes, and static files (anything with an extension)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
