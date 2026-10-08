/**
 * Pure pricing engine shared by the server (quotes, booking creation) and the
 * client (live price summary). All amounts are integers in baisa.
 */

import { omanTodayIso } from "./dates";

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
  /** Legacy (first multi-day rule, never used live): the 3rd/4th guest price. Read only as a fallback for seatPrices. */
  extraGuestPrice?: number | null;
  /** per_vehicle_multiday: the price of the 1st, 2nd, 3rd and 4th guest in each 4WD (baisa, whole trip). */
  seatPrices?: number[] | null;
  /** Legacy (never charged): rooms are included in the seat prices; only single-room supplements cost extra. */
  sharedRoomPrice?: number | null;
  /** per_vehicle_multiday: the supplement for each single room that replaces a shared place (baisa, whole trip). */
  singleRoomPrice?: number | null;
};

export type PricingTour = {
  pricingModel: "per_group" | "per_person" | "tiered" | "per_vehicle" | "per_vehicle_multiday";
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

/** Both 4WD models: per_vehicle, and per_vehicle_multiday (trips of 2+ days, at most 4 guests per vehicle). */
export const isVehicleModel = (model: string | undefined | null): boolean => model === "per_vehicle" || model === "per_vehicle_multiday";

/** Seats in one vehicle on a multi-day 4WD trip: adults and children alike (lap infants excluded). */
export const MULTIDAY_VEHICLE_SEATS = 4;

/** Guests one shared room sleeps on a multi-day trip. */
export const SHARED_ROOM_GUESTS = 2;

/** The 4 seat prices of a multi-day 4WD (1st..4th guest), padded with 0; older rows fall back to pricePerVehicle. */
export function multidaySeatPrices(cfg: Pick<VehiclePricing, "pricePerVehicle" | "extraGuestPrice" | "seatPrices">): number[] {
  const s = cfg.seatPrices;
  if (s && s.length > 0) return Array.from({ length: MULTIDAY_VEHICLE_SEATS }, (_, i) => Math.max(0, s[i] ?? 0));
  const extra = Math.max(0, cfg.extraGuestPrice ?? 0);
  return [cfg.pricePerVehicle, 0, extra, extra];
}

/**
 * Multi-day 4WD transport (owner rule, 2026-10-08): each vehicle takes up to 4 guests, adults or children alike,
 * and in every vehicle the 1st, 2nd, 3rd and 4th guest each have their own price. Vehicles are filled in order
 * (4, 4, ..., the rest), so 5 guests = one full vehicle + a vehicle whose only guest pays the 1st-guest price.
 * seatCounts[i] = how many guests sit in position i+1 across all vehicles.
 */
export function multidayVehiclePrice(guests: number, cfg: Pick<VehiclePricing, "pricePerVehicle" | "extraGuestPrice" | "seatPrices">): { vehicles: number; seatCounts: number[]; total: number } {
  const n = Math.max(0, Math.floor(guests));
  const vehicles = Math.ceil(n / MULTIDAY_VEHICLE_SEATS);
  const seatCounts = Array.from({ length: MULTIDAY_VEHICLE_SEATS }, () => 0);
  for (let left = n; left > 0; left -= MULTIDAY_VEHICLE_SEATS) for (let i = 0; i < Math.min(left, MULTIDAY_VEHICLE_SEATS); i++) seatCounts[i]++;
  const prices = multidaySeatPrices(cfg);
  return { vehicles, seatCounts, total: seatCounts.reduce((sum, c, i) => sum + c * prices[i], 0) };
}

/**
 * Rooms for a multi-day party (owner rules, 2026-10-08): by default guests pair up in shared rooms and an odd last
 * guest has a room alone. Guests who ask for a single room get one and the rest pair up; when the rest is odd, the
 * guest left without a partner gets a single room too: 4 guests with 1 single request = 2 single rooms + 1 shared.
 * Lap infants stay with their parents. Rooms are included in the seat prices; see singleRoomSupplements for extras.
 */
export function roomsNeeded(guests: number, singleRequests: number | undefined | null): { shared: number; single: number; singleRequested: number } {
  const n = Math.max(0, Math.floor(guests));
  const asked = Math.min(n, Math.max(0, Math.floor(Number.isFinite(singleRequests) ? (singleRequests as number) : 0)));
  const rest = n - asked;
  return { shared: Math.floor(rest / SHARED_ROOM_GUESTS), single: asked + (rest % SHARED_ROOM_GUESTS), singleRequested: asked };
}

/**
 * Single rooms that cost the supplement (owner rule, 2026-10-08): the single-room price applies only where a shared
 * room was turned into single rooms, so the odd last guest's room alone (which the party gets anyway) is free.
 * 4 guests, 1 request = 2 supplements; 3 guests, 1 request = 0 (the requester takes the odd room); 5 guests, 2 = 2.
 */
export function singleRoomSupplements(guests: number, rooms: { single: number }): number {
  return Math.max(0, rooms.single - (Math.max(0, Math.floor(guests)) % SHARED_ROOM_GUESTS));
}

/**
 * Owner rule: no tour caps the group size. 4WD tours add vehicles and private-group tours add groups as the
 * party grows; per-person and tiered tours simply count everyone. PARTY_MAX only stops absurd or abusive
 * online requests.
 */
/** The largest party (adults + children) one online booking may carry, for every tour. */
export const PARTY_MAX = 200;

/**
 * Private groups a per_group party needs: the private price covers up to maxGroup guests (one vehicle), and
 * each further maxGroup guests start another group at the same price, like extra 4WDs.
 */
export function groupsNeeded(adults: number, children: number, maxGroup: number | undefined): number {
  const n = Math.max(0, Math.floor(adults)) + Math.max(0, Math.floor(children));
  if (n === 0) return 0;
  const per = Number.isFinite(maxGroup) && (maxGroup as number) >= 1 ? Math.floor(maxGroup as number) : n;
  return Math.ceil(n / per);
}

/**
 * How much of a slot's capacity one party consumes. Private models (per_group,
 * tiered) take one departure whatever the party size; per-person tours take a
 * seat per guest; per-vehicle tours take one unit per 4WD, so capacityPerSlot
 * counts the day's vehicle fleet.
 */
export function capacityUnits(tour: Pick<PricingTour, "pricingModel" | "vehiclePricing"> & { maxGroup?: number }, adults: number, children: number): number {
  switch (tour.pricingModel) {
    case "per_group":
      return Math.max(1, groupsNeeded(adults, children, tour.maxGroup));
    case "tiered":
      return 1;
    case "per_vehicle":
    case "per_vehicle_multiday":
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
export function pricingProblem(tour: Pick<PricingTour, "pricingModel" | "priceGroup" | "priceAdult" | "priceChild" | "tieredPricing" | "vehiclePricing">): string | null {
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
    case "per_vehicle_multiday": {
      // Four seat prices (the 1st above 0; a later one may be 0 on purpose) and the single-room supplement (0 = free)
      const vp = tour.vehiclePricing;
      const seats = vp?.seatPrices;
      if (!vp || !seats || seats.length !== MULTIDAY_VEHICLE_SEATS || !(seats[0] > 0) || seats.some((p) => !(Number.isFinite(p) && p >= 0))) return "vehiclePricing.seatPrices";
      return vp.singleRoomPrice != null && Number.isFinite(vp.singleRoomPrice) && vp.singleRoomPrice >= 0 ? null : "vehiclePricing.singleRoomPrice";
    }
    default:
      if (!((tour.priceAdult ?? 0) > 0)) return "priceAdult";
      // A child price must be set on purpose (0 = children go free); a missing one would silently charge half the adult price
      return tour.priceChild != null && tour.priceChild >= 0 ? null : "priceChild";
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
    case "per_vehicle_multiday":
      // One traveller: the 1st seat in a 4WD (a lone guest's room alone is included)
      return tour.vehiclePricing ? multidaySeatPrices(tour.vehiclePricing)[0] : 0;
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
  /** Shown next to the seasonal price lines ("Adult · Winter peak") so the customer sees why the price differs. */
  name?: L | null;
  priceGroup?: number | null;
  priceAdult?: number | null;
  priceChild?: number | null;
};

/** A season price only overrides when it is a real positive amount (a 0 or negative typo falls back to the tour). */
function seasonPrice(x: number | undefined | null): number | undefined {
  return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : undefined;
}

/**
 * Per-person prices the engine charges (baisa), for display and for computeQuote alike, so the tour page never shows a
 * child price different from the one charged. A child price of 0 means children go free. Without a stored child price
 * a child pays half the adult price. When a season changes the adult price but sets no child price, the child price
 * moves in proportion, so a child never pays more than an adult in a low season.
 */
export function perPersonPrices(tour: Pick<PricingTour, "priceAdult" | "priceChild">, season?: PricingSeason | null): { adult: number; child: number; seasonal: boolean } {
  const baseAdult = tour.priceAdult ?? 0;
  const baseChild = tour.priceChild != null && tour.priceChild >= 0 ? tour.priceChild : Math.round(baseAdult / 2);
  const sAdult = seasonPrice(season?.priceAdult);
  const sChild = seasonPrice(season?.priceChild);
  const adult = sAdult ?? baseAdult;
  const child = sChild ?? (sAdult !== undefined ? (baseAdult > 0 ? Math.round((baseChild * sAdult) / baseAdult) : Math.round(sAdult / 2)) : baseChild);
  return { adult, child, seasonal: sAdult !== undefined || sChild !== undefined };
}

export type QuoteInput = {
  tour: PricingTour;
  tourId: string;
  season?: PricingSeason | null;
  adults: number;
  children: number;
  infants: number;
  /** per_vehicle_multiday: guests who asked for a single room (roomsNeeded adds one for a guest left without a partner). */
  singleRooms?: number;
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
  /** True when a pricing season changed the price of this quote. */
  seasonal?: boolean;
  /** per_vehicle_multiday: the rooms this party takes. */
  rooms?: { shared: number; single: number; singleRequested: number };
};

/** Quote lines of the four seat positions in a multi-day 4WD. */
const MULTIDAY_SEAT_LABELS: L[] = [
  { en: "1st guest in a 4WD", ar: "الشخص الأول في السيارة" },
  { en: "2nd guest in a 4WD", ar: "الشخص الثاني في السيارة" },
  { en: "3rd guest in a 4WD", ar: "الشخص الثالث في السيارة" },
  { en: "4th guest in a 4WD", ar: "الشخص الرابع في السيارة" },
];

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

  const seasonGroup = seasonPrice(season?.priceGroup);
  const priceGroup = seasonGroup ?? tour.priceGroup ?? 0;
  const pp = perPersonPrices(tour, season);
  const priceAdult = pp.adult;
  const priceChild = pp.child;
  // Seasonal lines carry the season's name, so a price above (or below) the tour page's is explained
  const seasonal = (label: L, applies: boolean): L =>
    applies && season?.name && (season.name.en || season.name.ar)
      ? { en: `${label.en} · ${season.name.en || season.name.ar}`, ar: `${label.ar} · ${season.name.ar || season.name.en}` }
      : label;

  let subtotal = 0;
  let rooms: Quote["rooms"];
  if (tour.pricingModel === "per_group") {
    // A larger party takes more private groups (each up to maxGroup guests), never a refusal
    const groups = Math.max(1, groupsNeeded(adults, children, tour.maxGroup));
    items.push({
      kind: "group",
      label: seasonal({ en: `Private group (up to ${tour.maxGroup} guests each)`, ar: `مجموعة خاصة (حتى ${tour.maxGroup} ضيوف لكل مجموعة)` }, seasonGroup !== undefined),
      quantity: groups,
      unitPrice: priceGroup,
      total: groups * priceGroup,
    });
    subtotal = groups * priceGroup;
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
  } else if (tour.pricingModel === "per_vehicle_multiday" && tour.vehiclePricing) {
    // Up to 4 guests per 4WD, each seat position with its own price; more guests start another vehicle. Rooms are
    // included; only single rooms that replace a shared place add the supplement.
    const cfg = tour.vehiclePricing;
    const p = multidayVehiclePrice(groupSize, cfg);
    const prices = multidaySeatPrices(cfg);
    p.seatCounts.forEach((count, i) => {
      if (count > 0) items.push({ kind: "adult", label: MULTIDAY_SEAT_LABELS[i], quantity: count, unitPrice: prices[i], total: count * prices[i] });
    });
    rooms = roomsNeeded(groupSize, input.singleRooms);
    const singlePrice = Math.max(0, cfg.singleRoomPrice ?? 0);
    const supplements = singleRoomSupplements(groupSize, rooms);
    if (supplements > 0) items.push({ kind: "group", label: { en: "Single room supplement (instead of a shared room)", ar: "فرق الغرفة الفردية (بدل الغرفة المشتركة)" }, quantity: supplements, unitPrice: singlePrice, total: supplements * singlePrice });
    subtotal = p.total + supplements * singlePrice;
  } else if (isVehicleModel(tour.pricingModel) && tour.vehiclePricing) {
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
      items.push({ kind: "adult", label: seasonal({ en: "Adult", ar: "بالغ" }, pp.seasonal), quantity: adults, unitPrice: priceAdult, total: adults * priceAdult });
      subtotal += adults * priceAdult;
    }
    if (children > 0) {
      items.push({ kind: "child", label: seasonal({ en: "Child", ar: "طفل" }, pp.seasonal), quantity: children, unitPrice: priceChild, total: children * priceChild });
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
    // The minimum spend is checked on the same base the discount applies to (tour price plus extras)
    const err = validateCoupon(input.coupon, { subtotal: subtotal + addOnsTotal, groupSize, date: input.date, tourId: input.tourId, now: input.now ?? Date.now() });
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

  const seasonApplied = tour.pricingModel === "per_group" ? seasonGroup !== undefined : tour.pricingModel === "per_person" ? pp.seasonal : false;
  return { items, subtotal, addOnsTotal, discountTotal, total, depositDue, balanceDue: total - depositDue, groupSize, couponCode, couponError, seasonal: seasonApplied || undefined, ...(rooms ? { rooms } : {}) };
}

export function validateCoupon(
  c: PricingCoupon,
  /** subtotal: the tour price plus extras, before the discount. */
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
    // Whole calendar days between Oman's today and the tour date: "30 days ahead" includes a tour exactly 30 days away
    const daysAhead = (Date.parse(ctx.date + "T00:00:00Z") - Date.parse(omanTodayIso(ctx.now) + "T00:00:00Z")) / 86_400_000;
    if (!(daysAhead >= c.earlyBirdDays)) return "early_bird";
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
