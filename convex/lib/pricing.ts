/**
 * Pure pricing engine shared by the server (quotes, booking creation) and the
 * client (live price summary). All amounts are integers in baisa.
 */

export type L = { en: string; ar: string };

export type TieredPricing = {
  /** Total for a lone adult (baisa). */
  firstAdult: number;
  /** Combined total for the first two adults (baisa), NOT each. */
  firstTwoAdults: number;
  /** Flat add-on for every adult after the second (baisa). */
  extraAdult: number;
  /** Flat add-on per child (baisa). Infants stay free. */
  extraChild: number;
};

export type VehiclePricing = {
  /** Flat price per 4WD (baisa); every vehicle costs the same. */
  pricePerVehicle: number;
  /** Most adults one vehicle carries (4 in the standard setup). */
  maxAdults: number;
  /** Total guests one vehicle carries, children included (6 in the standard setup). */
  seats: number;
};

export type PricingTour = {
  pricingModel: "per_group" | "per_person" | "tiered" | "per_vehicle";
  priceGroup?: number | null;
  priceAdult?: number | null;
  priceChild?: number | null;
  tieredPricing?: TieredPricing | null;
  vehiclePricing?: VehiclePricing | null;
  depositPercent: number;
  minGroup: number;
  maxGroup: number;
};

/**
 * 4WDs needed for a party: adults are capped per vehicle, and everyone —
 * children included, infants on laps excluded — needs a seat. The standard
 * setup (4 adults, 6 seats) fits 4 adults + 2 children or 1 adult + 5 children;
 * a fifth adult or a seventh guest starts a second vehicle at full price.
 */
export function vehiclesNeeded(adults: number, children: number, cfg: VehiclePricing): number {
  const a = Math.max(0, Math.floor(adults));
  const c = Math.max(0, Math.floor(children));
  if (a + c === 0) return 0;
  const maxAdults = Math.max(1, Math.floor(cfg.maxAdults));
  const seats = Math.max(maxAdults, Math.floor(cfg.seats));
  return Math.max(Math.ceil(a / maxAdults), Math.ceil((a + c) / seats));
}

/** Most lap infants one booking may bring (the counter's cap; infants never take a seat). */
export const INFANT_MAX = 6;

/**
 * How much of a slot's capacity one party consumes. Private models (per_group,
 * tiered) take one departure whatever the party size; per-person tours take a
 * seat per guest; per-vehicle tours take one unit per 4WD, so capacityPerSlot
 * counts the day's vehicle fleet.
 */
export function capacityUnits(tour: Pick<PricingTour, "pricingModel" | "vehiclePricing">, adults: number, children: number): number {
  switch (tour.pricingModel) {
    case "per_group":
    case "tiered":
      return 1;
    case "per_vehicle":
      return Math.max(1, vehiclesNeeded(adults, children, tour.vehiclePricing ?? { pricePerVehicle: 0, maxAdults: 4, seats: 6 }));
    default:
      return Math.max(0, Math.floor(adults) + Math.floor(children));
  }
}

/**
 * Why a tour's prices are not ready to go live, or null when they are (baisa).
 * The single gate used by the editor, the status switch, the bulk bar and the
 * JSON import, so no path can publish a tour that would quote 0 OMR — or a
 * tiered card where two adults cost less than one.
 */
export function pricingProblem(tour: Pick<PricingTour, "pricingModel" | "priceGroup" | "priceAdult" | "tieredPricing" | "vehiclePricing">): string | null {
  switch (tour.pricingModel) {
    case "per_group":
      return (tour.priceGroup ?? 0) > 0 ? null : "priceGroup";
    case "tiered": {
      const t = tour.tieredPricing;
      if (!t || t.firstAdult <= 0 || t.firstTwoAdults <= 0) return "tieredPricing";
      return t.firstTwoAdults >= t.firstAdult ? null : "tieredPricing.firstTwoAdults";
    }
    case "per_vehicle":
      return (tour.vehiclePricing?.pricePerVehicle ?? 0) > 0 ? null : "vehiclePricing";
    default:
      return (tour.priceAdult ?? 0) > 0 ? null : "priceAdult";
  }
}

/**
 * The denormalised "from" price a card shows: the cheapest way onto the tour.
 * One adult for tiered pricing, one vehicle for per-vehicle pricing.
 */
export function priceFromOf(tour: Pick<PricingTour, "pricingModel" | "priceGroup" | "priceAdult" | "tieredPricing" | "vehiclePricing">): number {
  switch (tour.pricingModel) {
    case "per_group":
      return tour.priceGroup ?? 0;
    case "tiered":
      return tour.tieredPricing?.firstAdult ?? 0;
    case "per_vehicle":
      return tour.vehiclePricing?.pricePerVehicle ?? 0;
    default:
      return tour.priceAdult ?? 0;
  }
}

export type PricingAddOn = {
  _id: string;
  name: L;
  price: number;
  priceType: "per_booking" | "per_person";
};

export type PricingCoupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  minGroupSize?: number;
  earlyBirdDays?: number;
  tourIds?: string[];
  startsAt?: number;
  endsAt?: number;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
};

export type PricingSeason = {
  priceGroup?: number | null;
  priceAdult?: number | null;
  priceChild?: number | null;
};

export type QuoteInput = {
  tour: PricingTour;
  tourId: string;
  season?: PricingSeason | null;
  adults: number;
  children: number;
  infants: number;
  addOns: { addOn: PricingAddOn; quantity: number }[];
  coupon?: PricingCoupon | null;
  date: string; // YYYY-MM-DD
  now?: number;
};

export type QuoteItem = {
  kind: "adult" | "child" | "infant" | "group" | "addon" | "discount";
  label: L;
  quantity: number;
  unitPrice: number;
  total: number;
  addOnId?: string;
};

export type Quote = {
  items: QuoteItem[];
  subtotal: number;
  addOnsTotal: number;
  discountTotal: number;
  total: number;
  depositDue: number;
  balanceDue: number;
  groupSize: number;
  couponCode?: string;
  couponError?: CouponError;
};

export type CouponError =
  | "not_found"
  | "inactive"
  | "expired"
  | "not_started"
  | "usage_limit"
  | "min_subtotal"
  | "min_group"
  | "early_bird"
  | "tour_not_eligible";

export function computeQuote(input: QuoteInput): Quote {
  const { tour, season } = input;
  const adults = Math.max(0, Math.floor(input.adults));
  const children = Math.max(0, Math.floor(input.children));
  const infants = Math.max(0, Math.floor(input.infants));
  const groupSize = adults + children;
  const items: QuoteItem[] = [];

  // A season price only overrides when it is a real positive amount (a 0 or negative typo falls back to the tour)
  const seasonPrice = (x: number | undefined | null) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : undefined);
  const priceGroup = seasonPrice(season?.priceGroup) ?? tour.priceGroup ?? 0;
  const priceAdult = seasonPrice(season?.priceAdult) ?? tour.priceAdult ?? 0;
  const priceChild = seasonPrice(season?.priceChild) ?? tour.priceChild ?? Math.round(priceAdult / 2);

  let subtotal = 0;
  if (tour.pricingModel === "per_group") {
    items.push({
      kind: "group",
      label: { en: `Private group (up to ${tour.maxGroup})`, ar: `مجموعة خاصة (حتى ${tour.maxGroup})` },
      quantity: 1,
      unitPrice: priceGroup,
      total: priceGroup,
    });
    subtotal = priceGroup;
  } else if (tour.pricingModel === "tiered" && tour.tieredPricing) {
    // The first adult pays a starting total, the first two together a combined
    // total, then every further adult and every child adds a flat amount.
    // Seasonal overrides do not apply to tiered pricing.
    const t = tour.tieredPricing;
    if (adults === 1) {
      items.push({ kind: "adult", label: { en: "Adult", ar: "بالغ" }, quantity: 1, unitPrice: t.firstAdult, total: t.firstAdult });
      subtotal += t.firstAdult;
    } else if (adults >= 2) {
      items.push({ kind: "adult", label: { en: "First two adults", ar: "أول بالغَيْن" }, quantity: 1, unitPrice: t.firstTwoAdults, total: t.firstTwoAdults });
      subtotal += t.firstTwoAdults;
      if (adults > 2) {
        const extras = adults - 2;
        items.push({ kind: "adult", label: { en: "Additional adult", ar: "بالغ إضافي" }, quantity: extras, unitPrice: t.extraAdult, total: extras * t.extraAdult });
        subtotal += extras * t.extraAdult;
      }
    }
    if (children > 0) {
      items.push({ kind: "child", label: { en: "Child", ar: "طفل" }, quantity: children, unitPrice: t.extraChild, total: children * t.extraChild });
      subtotal += children * t.extraChild;
    }
  } else if (tour.pricingModel === "per_vehicle" && tour.vehiclePricing) {
    // Every 4WD costs the same flat price; the party size decides how many are
    // needed. Seasonal overrides do not apply to per-vehicle pricing.
    const cfg = tour.vehiclePricing;
    const vehicles = vehiclesNeeded(adults, children, cfg);
    items.push({
      kind: "group",
      label: {
        en: `4WD vehicle (up to ${cfg.maxAdults} adults, ${cfg.seats} guests)`,
        ar: `سيارة دفع رباعي (حتى ${cfg.maxAdults} بالغين و${cfg.seats} ضيوف)`,
      },
      quantity: vehicles,
      unitPrice: cfg.pricePerVehicle,
      total: vehicles * cfg.pricePerVehicle,
    });
    subtotal = vehicles * cfg.pricePerVehicle;
  } else {
    if (adults > 0) {
      items.push({ kind: "adult", label: { en: "Adult", ar: "بالغ" }, quantity: adults, unitPrice: priceAdult, total: adults * priceAdult });
      subtotal += adults * priceAdult;
    }
    if (children > 0) {
      items.push({ kind: "child", label: { en: "Child", ar: "طفل" }, quantity: children, unitPrice: priceChild, total: children * priceChild });
      subtotal += children * priceChild;
    }
  }
  if (infants > 0) {
    items.push({ kind: "infant", label: { en: "Infant", ar: "رضيع" }, quantity: infants, unitPrice: 0, total: 0 });
  }

  let addOnsTotal = 0;
  for (const { addOn, quantity } of input.addOns) {
    const qty = Math.max(0, Math.floor(quantity));
    if (qty === 0) continue;
    const units = addOn.priceType === "per_person" ? qty * Math.max(1, groupSize) : qty;
    const total = units * addOn.price;
    items.push({ kind: "addon", label: addOn.name, quantity: units, unitPrice: addOn.price, total, addOnId: addOn._id });
    addOnsTotal += total;
  }

  let discountTotal = 0;
  let couponError: CouponError | undefined;
  let couponCode: string | undefined;
  if (input.coupon) {
    const err = validateCoupon(input.coupon, { subtotal, groupSize, date: input.date, tourId: input.tourId, now: input.now ?? Date.now() });
    if (err) {
      couponError = err;
    } else {
      couponCode = input.coupon.code;
      const base = subtotal + addOnsTotal;
      discountTotal = input.coupon.type === "percent" ? Math.round((base * input.coupon.value) / 100) : input.coupon.value;
      if (input.coupon.maxDiscount !== undefined) discountTotal = Math.min(discountTotal, input.coupon.maxDiscount);
      discountTotal = Math.min(discountTotal, base);
      if (discountTotal > 0) {
        items.push({ kind: "discount", label: { en: `Coupon ${input.coupon.code}`, ar: `كوبون ${input.coupon.code}` }, quantity: 1, unitPrice: -discountTotal, total: -discountTotal });
      }
    }
  }

  const total = Math.max(0, subtotal + addOnsTotal - discountTotal);
  // At least 1%: every tour takes a deposit, and a 0% deposit would promise "pay 0 now" while checkout charges in full
  const depositPercent = Math.min(100, Math.max(1, Number.isFinite(tour.depositPercent) ? tour.depositPercent : 100));
  const depositDue = depositPercent >= 100 ? total : Math.round((total * depositPercent) / 100);

  return { items, subtotal, addOnsTotal, discountTotal, total, depositDue, balanceDue: total - depositDue, groupSize, couponCode, couponError };
}

export function validateCoupon(
  c: PricingCoupon,
  ctx: { subtotal: number; groupSize: number; date: string; tourId: string; now: number },
): CouponError | undefined {
  if (!c.isActive) return "inactive";
  if (c.startsAt && ctx.now < c.startsAt) return "not_started";
  if (c.endsAt && ctx.now > c.endsAt) return "expired";
  if (c.usageLimit !== undefined && c.usedCount >= c.usageLimit) return "usage_limit";
  if (c.minSubtotal !== undefined && ctx.subtotal < c.minSubtotal) return "min_subtotal";
  if (c.minGroupSize !== undefined && ctx.groupSize < c.minGroupSize) return "min_group";
  if (c.tourIds && c.tourIds.length > 0 && !c.tourIds.includes(ctx.tourId)) return "tour_not_eligible";
  if (c.earlyBirdDays !== undefined) {
    const tourDate = new Date(ctx.date + "T00:00:00Z").getTime();
    const daysAhead = (tourDate - ctx.now) / 86_400_000;
    if (daysAhead < c.earlyBirdDays) return "early_bird";
  }
  return undefined;
}

/** True when the tour date/time is still inside the free-cancellation window. */
/**
 * Whether an extra can be offered and charged on a product: global extras with appliesToKinds only suit those
 * kinds (a guide upgrade on a tour, never on a transfer or ticket); unset or empty means every kind.
 */
export function addOnAppliesTo(addOn: { appliesToKinds?: readonly string[] | null }, tour: { kind: string }): boolean {
  return !addOn.appliesToKinds?.length || addOn.appliesToKinds.includes(tour.kind);
}

export function isFreeCancellation(date: string, startTime: string | undefined, freeCancellationHours: number, now = Date.now()): boolean {
  if (freeCancellationHours <= 0) return false;
  const start = new Date(`${date}T${startTime ?? "08:00"}:00+04:00`).getTime();
  return start - now >= freeCancellationHours * 3_600_000;
}
