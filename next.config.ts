import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? convexUrl.replace(".cloud", ".site");
const convexWs = convexUrl.replace(/^http/, "ws");

/**
 * Content-Security-Policy that allows the payment providers, maps, fonts,
 * Convex and the analytics vendors used behind cookie consent.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://js.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://sc-static.net https://analytics.tiktok.com https://challenges.cloudflare.com https://va.vercel-scripts.com https://maps.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${convexUrl} ${convexSiteUrl} ${convexWs} https://*.convex.cloud wss://*.convex.cloud https://*.convex.site http://127.0.0.1:* ws://127.0.0.1:* https://api.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.facebook.com https://tr.snapchat.com https://analytics.tiktok.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://checkout.thawani.om https://uatcheckout.thawani.om`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://challenges.cloudflare.com https://checkout.thawani.om https://uatcheckout.thawani.om",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.thawani.om https://uatcheckout.thawani.om https://www.paypal.com https://www.sandbox.paypal.com https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .join("; ")
  .replace(/\s+/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self \"https://js.stripe.com\" \"https://www.paypal.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.convex.cloud" },
      { protocol: "https", hostname: "*.convex.site" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
