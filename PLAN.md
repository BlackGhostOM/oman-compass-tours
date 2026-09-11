# Oman Compass Tours — Build Plan

> Bilingual (EN/AR) marketing site + booking platform for **Oman Compass Tours Company**, Muscat.
> Stack (fixed): Next.js 15 App Router · TypeScript · Tailwind v4 + shadcn/ui · Convex (DB, auth, storage, crons, HTTP actions) · next-intl · Thawani / Stripe / PayPal · Resend · Vercel.

## 1. Architecture

```
Browser ──► Next.js 15 (Vercel)
             ├─ /[locale]/(public)   marketing, tours, booking wizard, checkout
             ├─ /[locale]/account    customer dashboard (auth: customer+)
             ├─ /[locale]/admin      staff dashboard (auth: staff | admin | owner)
             ├─ app/api/*            thin route handlers (ICS, voucher PDF, sitemap)
             └─ proxy (middleware)   next-intl locale routing + Convex Auth cookies
                     │
                     ▼
            Convex deployment
             ├─ schema.ts            all tables + indexes (below)
             ├─ queries/mutations    RBAC enforced in every function (lib/access.ts)
             ├─ actions              payments (provider adapters), email (Resend), AI chat (Claude)
             ├─ http.ts              webhooks: /webhooks/thawani | /stripe | /paypal  (signature-verified, idempotent)
             ├─ crons.ts             reminders (T-24h), hold expiry, abandoned booking follow-ups, SLA checks
             └─ storage              media, passport/ID uploads (encrypted flag), voucher PDFs
```

**Key design rules**

- Bilingual *content* lives in the DB as `{ en, ar }` objects (`LocalizedString`); UI strings live in `messages/{en,ar}.json`.
- Money is stored as **baisa** (integer, 1 OMR = 1000 baisa) in `OMR`. Display conversions use a cached FX table (`fxRates`).
- Booking is confirmed **only** by a verified webhook → `payments` row → `bookings.status = confirmed`.
- Role checks happen inside Convex functions via `requireRole(ctx, ["staff","admin","owner"])`, never only in the UI.
- Every staff write emits an `auditLogs` row.
- RTL: `dir` set on `<html>` per locale; only Tailwind logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`).

## 2. Data model (Convex)

| Table | Purpose | Key indexes |
| --- | --- | --- |
| `users` (authTables) | Convex Auth user + `role`, `locale`, `phone`, `nationality`, `tags`, `loyaltyPoints`, `referralCode` | `email`, `by_role`, `by_referralCode` |
| `categories` | Tour categories (editable) | `by_slug_en`, `by_slug_ar`, `by_order` |
| `destinations` | Destinations grid | `by_slug_en`, `by_slug_ar`, `by_order` |
| `tours` | Products/services; bilingual fields, pricing model, SEO, media, itinerary, FAQs | `by_slug_en`, `by_slug_ar`, `by_category`, `by_status`, `by_featured`, `search_title` |
| `tourMedia` | Ordered images/videos per tour (storage ids) | `by_tour_order` |
| `pricingSeasons` | Seasonal overrides per tour | `by_tour` |
| `availability` | Per-date capacity / blackout | `by_tour_date` |
| `addOns` | Optional extras (pickup, meals, private guide) | `by_tour` |
| `bookings` | Booking header (status workflow, totals, traveller, policy acceptance, voucher) | `by_reference`, `by_user`, `by_tour_date`, `by_status`, `by_date`, `by_holdExpiry` |
| `bookingItems` | Line items (adults/children/group/add-ons) | `by_booking` |
| `bookingDrafts` | Resumable wizard state | `by_user`, `by_session` |
| `payments` | Audit table: provider, intent/session id, amount, currency, status, raw webhook | `by_booking`, `by_provider_ref`, `by_idempotency` |
| `paymentLinks` | Staff-issued pay links | `by_token`, `by_booking` |
| `refunds` | Refund requests/results | `by_payment`, `by_booking` |
| `fxRates` | Cached display conversion rates | `by_base` |
| `coupons` | Promotions engine | `by_code` |
| `reviews` | Customer reviews + moderation/featured flags | `by_tour`, `by_status`, `by_featured`, `by_user` |
| `leads` | Contact form / chat handoff / offline chat / newsletter | `by_status`, `by_assignee`, `by_source`, `by_email` |
| `travellers` | Saved family members / ID documents | `by_user` |
| `wishlists` | Saved tours | `by_user`, `by_user_tour` |
| `conversations` / `messages` | Chat widget + inbox (AI + human) | `by_user`, `by_status`, `by_assignee`, `by_conversation` |
| `policies` / `policyVersions` | Legal docs (versioned) | `by_key`, `by_policy_version` |
| `policyAcceptances` | Who accepted what version, when, IP | `by_booking`, `by_user` |
| `blogPosts` | Bilingual blog | `by_slug_en`, `by_slug_ar`, `by_status`, `by_publishedAt` |
| `banners` / `siteSettings` / `seoMeta` | CMS content | `by_key`, `by_path` |
| `newsletterSubscribers` | Newsletter | `by_email` |
| `staffInvites` | Staff onboarding | `by_email`, `by_token` |
| `auditLogs` | Staff actions | `by_actor`, `by_entity`, `by_createdAt` |
| `notifications` | Outbound email/WhatsApp log | `by_booking`, `by_status` |
| `rateLimits` | Simple sliding window counters | `by_key` |
| `dataRequests` | GDPR/PDPL export & deletion requests | `by_user`, `by_status` |

Full schema: [`convex/schema.ts`](convex/schema.ts).

## 3. Routes

| Route (`/en` or `/ar`) | Page |
| --- | --- |
| `/` | Home (hero video, featured tours, why us, destinations, reels, reviews, trust strip, newsletter) |
| `/tours`, `/tours/[slug]`, `/services` | Catalog with filters; tour detail; services (transfers, custom itineraries) |
| `/destinations/[slug]` | Destination landing |
| `/book/[slug]` | 5-step booking wizard |
| `/checkout/[reference]`, `/checkout/[reference]/success` | Payment provider selection + return pages |
| `/booking-methods` | Ways to book comparison |
| `/about`, `/contact`, `/policies/[key]`, `/blog`, `/blog/[slug]`, `/plan-my-trip` | Content pages |
| `/sign-in`, `/sign-up`, `/forgot-password` | Auth |
| `/account/*` | bookings, payments, profile, travellers, wishlist, reviews, messages, loyalty |
| `/admin/*` | overview, bookings, products, customers, leads, inbox, reviews, content, payments, reports, settings, audit |

## 4. Phased roadmap

| Phase | Scope | Verify |
| --- | --- | --- |
| **1** | PLAN, Convex schema, design tokens, fonts, shadcn base, i18n routing, header/footer/language switcher, WhatsApp button | `tsc`, `lint`, `build`, screenshots EN/AR |
| **2** | Public pages with seeded content (10 real tours, categories, destinations, reviews, policies, blog) + import template | same + seed run |
| **3** | Booking wizard, drafts, checkout, `PaymentProvider` + Thawani/Stripe/PayPal adapters, webhooks, vouchers, ICS, emails | Playwright booking flow (Stripe test) |
| **4** | Convex Auth (password, magic link, Google), roles, customer dashboard | Playwright auth + voucher download |
| **5** | Staff dashboard, CRM, leads, inbox, products CRUD, payments/refunds, reports, settings, audit log | Playwright staff status change |
| **6** | AI chat (Claude) + handoff, promotions, blog, SEO (JSON-LD, sitemap, hreflang), analytics behind consent, Lighthouse ≥ 90 | Lighthouse + full test suite |

## 5. Open decisions

Tracked in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) with the default chosen for each.
