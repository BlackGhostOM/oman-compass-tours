# Oman Compass Tours — website & booking platform

Bilingual (English / Arabic, full RTL) marketing site and booking platform for
**Oman Compass Tours Company**, Muscat (Ministry of Heritage & Tourism licence
1440944). Built with Next.js 15 (App Router), Tailwind + shadcn/ui, Convex
(database, realtime, auth, crons, file storage), next-intl, react-pdf and
Playwright. Payments through Thawani (Oman), Stripe and PayPal with
server-verified webhooks; transactional email through Resend; AI concierge
through the Claude API with human handoff.

- `PLAN.md` — architecture, data model, routes and phase plan
- `DESIGN.md` — design system and screenshots
- `OPEN_QUESTIONS.md` — decisions taken with defaults that the owner can change

## 1. Local setup

Requirements: Node 20+, npm, Git. Convex runs locally in anonymous mode (no
account needed) and in the cloud for staging/production.

```bash
npm install
cp .env.example .env.local           # fill NEXT_PUBLIC_* values as needed
```

Start the backend and the web app in two terminals:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

```bash
npm run dev
```

The first `convex dev` run writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`
and `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local`.

### Auth keys (once per deployment)

Convex Auth signs sessions with an RSA key pair stored as deployment
environment variables:

```bash
npm run auth:keys
```

This generates `JWT_PRIVATE_KEY` and `JWKS` and sets them with `convex env set`.
Also set `SITE_URL` (e.g. `http://localhost:3000` locally) so auth redirects
resolve.

### Seed data and demo accounts

```bash
npm run seed
```

Seeds 8 categories, 8 destinations, 10 tours/services with bilingual content,
pricing seasons, add-ons, 8 versioned policies, reviews, blog posts, team,
banners, coupons, FX rates and three demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@omancompasstours.com` | `OmanCompass!2026` |
| Staff | `staff@omancompasstours.com` | `OmanCompass!2026` |
| Customer | `customer@example.com` | `Traveller!2026` |

`npm run seed:reset` wipes catalogue/content tables before re-seeding (bookings
and users are kept).

## 2. Environment variables

`.env.example` lists every variable with comments. Two groups:

**Next.js (`.env.local`, public):** `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, optional
`NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`, analytics IDs (`NEXT_PUBLIC_GA4_ID`,
`NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_SNAP_PIXEL_ID`,
`NEXT_PUBLIC_TIKTOK_PIXEL_ID`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.

**Convex deployment secrets (`npx convex env set NAME value`):**

| Area | Variables |
| --- | --- |
| Auth | `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY` |
| Email | `EMAIL_FROM`, `STAFF_NOTIFICATION_EMAIL` |
| Thawani | `THAWANI_SECRET_KEY`, `THAWANI_PUBLISHABLE_KEY`, `THAWANI_MODE` (`uat` / `production`), `THAWANI_WEBHOOK_SECRET` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox` / `live`), `PAYPAL_WEBHOOK_ID` |
| AI chat | `ANTHROPIC_API_KEY` (without it a rule-based fallback answers and still hands off to staff) |
| Anti-abuse | `TURNSTILE_SECRET_KEY` |
| FX | `FX_API_URL` (optional; pegged fallback 1 OMR = 2.6008 USD) |
| Payments policy | `PAYMENTS_TRUST_API_VERIFICATION=true` lets the return page confirm a payment by re-checking the provider API when a webhook is delayed |

Admin → Settings → Payments & integrations shows which of these are configured
without exposing values.

## 3. Payment providers and webhooks

A booking is confirmed only after a webhook whose signature was verified on
the server (`convex/http.ts` → `convex/payments.ts`). Register these endpoints
on the Convex **site** URL (`https://<deployment>.convex.site`):

| Provider | Endpoint | Events |
| --- | --- | --- |
| Stripe | `/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` |
| Thawani | `/webhooks/thawani` | payment success / failure (HMAC secret) |
| PayPal | `/webhooks/paypal` | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED` |

Every event is stored in `webhookEvents` and processed once (idempotent).
Amounts are stored in baisa (OMR × 1000); USD/EUR/GBP are display conversions.
Refunds are issued from the booking page and reconciled through the same
webhooks.

## 4. Deploy (Convex + Vercel)

Live site: **https://www.omancompasstours.com** (staff dashboard at `/en/admin`; the `oman-compass-tours.vercel.app` alias redirects there).
The live setup uses two deployments that are updated independently:

| Piece | Where | How to update |
| --- | --- | --- |
| Backend (database, auth, crons, webhooks) | Convex production deployment `fantastic-sturgeon-674` | `npx convex deploy -y` from a machine logged in with `npx convex login` |
| Website | Vercel project `oman-compass-tours` (team "Black"), linked to GitHub `BlackGhostOM/oman-compass-tours` | every push to `main` builds and deploys automatically |

`.env.production` (committed) carries only the public `NEXT_PUBLIC_*` URLs of the
production backend; Vercel builds with plain `npm run build`. Secrets never go
into the repository: set them on Convex with `npx convex env set --prod NAME value`
(section 2). To switch to the fully automated flow where a Vercel build also
pushes backend changes, set the build command to
`npx convex deploy --cmd 'npm run build'` and add `CONVEX_DEPLOY_KEY` (Convex
dashboard → Settings → Deploy Keys) as a Vercel environment variable.

Checklist after the first deploy:

1. Set `SITE_URL` on Convex production to the final domain and add the domain in
   Vercel (Project → Settings → Domains); update `NEXT_PUBLIC_SITE_URL` in
   `.env.production`.
2. Register the webhooks from section 3 on
   `https://fantastic-sturgeon-674.convex.site/webhooks/<provider>` once payment
   keys are added.
3. Add the production domain to Google OAuth, Stripe, Thawani and PayPal.
4. `vercel.json` sets the region (`fra1`); security headers (CSP, HSTS, frame
   and referrer policies) come from `next.config.ts`.

### Catalogue

The 24 tours and services mirror the company's Viator product list (September
2026). They live in `convex/seedData/tours*.ts` (day tours, short and long
journeys, services); prices are the Viator USD rates converted to OMR, and the
three products without a public price carry the `price-placeholder` tag until
staff set them in Admin → Products. After editing the seed files run

```bash
npx convex run migrations:syncCatalog2026 --prod
```

which upserts by product code, keeps bookings, reviews and uploaded media, and
archives retired codes (`RETIRED_TOUR_CODES`).

Real photos are attached in bulk with `scripts/import-tour-media.mjs` (a JSON
manifest lists the folder, the ordered files, bilingual alt text and the cover
index; photos are auto-rotated, resized to 2400 px and uploaded to Convex
storage, then written to `tourMedia` and the cover in one transaction):

```bash
node scripts/import-tour-media.mjs path/to/manifest.json --prod
```

On Vercel the first view of each photo size/format costs a 2–3 s transcode, so
production imports finish by warming the optimizer cache. To warm every
published tour (for example after a redeploy of the image pipeline):

```bash
node scripts/warm-image-cache.mjs --prod
```

The same command runs every Monday 03:00 UTC via GitHub Actions
(`.github/workflows/warm-image-cache.yml`, also triggerable from the Actions
tab); it needs no secrets because the photo list comes from the public
`mediaImport:imageUrls` query.

Crons (`convex/crons.ts`) run automatically on the production deployment: hold
expiry every 15 minutes, booking lifecycle hourly, reminders and abandoned-draft
follow-ups, FX refresh daily.

## 5. Everyday operations

- **Import / update the catalogue:** Admin → Products → Import. Download the
  JSON or CSV template (`public/templates/`), fill one row per tour (matched by
  `code`; existing tours are updated, new ones are created as drafts), paste
  and run.
- **Media:** upload images (≤ 100 MB) in the tour editor; larger videos are
  hosted externally and linked.
- **Policies:** Admin → Settings → Policies. Publishing a new version forces
  re-acceptance at the next checkout; acceptances are stored per version.
- **Staff accounts:** Admin → Settings → Staff & roles → Invite (link expires
  in 7 days). Roles: customer, staff, admin, owner.
- **Notifications:** email templates live in `convex/lib/email.ts`; WhatsApp
  quick-reply templates are editable in Settings.
- **Backups:** `npx convex export --path backups/$(date +%F).zip` exports every
  table and file; `npx convex import` restores. Schedule it in CI or run it
  before large content changes.
- **Data requests (PDPL):** customers request export/deletion from
  `/account/privacy`; staff process them in Admin → Audit log → Privacy requests.

## 6. Adding a language

1. Add the locale code to `locales` in `src/i18n/routing.ts` and a direction
   in `dirFor`.
2. Copy `messages/en.json` to `messages/<locale>.json` and translate (the merge
   script `node scripts/merge-messages.mjs <locale> patch.json` deep-merges
   partial files).
3. Content fields are bilingual objects (`{ en, ar }`); extend `LocalizedString`
   in `src/lib/content.ts` and the `localized` validator in `convex/schema.ts`
   with the new key, then fill translations in the dashboard editors.
4. Add fonts for the script in `src/lib/fonts.ts` if needed.

## 7. Quality gates

```bash
npm run typecheck
npm run lint
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --project=chromium
```

Lighthouse 12 on the production build (`next build && next start`, Playwright's
headless Chromium, 2026-09-12):

| Page | Desktop perf / a11y / best practices / SEO | Mobile perf / a11y / BP / SEO |
| --- | --- | --- |
| `/en` (home) | 99 / 100 / 100 / 100 | 87 / 100 / 100 / 100 |
| `/ar` (home) | 97 / 100 / 100 / 100 | 75 / 100 / 100 / 100 |
| `/en/tours` | 99 / 100 / 100 / 100 | 84 / 100 / 100 / 100 |
| `/en/about`, `/en/contact`, tour detail | 99 / 100 / 96–100 / 92–100 | — |

SEO 92 on tour and contact pages is only the canonical URL pointing at the
production domain while auditing `localhost`. Mobile performance is bounded by
hydration time on the throttled CPU profile; the heavy dashboards are excluded
from the public bundle and below-the-fold sections use `content-visibility`.

The Playwright suite (`tests/`) covers language switching, tour search and
filters, the booking wizard with reserve-now-pay-later, a signed Stripe webhook
confirming a booking and unlocking the voucher, customer sign-in and voucher
download, staff booking status changes with audit trail, the cookie consent
banner and the live chat with human handoff. Screenshots for `DESIGN.md` are
produced by `node scripts/screenshots.mjs` and `node scripts/screenshots-auth.mjs`.

## 8. Project layout

```
convex/            schema, auth, http routes, crons, bookings, payments, gateways/, admin/, chat
messages/          en.json, ar.json (next-intl)
public/            brand assets, placeholders, fonts, import templates
scripts/           seed helpers, screenshots, message merge, auth keys
src/app/[locale]/  (site) public pages · account/ customer dashboard · admin/ staff dashboard
src/components/    ui (shadcn), layout, home, booking, chat, admin, analytics
src/i18n/          routing, request config, navigation helpers
tests/             Playwright specs
```
