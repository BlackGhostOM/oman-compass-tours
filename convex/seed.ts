/**
 * Demo seed. Idempotent: running it twice updates existing rows by key/code.
 *
 *   npm run seed          → convex run seed:run
 *   npm run seed:reset    → convex run seed:reset   (deletes seeded content only)
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { omrToBaisa } from "./lib/money";
import { generateBookingReference, generateToken } from "./lib/ids";
import { categoriesSeed } from "./seedData/categories";
import { destinationsSeed } from "./seedData/destinations";
import { toursSeed } from "./seedData/tours";
import { policiesSeed } from "./seedData/policies";
import { reviewsSeed } from "./seedData/reviews";
import { blogSeed } from "./seedData/blog";
import { addOnsSeed, bannersSeed, couponsSeed, siteSettingsSeed, teamSeed } from "./seedData/misc";

const placeholder = (key: string) => `/media/placeholders/${key}.jpg`;

const media = (key: string, alt: { en: string; ar: string }) => ({
  kind: "image" as const,
  url: placeholder(key),
  alt,
  width: key.startsWith("reel") ? 1080 : 1600,
  height: key.startsWith("reel") ? 1920 : 1000,
});

export const DEMO_ACCOUNTS = [
  { email: "owner@omancompasstours.com", password: "OmanCompass!2026", name: "Owner (demo)", role: "owner" as const },
  { email: "staff@omancompasstours.com", password: "OmanCompass!2026", name: "Staff (demo)", role: "staff" as const },
  { email: "customer@example.com", password: "Traveller!2026", name: "Sara Traveller", role: "customer" as const },
];

export const seedContent = internalMutation({
  args: {},
  returns: v.object({ tours: v.number(), categories: v.number(), destinations: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();

    /* Categories */
    const categoryIds = new Map<string, Id<"categories">>();
    for (const [i, c] of categoriesSeed.entries()) {
      const existing = await ctx.db.query("categories").withIndex("by_key", (q) => q.eq("key", c.key)).unique();
      const doc = { key: c.key, name: c.name, slug: c.slug, description: c.description, icon: c.icon, order: i + 1, isActive: true };
      const id = existing ? (await ctx.db.patch(existing._id, doc), existing._id) : await ctx.db.insert("categories", doc);
      categoryIds.set(c.key, id);
    }

    /* Destinations */
    const destinationIds = new Map<string, Id<"destinations">>();
    for (const [i, d] of destinationsSeed.entries()) {
      const existing = await ctx.db.query("destinations").withIndex("by_key", (q) => q.eq("key", d.key)).unique();
      const doc = {
        key: d.key,
        name: d.name,
        slug: d.slug,
        tagline: d.tagline,
        description: d.description,
        region: d.region,
        image: media(d.image, d.name),
        lat: d.lat,
        lng: d.lng,
        order: i + 1,
        isActive: true,
      };
      const id = existing ? (await ctx.db.patch(existing._id, doc), existing._id) : await ctx.db.insert("destinations", doc);
      destinationIds.set(d.key, id);
    }

    /* Tours */
    const tourIds = new Map<string, Id<"tours">>();
    for (const t of toursSeed) {
      const existing = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", t.code)).unique();
      const priceGroup = t.priceGroupOmr !== undefined ? omrToBaisa(t.priceGroupOmr) : undefined;
      const priceAdult = t.priceAdultOmr !== undefined ? omrToBaisa(t.priceAdultOmr) : undefined;
      const priceChild = t.priceChildOmr !== undefined ? omrToBaisa(t.priceChildOmr) : undefined;
      const priceFrom = t.pricingModel === "per_group" ? priceGroup! : priceAdult!;
      const doc = {
        code: t.code,
        kind: t.kind,
        title: t.title,
        slug: t.slug,
        summary: t.summary,
        description: t.description,
        highlights: t.highlights,
        itinerary: t.itinerary,
        inclusions: t.inclusions,
        exclusions: t.exclusions,
        faqs: t.faqs,
        categoryId: categoryIds.get(t.category)!,
        secondaryCategoryIds: (t.secondaryCategories ?? []).map((k) => categoryIds.get(k)!),
        destinationIds: t.destinations.map((k) => destinationIds.get(k)!),
        durationLabel: t.durationLabel,
        durationMinutes: t.durationMinutes,
        durationDays: t.durationDays,
        startTimes: t.startTimes,
        meetingPoint: t.meetingPoint,
        pickupIncluded: t.pickupIncluded,
        guideLanguages: t.guideLanguages,
        minGroup: t.minGroup,
        maxGroup: t.maxGroup,
        defaultCapacityPerSlot: t.capacityPerSlot,
        difficulty: t.difficulty,
        pricingModel: t.pricingModel,
        priceGroup,
        priceAdult,
        priceChild,
        childAgeMax: t.childAgeMax,
        infantAgeMax: 2,
        priceFrom,
        depositPercent: t.depositPercent,
        freeCancellationHours: t.freeCancellationHours,
        allowReserveNowPayLater: t.allowReserveNowPayLater,
        holdHours: t.holdHours,
        coverImage: media(t.image, t.title),
        ratingAverage: t.ratingAverage,
        ratingCount: 0,
        externalReviewCount: t.externalReviewCount,
        tripadvisorUrl:
          "https://www.tripadvisor.com/Attraction_Review-g1940497-d26437481-Reviews-OMAN_COMPASS_TOURS-Muscat_Muscat_Governorate.html",
        status: "published" as const,
        isFeatured: t.isFeatured,
        featuredOrder: t.featuredOrder,
        tags: [...t.tags, ...(t.priceIsPlaceholder ? ["price-placeholder"] : [])],
        seo: {
          title: t.title,
          description: t.summary,
          ogImageUrl: placeholder(t.image),
        },
        searchText: `${t.title.en} ${t.title.ar} ${t.summary.en} ${t.summary.ar} ${t.tags.join(" ")}`,
        updatedAt: now,
      };
      const id = existing ? (await ctx.db.patch(existing._id, doc), existing._id) : await ctx.db.insert("tours", doc);
      tourIds.set(t.code, id);

      // Gallery: cover + 2 extra placeholders
      const gallery = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", id)).collect();
      if (gallery.length === 0) {
        const extras = [t.image, "muscat", "wahiba", "jebel-akhdar", "wadi-shab"].filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
        for (const [i, key] of extras.entries()) {
          await ctx.db.insert("tourMedia", { tourId: id, media: media(key, t.title), order: i });
        }
      }
    }

    /* Add-ons (global) */
    for (const [i, a] of addOnsSeed.entries()) {
      const existing = await ctx.db.query("addOns").withIndex("by_key", (q) => q.eq("key", a.key)).unique();
      const doc = { key: a.key, name: a.name, description: a.description, price: omrToBaisa(a.priceOmr), priceType: a.priceType, isActive: true, order: i };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("addOns", doc);
    }

    /* Coupons */
    for (const c of couponsSeed) {
      const existing = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", c.code)).unique();
      const doc = {
        code: c.code,
        name: c.name,
        type: c.type,
        value: c.type === "fixed" ? omrToBaisa(c.value) : c.value,
        maxDiscount: "maxDiscountOmr" in c && c.maxDiscountOmr ? omrToBaisa(c.maxDiscountOmr) : undefined,
        usageLimit: "usageLimit" in c ? c.usageLimit : undefined,
        earlyBirdDays: "earlyBirdDays" in c ? c.earlyBirdDays : undefined,
        minGroupSize: "minGroupSize" in c ? c.minGroupSize : undefined,
        usedCount: existing?.usedCount ?? 0,
        isActive: true,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("coupons", doc);
    }

    /* Policies + version 1 */
    for (const p of policiesSeed) {
      let policy = await ctx.db.query("policies").withIndex("by_key", (q) => q.eq("key", p.key)).unique();
      if (!policy) {
        const id = await ctx.db.insert("policies", { key: p.key, title: p.title, order: p.order, requiredAtCheckout: p.requiredAtCheckout });
        policy = (await ctx.db.get(id))!;
      } else {
        await ctx.db.patch(policy._id, { title: p.title, order: p.order, requiredAtCheckout: p.requiredAtCheckout });
      }
      const v1 = await ctx.db
        .query("policyVersions")
        .withIndex("by_policy_version", (q) => q.eq("policyId", policy!._id).eq("version", 1))
        .unique();
      if (!v1) {
        const vid = await ctx.db.insert("policyVersions", { policyId: policy._id, version: 1, body: p.body, effectiveAt: now, changeNote: "Initial draft (seed)" });
        await ctx.db.patch(policy._id, { currentVersionId: vid });
      } else if (!policy.currentVersionId) {
        await ctx.db.patch(policy._id, { currentVersionId: v1._id });
      }
    }

    /* Reviews (sample) */
    const anyReview = await ctx.db.query("reviews").first();
    if (!anyReview) {
      for (const r of reviewsSeed) {
        await ctx.db.insert("reviews", {
          tourId: r.tourCode ? tourIds.get(r.tourCode) : undefined,
          authorName: r.authorName,
          authorCountry: r.authorCountry,
          rating: r.rating,
          title: r.title,
          body: r.body,
          language: r.language,
          source: r.source,
          travelDate: r.travelDate,
          status: "approved",
          isFeatured: r.isFeatured,
        });
      }
      // Recompute per-tour rating counts from site reviews
      for (const [code, id] of tourIds) {
        const rs = reviewsSeed.filter((r) => r.tourCode === code);
        if (rs.length) {
          await ctx.db.patch(id, { ratingCount: rs.length, ratingAverage: rs.reduce((a, r) => a + r.rating, 0) / rs.length });
        }
      }
    }

    /* Blog */
    for (const b of blogSeed) {
      const existing = await ctx.db.query("blogPosts").withIndex("by_slug_en", (q) => q.eq("slug.en", b.slug.en)).unique();
      const doc = {
        title: b.title,
        slug: b.slug,
        excerpt: b.excerpt,
        body: b.body,
        cover: media(b.image, b.title),
        category: b.category,
        tags: b.tags,
        authorName: b.authorName,
        readingMinutes: b.readingMinutes,
        status: "published" as const,
        publishedAt: now - b.publishedDaysAgo * 86_400_000,
        updatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("blogPosts", doc);
    }

    /* Team */
    const anyTeam = await ctx.db.query("teamMembers").first();
    if (!anyTeam) {
      for (const [i, m] of teamSeed.entries()) {
        await ctx.db.insert("teamMembers", { name: m.name, roleTitle: m.roleTitle, bio: m.bio, photo: media(m.image, m.name), languages: m.languages, order: i, isActive: true });
      }
    }

    /* Banners */
    for (const [i, b] of bannersSeed.entries()) {
      const existing = await ctx.db.query("banners").withIndex("by_key", (q) => q.eq("key", b.key)).unique();
      const doc = { key: b.key, placement: b.placement, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, media: media(b.image, b.title), order: i, isActive: true };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("banners", doc);
    }

    /* Settings */
    for (const [key, value] of Object.entries(siteSettingsSeed)) {
      const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (!existing) await ctx.db.insert("siteSettings", { key, value, updatedAt: now });
    }

    /* FX fallback rates */
    const anyFx = await ctx.db.query("fxRates").first();
    if (!anyFx) {
      for (const [quote, rate] of Object.entries({ USD: 2.6008, EUR: 2.4, GBP: 2.05, AED: 9.55, SAR: 9.75 })) {
        await ctx.db.insert("fxRates", { base: "OMR", quote: quote as "USD", rate, fetchedAt: now, source: "seed-fallback" });
      }
    }

    return { tours: tourIds.size, categories: categoryIds.size, destinations: destinationIds.size };
  },
});

/** Assigns roles and creates sample bookings for the demo accounts. */
export const seedAccounts = internalMutation({
  args: {},
  returns: v.object({ bookings: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let bookings = 0;
    for (const acc of DEMO_ACCOUNTS) {
      const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", acc.email)).first();
      if (!user) continue;
      await ctx.db.patch(user._id, { role: acc.role, name: user.name ?? acc.name, locale: "en", loyaltyPoints: user.loyaltyPoints ?? 0 });

      if (acc.role === "customer") {
        const existing = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
        if (existing) continue;
        const tour1 = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", "OCT-001")).unique();
        const tour2 = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", "OCT-003")).unique();
        const policyIds = (await ctx.db.query("policies").collect()).map((p) => p.currentVersionId).filter((x): x is Id<"policyVersions"> => !!x);
        if (!tour1 || !tour2) continue;
        const traveller = { firstName: "Sara", lastName: "Traveller", nationality: "GB", phone: "+447700900123", email: acc.email, hotel: "Al Bustan Palace", preferredLanguage: "en" as const };
        const future = new Date(now + 14 * 86_400_000).toISOString().slice(0, 10);
        const past = new Date(now - 40 * 86_400_000).toISOString().slice(0, 10);
        const b1 = await ctx.db.insert("bookings", {
          reference: generateBookingReference(), userId: user._id, tourId: tour1._id, tourTitle: tour1.title, date: future, startTime: "08:00",
          adults: 2, children: 0, infants: 0, groupSize: 2, pricingModel: "per_group", currency: "OMR",
          subtotal: tour1.priceGroup!, addOnsTotal: 0, discountTotal: 0, total: tour1.priceGroup!, depositDue: tour1.priceGroup!, amountPaid: tour1.priceGroup!, amountRefunded: 0,
          traveller, locale: "en", status: "confirmed", policyVersionIds: policyIds, source: "web", voucherToken: generateToken(), confirmedAt: now - 86_400_000, updatedAt: now,
        });
        await ctx.db.insert("bookingItems", { bookingId: b1, kind: "group", label: { en: "Private group (up to 6)", ar: "مجموعة خاصة (حتى 6)" }, quantity: 1, unitPrice: tour1.priceGroup!, total: tour1.priceGroup! });
        await ctx.db.insert("payments", { bookingId: b1, provider: "stripe", kind: "full", amount: Math.round((tour1.priceGroup! / 1000) * 2.6008 * 100), currency: "USD", amountOmr: tour1.priceGroup!, fxRate: 2.6008, status: "succeeded", providerPaymentId: "pi_demo_seed_1", idempotencyKey: `seed-${b1}`, paidAt: now - 86_400_000, refundedAmount: 0, updatedAt: now });
        const total2 = tour2.priceAdult! * 2;
        const b2 = await ctx.db.insert("bookings", {
          reference: generateBookingReference(), userId: user._id, tourId: tour2._id, tourTitle: tour2.title, date: past, startTime: "07:00",
          adults: 2, children: 0, infants: 0, groupSize: 2, pricingModel: "per_person", currency: "OMR",
          subtotal: total2, addOnsTotal: 0, discountTotal: 0, total: total2, depositDue: total2, amountPaid: total2, amountRefunded: 0,
          traveller, locale: "en", status: "completed", policyVersionIds: policyIds, source: "web", voucherToken: generateToken(), confirmedAt: now - 45 * 86_400_000, completedAt: now - 40 * 86_400_000, updatedAt: now,
        });
        await ctx.db.insert("bookingItems", { bookingId: b2, kind: "adult", label: { en: "Adult", ar: "بالغ" }, quantity: 2, unitPrice: tour2.priceAdult!, total: total2 });
        await ctx.db.insert("payments", { bookingId: b2, provider: "thawani", kind: "full", amount: total2, currency: "OMR", amountOmr: total2, status: "succeeded", providerPaymentId: "thw_demo_seed_2", idempotencyKey: `seed-${b2}`, paidAt: now - 45 * 86_400_000, refundedAmount: 0, updatedAt: now });
        bookings += 2;
      }
    }
    return { bookings };
  },
});

/** Entry point: `npx convex run seed:run` */
export const run = action({
  args: {},
  returns: v.object({ content: v.any(), accounts: v.array(v.string()), bookings: v.number() }),
  handler: async (
    ctx,
  ): Promise<{ content: { tours: number; categories: number; destinations: number }; accounts: string[]; bookings: number }> => {
    const content: { tours: number; categories: number; destinations: number } = await ctx.runMutation(
      internal.seed.seedContent,
      {},
    );
    const created: string[] = [];
    for (const acc of DEMO_ACCOUNTS) {
      try {
        // Sign-up flow creates the user + password account through Convex Auth.
        await ctx.runAction(internal.seedAuth.createPasswordAccount, {
          email: acc.email,
          password: acc.password,
          name: acc.name,
        });
        created.push(acc.email);
      } catch (err) {
        // Already exists → fine
        console.log(`account ${acc.email}: ${String(err).slice(0, 120)}`);
      }
    }
    const accountsResult: { bookings: number } = await ctx.runMutation(internal.seed.seedAccounts, {});
    return { content, accounts: created, bookings: accountsResult.bookings };
  },
});

/** Removes seeded content (keeps users). `npx convex run seed:reset` */
export const reset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const tables = ["tourMedia", "tours", "categories", "destinations", "addOns", "coupons", "policyVersions", "policies", "reviews", "blogPosts", "teamMembers", "banners", "siteSettings", "fxRates"] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return null;
  },
});
