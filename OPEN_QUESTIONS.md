# Open Questions

Decisions that need the owner's input. Each one has a **default already applied** so nothing blocks the build — change it in the admin panel or tell me and I will update the code.

| # | Question | Default applied | Where to change |
| --- | --- | --- | --- |
| 1 | Prices for tours 6–10 (Traditional Dinner, 2-Day Jabal Akhdar, 3-Day, 6-Day, 8-Day) were `[[PRICE]]` in the brief. | Dinner **OMR 45 / group**; 2-Day **OMR 185 / person**; 3-Day **OMR 295 / person**; 6-Day **OMR 590 / person**; 8-Day **OMR 790 / person** — clearly placeholder. | Admin → Products → edit tour pricing |
| 2 | Tours 1–5 are priced in USD on Viator. Base currency is OMR; the seed converts at the pegged rate (1 OMR = 2.6008 USD) and rounds to the nearest OMR. | e.g. $230 → OMR 88; $179 → OMR 69; $188 → OMR 72; $197 → OMR 76; $300 → OMR 115 | Admin → Products |
| 3 | Deposit percentage per tour. | Day tours: 100 % (full payment). Multi-day: 30 % deposit, balance due 7 days before departure. | Admin → Products → Pricing |
| 4 | Reserve-now-pay-later hold duration. | 24 hours for day tours, 48 hours for multi-day packages. | Admin → Settings → Booking |
| 5 | Which Google Maps embed to use — the address in the brief did not include coordinates. | Query-based embed for "Oman Compass Tours, Bawshar, Muscat" (no API key needed). | `src/lib/site.ts` → `geo`, `mapsEmbedUrl` |
| 6 | Social media handles (Instagram, Snapchat, TikTok, Facebook, X) were not provided. | `omancompasstours` on every network. | `src/lib/site.ts` → `social` or Admin → Settings → Company |
| 7 | Viator listing URL. | Generic Viator Muscat page until the exact product URL is provided. | `src/lib/site.ts` → `viatorUrl` |
| 8 | Team members beyond guide Musab (photos, bios, names). | Seeded: Musab (Senior Guide) + two placeholder profiles marked "placeholder". | Admin → Content → Team |
| 9 | Legal text for the eight policies. | Professional placeholder drafts marked **FOR LEGAL REVIEW** in both languages. Version 1 seeded. | Admin → Settings → Policies |
| 10 | Thawani account: production keys and webhook secret; whether OmanNet debit cards should be routed via Thawani only. | UAT sandbox mode; Thawani default for OM/GCC visitors, Stripe otherwise. | Convex env vars (`THAWANI_*`) |
| 11 | Company profile PDF for the About page download slot. | Slot renders a "coming soon" state until a PDF is uploaded. | Admin → Content → Company profile |
| 12 | Hero background video. | Uses a still poster with slow zoom until a video is uploaded (autoplay video is wired and muted). | Admin → Content → Home hero |
| 13 | Analytics IDs (GA4, Meta, Snapchat, TikTok). | Pixels are wired but inactive until IDs are set; all load only after cookie consent. | `.env.local` (`NEXT_PUBLIC_*_ID`) |
| 14 | Google OAuth client for "Sign in with Google". | Button shows but is disabled until `AUTH_GOOGLE_ID/SECRET` are set. | Convex env vars |
| 15 | Loyalty programme rules (points per OMR, redemption). | 1 point per OMR spent, display-only placeholder; no redemption yet. | `convex/loyalty.ts` |
| 16 | Real Tripadvisor / Viator review text. The brief only gave the aggregate (5.0, 70+ reviews). | Six representative sample reviews are seeded with `source` set to tripadvisor / viator / google and clearly generic wording; the aggregate badge uses the real 5.0 / 70+ figures. Replace them via Admin → Reviews (remove) and Import external review. | Admin → Reviews |
| 17 | Anthropic API key for the AI concierge. | Without `ANTHROPIC_API_KEY` the chat uses a rule-based fallback (prices, cancellation, generic help) and still hands off to staff. With the key it uses Claude Opus 5 with the live catalogue + policies as context. | Convex env vars |
| 18 | Chat online hours and expected response time. | 07:30–19:30 Asia/Muscat, ~10 minutes. Offline visitors are told the hours and offered WhatsApp. | Admin → Settings → Booking & support |
| 19 | Promo strip on the home page. | Seeded "Winter season is open" banner with a 21-day countdown from seeding (code EARLYBIRD, 8 %). | Admin → Content → Banners |

## Known non-blocking notes

- **Dev-only hydration warning.** In `next dev`, React logs a `useId` mismatch on the header language dropdown. It comes from the Next.js dev overlay changing the sibling count at the document root; production builds do not log it (verified in the Lighthouse run). No user-facing effect.
- **Stripe hosted checkout test** in `tests/booking.spec.ts` is skipped unless `STRIPE_SECRET_KEY` is set on the Convex deployment; the webhook-confirmation test always runs with a locally signed payload.

