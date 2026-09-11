# Design notes — Oman Compass Tours

Luxury-Oman brand: deep navy, brushed gold, warm sand. Every screen is designed
for English (LTR) and Arabic (RTL) from the same components.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `navy-950 / 900 / 800` | `#0E0B2E` / `#14113A` / `#1E1A4F` | Page ground, header, cards on dark surfaces |
| `gold-500 / 400 / 600` | `#C9A15C` / `#DDB97A` / `#A8843F` | CTAs, accents, rules, active states |
| `sand-50 / 100` | `#FBF8F2` / `#F6EFE2` | Light surfaces, body text on navy |
| `ink-900 / 500` | `#1B1A2E` / `#5B5A6E` | Text on light surfaces |
| `success / warning / danger` | `#2E7D5B` / `#C98A2B` / `#B4452E` | Booking status, form validation |

Defined once in `src/app/globals.css` (`@theme inline`) and exposed to Tailwind
as `bg-navy-950`, `text-gold-400`, `border-sand-200`, etc. `bg-gold-gradient`
and `shadow-gold` are the two signature utilities for primary buttons.

## Typography

| Role | Latin | Arabic |
| --- | --- | --- |
| Display / headings | Cinzel | Amiri |
| Editorial sub-headings | Cormorant Garamond | Amiri |
| Body / UI | Inter | Tajawal |

Fonts are loaded with `next/font` (`src/lib/fonts.ts`); the `<html>` element
gets the Arabic classes only for `/ar`, so the fallback stack is never used.
The voucher PDF registers Tajawal from `public/fonts` so Arabic renders
correctly in react-pdf.

## Layout & motion

- `container-brand` = max 80rem, 1.5rem gutters (2rem from `md`).
- Section rhythm: 5rem vertical on desktop, 3.5rem on mobile.
- Corners: 0.75rem cards, 0.5rem inputs, pill buttons for filters.
- Motion is limited to `animate-fade-up` on hero content, the slow hero zoom
  and button `hover:brightness-110`; everything respects `prefers-reduced-motion`.

## RTL rules

- Only logical utilities: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`,
  `text-start`, `rounded-ss`, `rounded-se`.
- Icons that imply direction carry `rtl-flip` (or `rtl:-scale-x-100`).
- Numbers, phone numbers, references and prices are wrapped with `dir="ltr"`
  so they read correctly inside Arabic sentences.
- Radix primitives receive the document direction through `Direction.Provider`.

## Dashboards

Staff (`/admin`) and customer (`/account`) dashboards use the same
`DashboardShell`: navy sidebar, light workspace by default and a scoped dark
mode (`.dark` on the shell only, remembered in `localStorage`). Public pages
never inherit the dashboard theme.

## Accessibility

- All interactive elements are reachable by keyboard and have visible focus
  rings (`focus-visible:outline-gold-500`).
- Forms use associated labels, inline error text and `aria-invalid`.
- Chat and toast regions are `aria-live`.
- Colour contrast: gold on navy ≥ 7:1 for text; ink on sand ≥ 12:1.
- A "Skip to content" link is the first focusable element on public pages.

## Screenshots

Captured with `node scripts/screenshots.mjs` and
`node scripts/screenshots-auth.mjs` into `docs/screenshots/`.

### Public site

| Page | English | Arabic |
| --- | --- | --- |
| Home (desktop) | ![](docs/screenshots/en-home-desktop.png) | ![](docs/screenshots/ar-home-desktop.png) |
| Home (mobile) | ![](docs/screenshots/en-home-mobile.png) | ![](docs/screenshots/ar-home-mobile.png) |
| Tours | ![](docs/screenshots/en-tours-desktop.png) | ![](docs/screenshots/ar-tours-desktop.png) |
| Tour detail | ![](docs/screenshots/en-tour-desktop.png) | ![](docs/screenshots/ar-tour-desktop.png) |
| Booking wizard | ![](docs/screenshots/en-book-desktop.png) | ![](docs/screenshots/ar-book-desktop.png) |
| About | ![](docs/screenshots/en-about-desktop.png) | ![](docs/screenshots/ar-about-desktop.png) |
| Contact | ![](docs/screenshots/en-contact-desktop.png) | ![](docs/screenshots/ar-contact-desktop.png) |
| How to book | ![](docs/screenshots/en-booking-methods-desktop.png) | ![](docs/screenshots/ar-booking-methods-desktop.png) |
| Policies | ![](docs/screenshots/en-policies-desktop.png) | ![](docs/screenshots/ar-policies-desktop.png) |
| Cookie consent | ![](docs/screenshots/en-consent-desktop.png) | ![](docs/screenshots/ar-consent-desktop.png) |
| Live chat | ![](docs/screenshots/en-chat-desktop.png) | — |

### Customer dashboard

| Page | English | Arabic |
| --- | --- | --- |
| My bookings | ![](docs/screenshots/en-account-desktop.png) | ![](docs/screenshots/ar-account-desktop.png) |
| Payments | ![](docs/screenshots/en-account-payments-desktop.png) | ![](docs/screenshots/ar-account-payments-desktop.png) |
| Travellers | ![](docs/screenshots/en-account-travellers-desktop.png) | ![](docs/screenshots/ar-account-travellers-desktop.png) |
| Loyalty | ![](docs/screenshots/en-account-loyalty-desktop.png) | ![](docs/screenshots/ar-account-loyalty-desktop.png) |
| Dark mode | ![](docs/screenshots/en-account-dark-desktop.png) | — |

### Staff dashboard

| Page | English | Arabic |
| --- | --- | --- |
| Overview | ![](docs/screenshots/en-admin-desktop.png) | ![](docs/screenshots/ar-admin-desktop.png) |
| Overview (dark) | ![](docs/screenshots/en-admin-dark-desktop.png) | — |
| Bookings | ![](docs/screenshots/en-admin-bookings-desktop.png) | ![](docs/screenshots/ar-admin-bookings-desktop.png) |
| Booking detail | ![](docs/screenshots/en-admin-booking-detail-desktop.png) | — |
| Products | ![](docs/screenshots/en-admin-products-desktop.png) | ![](docs/screenshots/ar-admin-products-desktop.png) |
| Customers | ![](docs/screenshots/en-admin-customers-desktop.png) | ![](docs/screenshots/ar-admin-customers-desktop.png) |
| Leads | ![](docs/screenshots/en-admin-leads-desktop.png) | ![](docs/screenshots/ar-admin-leads-desktop.png) |
| Inbox | ![](docs/screenshots/en-admin-inbox-desktop.png) | ![](docs/screenshots/ar-admin-inbox-desktop.png) |
| Reviews | ![](docs/screenshots/en-admin-reviews-desktop.png) | ![](docs/screenshots/ar-admin-reviews-desktop.png) |
| Content & marketing | ![](docs/screenshots/en-admin-content-desktop.png) | ![](docs/screenshots/ar-admin-content-desktop.png) |
| Payments | ![](docs/screenshots/en-admin-payments-desktop.png) | ![](docs/screenshots/ar-admin-payments-desktop.png) |
| Reports | ![](docs/screenshots/en-admin-reports-desktop.png) | ![](docs/screenshots/ar-admin-reports-desktop.png) |
| Settings | ![](docs/screenshots/en-admin-settings-desktop.png) | ![](docs/screenshots/ar-admin-settings-desktop.png) |
| Audit log | ![](docs/screenshots/en-admin-audit-desktop.png) | ![](docs/screenshots/ar-admin-audit-desktop.png) |
