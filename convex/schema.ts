import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/* ------------------------------------------------------------------ */
/* Shared validators                                                   */
/* ------------------------------------------------------------------ */

/** Bilingual text stored in the database. */
export const localized = v.object({ en: v.string(), ar: v.string() });
export const localizedOptional = v.optional(localized);

export const roleValidator = v.union(
  v.literal("customer"),
  v.literal("staff"),
  v.literal("admin"),
  v.literal("owner"),
);

export const localeValidator = v.union(v.literal("en"), v.literal("ar"));

export const currencyValidator = v.union(
  v.literal("OMR"),
  v.literal("USD"),
  v.literal("EUR"),
  v.literal("GBP"),
  v.literal("AED"),
  v.literal("SAR"),
);

export const pricingModelValidator = v.union(
  v.literal("per_group"),
  v.literal("per_person"),
);

export const bookingStatusValidator = v.union(
  v.literal("inquiry"),
  v.literal("pending_payment"),
  v.literal("confirmed"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("refunded"),
);

export const paymentProviderValidator = v.union(
  v.literal("thawani"),
  v.literal("stripe"),
  v.literal("paypal"),
  v.literal("manual"),
);

export const paymentStatusValidator = v.union(
  v.literal("created"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded"),
  v.literal("partially_refunded"),
);

export const paymentKindValidator = v.union(
  v.literal("full"),
  v.literal("deposit"),
  v.literal("balance"),
  v.literal("link"),
);

export const mediaValidator = v.object({
  kind: v.union(v.literal("image"), v.literal("video")),
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()), // external / static fallback
  posterStorageId: v.optional(v.id("_storage")),
  posterUrl: v.optional(v.string()),
  alt: localized,
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  blurDataUrl: v.optional(v.string()),
});

export const seoValidator = v.object({
  title: localizedOptional,
  description: localizedOptional,
  ogImageUrl: v.optional(v.string()),
  noIndex: v.optional(v.boolean()),
});

export const itineraryDayValidator = v.object({
  title: localized,
  body: localized,
  time: v.optional(v.string()), // "08:00" for single-day tours, "Day 1" for multi-day
});

export const faqValidator = v.object({ question: localized, answer: localized });

export const travellerValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  nationality: v.string(), // ISO-3166 alpha-2
  phone: v.string(), // E.164
  email: v.string(),
  hotel: v.optional(v.string()),
  pickupLocation: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  preferredLanguage: localeValidator,
});

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export default defineSchema({
  ...authTables,

  /** Extends the Convex Auth users table. */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App fields
    role: v.optional(roleValidator),
    locale: v.optional(localeValidator),
    nationality: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    leadSource: v.optional(v.string()),
    loyaltyPoints: v.optional(v.number()),
    referralCode: v.optional(v.string()),
    referredBy: v.optional(v.id("users")),
    marketingOptIn: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"])
    .index("by_referralCode", ["referralCode"]),

  categories: defineTable({
    key: v.string(), // stable machine key, e.g. "city_tours"
    name: localized,
    slug: localized,
    description: localizedOptional,
    icon: v.optional(v.string()), // lucide icon name
    order: v.number(),
    isActive: v.boolean(),
  })
    .index("by_key", ["key"])
    .index("by_slug_en", ["slug.en"])
    .index("by_slug_ar", ["slug.ar"])
    .index("by_order", ["order"]),

  destinations: defineTable({
    key: v.string(),
    name: localized,
    slug: localized,
    tagline: localizedOptional,
    description: localizedOptional,
    region: v.optional(v.string()),
    image: v.optional(mediaValidator),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    order: v.number(),
    isActive: v.boolean(),
    seo: v.optional(seoValidator),
  })
    .index("by_key", ["key"])
    .index("by_slug_en", ["slug.en"])
    .index("by_slug_ar", ["slug.ar"])
    .index("by_order", ["order"]),

  tours: defineTable({
    // Identity
    code: v.string(), // e.g. "OCT-001"
    kind: v.union(v.literal("tour"), v.literal("service")),
    title: localized,
    slug: localized,
    summary: localized,
    description: localized,
    highlights: v.array(localized),
    itinerary: v.array(itineraryDayValidator),
    inclusions: v.array(localized),
    exclusions: v.array(localized),
    faqs: v.array(faqValidator),
    categoryId: v.id("categories"),
    secondaryCategoryIds: v.optional(v.array(v.id("categories"))),
    destinationIds: v.array(v.id("destinations")),
    // Logistics
    durationLabel: localized, // "4–5 hours", "2 days"
    durationMinutes: v.number(), // for filtering/sorting
    durationDays: v.number(), // 1 for day tours
    startTimes: v.array(v.string()), // ["08:00","14:00"]
    meetingPoint: v.optional(
      v.object({
        label: localized,
        address: v.optional(v.string()),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
        mapsUrl: v.optional(v.string()),
      }),
    ),
    pickupIncluded: v.boolean(),
    guideLanguages: v.array(v.string()), // ISO 639-1
    minGroup: v.number(),
    maxGroup: v.number(),
    defaultCapacityPerSlot: v.number(),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("moderate"), v.literal("challenging")),
    ),
    // Pricing (baisa, OMR)
    pricingModel: pricingModelValidator,
    priceGroup: v.optional(v.number()),
    priceAdult: v.optional(v.number()),
    priceChild: v.optional(v.number()),
    childAgeMax: v.optional(v.number()),
    infantAgeMax: v.optional(v.number()),
    priceFrom: v.number(), // denormalised "from" price for cards
    compareAtPriceFrom: v.optional(v.number()),
    depositPercent: v.number(), // 0-100, 100 = full payment required
    freeCancellationHours: v.number(), // 0 = non-refundable
    allowReserveNowPayLater: v.boolean(),
    holdHours: v.number(),
    // Media
    coverImage: v.optional(mediaValidator),
    video: v.optional(mediaValidator),
    // Ratings (denormalised from reviews + external)
    ratingAverage: v.number(),
    ratingCount: v.number(),
    externalReviewCount: v.optional(v.number()),
    tripadvisorUrl: v.optional(v.string()),
    viatorUrl: v.optional(v.string()),
    // Publishing
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    isFeatured: v.boolean(),
    featuredOrder: v.optional(v.number()),
    tags: v.array(v.string()),
    seo: v.optional(seoValidator),
    searchText: v.string(), // en + ar titles/summary for full-text search
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_slug_en", ["slug.en"])
    .index("by_slug_ar", ["slug.ar"])
    .index("by_status", ["status"])
    .index("by_status_kind", ["status", "kind"])
    .index("by_category", ["categoryId", "status"])
    .index("by_featured", ["status", "isFeatured", "featuredOrder"])
    .index("by_priceFrom", ["status", "priceFrom"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["status", "kind", "categoryId"],
    }),

  tourMedia: defineTable({
    tourId: v.id("tours"),
    media: mediaValidator,
    order: v.number(),
  }).index("by_tour_order", ["tourId", "order"]),

  pricingSeasons: defineTable({
    tourId: v.id("tours"),
    name: localized,
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),
    priceGroup: v.optional(v.number()),
    priceAdult: v.optional(v.number()),
    priceChild: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_tour", ["tourId", "startDate"]),

  availability: defineTable({
    tourId: v.id("tours"),
    date: v.string(), // YYYY-MM-DD
    startTime: v.optional(v.string()),
    capacity: v.number(),
    booked: v.number(),
    isBlackout: v.boolean(),
    note: v.optional(v.string()),
  })
    .index("by_tour_date", ["tourId", "date"])
    .index("by_date", ["date"]),

  addOns: defineTable({
    tourId: v.optional(v.id("tours")), // undefined = global add-on
    key: v.string(),
    name: localized,
    description: localizedOptional,
    price: v.number(), // baisa
    priceType: v.union(v.literal("per_booking"), v.literal("per_person")),
    isActive: v.boolean(),
    order: v.number(),
  })
    .index("by_tour", ["tourId", "order"])
    .index("by_key", ["key"]),

  bookingDrafts: defineTable({
    sessionKey: v.string(), // anonymous cookie id
    userId: v.optional(v.id("users")),
    tourId: v.id("tours"),
    step: v.number(),
    data: v.any(), // wizard state (validated by Zod on the client + on finalize)
    locale: localeValidator,
    lastTouchedAt: v.number(),
    remindedAt: v.optional(v.number()),
    convertedBookingId: v.optional(v.id("bookings")),
  })
    .index("by_session", ["sessionKey"])
    .index("by_user", ["userId"])
    .index("by_lastTouched", ["lastTouchedAt"]),

  bookings: defineTable({
    reference: v.string(), // e.g. OCT-2A9F3K
    userId: v.optional(v.id("users")),
    tourId: v.id("tours"),
    tourTitle: localized, // snapshot
    date: v.string(),
    startTime: v.optional(v.string()),
    adults: v.number(),
    children: v.number(),
    infants: v.number(),
    groupSize: v.number(),
    pricingModel: pricingModelValidator,
    currency: v.literal("OMR"),
    subtotal: v.number(),
    addOnsTotal: v.number(),
    discountTotal: v.number(),
    couponCode: v.optional(v.string()),
    total: v.number(),
    depositDue: v.number(),
    amountPaid: v.number(),
    amountRefunded: v.number(),
    displayCurrency: v.optional(currencyValidator),
    traveller: travellerValidator,
    locale: localeValidator,
    status: bookingStatusValidator,
    paymentMethodPreference: v.optional(paymentProviderValidator),
    holdExpiresAt: v.optional(v.number()),
    policyVersionIds: v.array(v.id("policyVersions")),
    source: v.union(
      v.literal("web"),
      v.literal("whatsapp"),
      v.literal("phone"),
      v.literal("email"),
      v.literal("office"),
      v.literal("viator"),
      v.literal("tripadvisor"),
      v.literal("staff"),
    ),
    assignedGuideName: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    voucherStorageId: v.optional(v.id("_storage")),
    voucherToken: v.string(), // for public voucher/QR verification
    reminderSentAt: v.optional(v.number()),
    reviewRequestedAt: v.optional(v.number()),
    createdByStaffId: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_reference", ["reference"])
    .index("by_user", ["userId", "date"])
    .index("by_tour_date", ["tourId", "date"])
    .index("by_status", ["status", "date"])
    .index("by_date", ["date"])
    .index("by_holdExpiry", ["status", "holdExpiresAt"])
    .index("by_voucherToken", ["voucherToken"])
    .index("by_email", ["traveller.email"]),

  bookingItems: defineTable({
    bookingId: v.id("bookings"),
    kind: v.union(
      v.literal("adult"),
      v.literal("child"),
      v.literal("infant"),
      v.literal("group"),
      v.literal("addon"),
      v.literal("discount"),
    ),
    label: localized,
    quantity: v.number(),
    unitPrice: v.number(),
    total: v.number(),
    addOnId: v.optional(v.id("addOns")),
  }).index("by_booking", ["bookingId"]),

  payments: defineTable({
    bookingId: v.id("bookings"),
    provider: paymentProviderValidator,
    kind: paymentKindValidator,
    amount: v.number(), // in provider currency minor units
    currency: currencyValidator,
    amountOmr: v.number(), // baisa equivalent
    fxRate: v.optional(v.number()),
    status: paymentStatusValidator,
    providerSessionId: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    rawEvent: v.optional(v.any()),
    paidAt: v.optional(v.number()),
    refundedAmount: v.number(),
    createdByStaffId: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_booking", ["bookingId"])
    .index("by_provider_session", ["provider", "providerSessionId"])
    .index("by_provider_payment", ["provider", "providerPaymentId"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_status", ["status"]),

  webhookEvents: defineTable({
    provider: paymentProviderValidator,
    eventId: v.string(),
    type: v.string(),
    receivedAt: v.number(),
    processed: v.boolean(),
    error: v.optional(v.string()),
  }).index("by_provider_event", ["provider", "eventId"]),

  paymentLinks: defineTable({
    bookingId: v.id("bookings"),
    token: v.string(),
    amountOmr: v.number(),
    kind: paymentKindValidator,
    description: v.optional(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    paymentId: v.optional(v.id("payments")),
    createdByStaffId: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_booking", ["bookingId"]),

  refunds: defineTable({
    paymentId: v.id("payments"),
    bookingId: v.id("bookings"),
    amount: v.number(), // provider minor units
    amountOmr: v.number(),
    reason: v.string(),
    status: v.union(
      v.literal("requested"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    providerRefundId: v.optional(v.string()),
    error: v.optional(v.string()),
    requestedByStaffId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_booking", ["bookingId"]),

  fxRates: defineTable({
    base: v.literal("OMR"),
    quote: currencyValidator,
    rate: v.number(), // 1 OMR = rate x quote
    fetchedAt: v.number(),
    source: v.string(),
  }).index("by_quote", ["quote"]),

  coupons: defineTable({
    code: v.string(),
    name: localized,
    type: v.union(v.literal("percent"), v.literal("fixed")),
    value: v.number(), // percent or baisa
    minSubtotal: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    tourIds: v.optional(v.array(v.id("tours"))),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    usedCount: v.number(),
    minGroupSize: v.optional(v.number()),
    earlyBirdDays: v.optional(v.number()), // discount only if booked >= N days ahead
    isActive: v.boolean(),
  }).index("by_code", ["code"]),

  reviews: defineTable({
    tourId: v.optional(v.id("tours")),
    bookingId: v.optional(v.id("bookings")),
    userId: v.optional(v.id("users")),
    authorName: v.string(),
    authorCountry: v.optional(v.string()),
    rating: v.number(), // 1-5
    title: v.optional(v.string()),
    body: v.string(),
    language: localeValidator,
    source: v.union(
      v.literal("site"),
      v.literal("tripadvisor"),
      v.literal("viator"),
      v.literal("google"),
    ),
    externalUrl: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isFeatured: v.boolean(),
    staffReply: v.optional(v.string()),
    staffReplyAt: v.optional(v.number()),
    moderatedBy: v.optional(v.id("users")),
  })
    .index("by_tour", ["tourId", "status"])
    .index("by_status", ["status"])
    .index("by_featured", ["status", "isFeatured"])
    .index("by_user", ["userId"])
    .index("by_booking", ["bookingId"]),

  leads: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    message: v.string(),
    locale: localeValidator,
    source: v.union(
      v.literal("contact_form"),
      v.literal("trip_planner"),
      v.literal("chat_offline"),
      v.literal("chat_handoff"),
      v.literal("chat"),
      v.literal("newsletter"),
      v.literal("whatsapp"),
      v.literal("phone"),
      v.literal("abandoned_booking"),
      v.literal("manual"),
      v.literal("partner"),
    ),
    partner: v.optional(
      v.object({
        company: v.optional(v.string()),
        country: v.string(),
        city: v.string(),
        website: v.optional(v.string()),
        businessType: v.string(),
        markets: v.array(v.string()),
        clientTypes: v.array(v.string()),
        bookingsPerYear: v.optional(v.string()),
        interests: v.array(v.string()),
      }),
    ),
    tourId: v.optional(v.id("tours")),
    conversationId: v.optional(v.id("conversations")),
    bookingDraftId: v.optional(v.id("bookingDrafts")),
    tripDetails: v.optional(
      v.object({
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        travellers: v.optional(v.number()),
        budget: v.optional(v.string()),
        interests: v.optional(v.array(v.string())),
      }),
    ),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("qualified"),
      v.literal("converted"),
      v.literal("lost"),
    ),
    assigneeId: v.optional(v.id("users")),
    slaDueAt: v.number(),
    firstResponseAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    pagePath: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_status", ["status", "slaDueAt"])
    .index("by_assignee", ["assigneeId", "status"])
    .index("by_source", ["source"])
    .index("by_email", ["email"])
    .index("by_conversation", ["conversationId"]),

  travellers: defineTable({
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    relationship: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    nationality: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    passportExpiry: v.optional(v.string()),
    documentStorageId: v.optional(v.id("_storage")),
    documentEncrypted: v.optional(v.boolean()),
    dietary: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  wishlists: defineTable({
    userId: v.id("users"),
    tourId: v.id("tours"),
  })
    .index("by_user", ["userId"])
    .index("by_user_tour", ["userId", "tourId"]),

  conversations: defineTable({
    userId: v.optional(v.id("users")),
    sessionKey: v.optional(v.string()), // anonymous visitors
    guestName: v.optional(v.string()),
    guestPhone: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    locale: localeValidator,
    status: v.union(
      v.literal("ai"),
      v.literal("waiting_human"),
      v.literal("human"),
      v.literal("closed"),
    ),
    assigneeId: v.optional(v.id("users")),
    subject: v.optional(v.string()),
    tourId: v.optional(v.id("tours")),
    bookingId: v.optional(v.id("bookings")),
    pagePath: v.optional(v.string()),
    lastMessageAt: v.number(),
    lastMessagePreview: v.optional(v.string()),
    unreadForStaff: v.number(),
    unreadForCustomer: v.number(),
    handoffReason: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
    notifiedNewAt: v.optional(v.number()),
    notifiedHandoffAt: v.optional(v.number()),
    guestPreferredChannel: v.optional(v.string()),
  })
    .index("by_user", ["userId", "lastMessageAt"])
    .index("by_session", ["sessionKey"])
    .index("by_status", ["status", "lastMessageAt"])
    .index("by_assignee", ["assigneeId", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("customer"),
      v.literal("assistant"),
      v.literal("staff"),
      v.literal("system"),
    ),
    authorId: v.optional(v.id("users")),
    body: v.string(),
    attachments: v.optional(v.array(v.id("_storage"))),
    aiConfidence: v.optional(v.number()),
    aiSuggestedHandoff: v.optional(v.boolean()),
    readByStaffAt: v.optional(v.number()),
    readByCustomerAt: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  policies: defineTable({
    key: v.string(), // terms | cancellation | refund | privacy | cookies | waiver | child | payment
    title: localized,
    order: v.number(),
    currentVersionId: v.optional(v.id("policyVersions")),
    requiredAtCheckout: v.boolean(),
  }).index("by_key", ["key"]),

  policyVersions: defineTable({
    policyId: v.id("policies"),
    version: v.number(),
    body: localized, // markdown
    effectiveAt: v.number(),
    createdBy: v.optional(v.id("users")),
    changeNote: v.optional(v.string()),
  }).index("by_policy_version", ["policyId", "version"]),

  policyAcceptances: defineTable({
    bookingId: v.optional(v.id("bookings")),
    userId: v.optional(v.id("users")),
    policyVersionIds: v.array(v.id("policyVersions")),
    acceptedAt: v.number(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    email: v.optional(v.string()),
  })
    .index("by_booking", ["bookingId"])
    .index("by_user", ["userId"]),

  blogPosts: defineTable({
    title: localized,
    slug: localized,
    excerpt: localized,
    body: localized, // markdown
    cover: v.optional(mediaValidator),
    category: v.string(),
    tags: v.array(v.string()),
    authorName: v.string(),
    authorId: v.optional(v.id("users")),
    readingMinutes: v.number(),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    seo: v.optional(seoValidator),
    updatedAt: v.number(),
  })
    .index("by_slug_en", ["slug.en"])
    .index("by_slug_ar", ["slug.ar"])
    .index("by_status", ["status", "publishedAt"])
    .index("by_category", ["category", "status"]),

  banners: defineTable({
    key: v.string(), // "home_hero" | "promo_top" | ...
    title: localizedOptional,
    subtitle: localizedOptional,
    ctaLabel: localizedOptional,
    ctaHref: v.optional(v.string()),
    media: v.optional(mediaValidator),
    countdownTo: v.optional(v.number()),
    placement: v.string(),
    order: v.number(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_key", ["key"])
    .index("by_placement", ["placement", "order"]),

  siteSettings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  seoMeta: defineTable({
    path: v.string(), // route without locale, e.g. "/about"
    seo: seoValidator,
    updatedAt: v.number(),
  }).index("by_path", ["path"]),

  teamMembers: defineTable({
    name: localized,
    roleTitle: localized,
    bio: localized,
    photo: v.optional(mediaValidator),
    languages: v.array(v.string()),
    order: v.number(),
    isActive: v.boolean(),
  }).index("by_order", ["order"]),

  newsletterSubscribers: defineTable({
    email: v.string(),
    locale: localeValidator,
    source: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    unsubscribedAt: v.optional(v.number()),
    token: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  newsletterCampaigns: defineTable({
    subject: localized,
    body: localized, // Markdown
    status: v.union(v.literal("draft"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
    createdBy: v.id("users"),
    sentAt: v.optional(v.number()),
    stats: v.optional(v.object({ targeted: v.number(), sent: v.number(), failed: v.number() })),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  staffInvites: defineTable({
    email: v.string(),
    role: roleValidator,
    token: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    action: v.string(), // "booking.status_change"
    entityType: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_actor", ["actorId", "createdAt"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"]),

  notifications: defineTable({
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms")),
    template: v.string(),
    to: v.string(),
    locale: localeValidator,
    bookingId: v.optional(v.id("bookings")),
    userId: v.optional(v.id("users")),
    payload: v.optional(v.any()),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_booking", ["bookingId"])
    .index("by_status", ["status"]),

  rateLimits: defineTable({
    key: v.string(), // "contact:ip:1.2.3.4"
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  dataRequests: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("export"), v.literal("deletion")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
    exportStorageId: v.optional(v.id("_storage")),
    note: v.optional(v.string()),
    handledBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});
