/**
 * Pure pricing engine shared by the server (quotes, booking creation) and the
 * client (live price summary). All amounts are integers in baisa.
 */

export type L = { en: string; ar: string };

export type PricingTour = {
  pricingModel: "per_group" | "per_person";
  priceGroup?: number | null;
  priceAdult?: number | null;
  priceChild?: number | null;
  depositPercent: number;
  minGroup: number;
  maxGroup: number;
};

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

  const priceGroup = season?.priceGroup ?? tour.priceGroup ?? 0;
  const priceAdult = season?.priceAdult ?? tour.priceAdult ?? 0;
  const priceChild = season?.priceChild ?? tour.priceChild ?? Math.round(priceAdult / 2);

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
  const depositPercent = Math.min(100, Math.max(0, tour.depositPercent));
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
export function isFreeCancellation(date: string, startTime: string | undefined, freeCancellationHours: number, now = Date.now()): boolean {
  if (freeCancellationHours <= 0) return false;
  const start = new Date(`${date}T${startTime ?? "08:00"}:00+04:00`).getTime();
  return start - now >= freeCancellationHours * 3_600_000;
}
