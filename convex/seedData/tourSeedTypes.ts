import type { CategoryKey } from "./categories";
import type { DestinationKey } from "./destinations";

export type L = { en: string; ar: string };

export type TourSeed = {
  code: string;
  /** Viator product code, e.g. "425555P1"; used for the Viator deep link. */
  viatorCode?: string;
  kind: "tour" | "service";
  title: L;
  slug: L;
  summary: L;
  description: L;
  highlights: L[];
  itinerary: { time?: string; title: L; body: L }[];
  inclusions: L[];
  exclusions: L[];
  faqs: { question: L; answer: L }[];
  category: CategoryKey;
  secondaryCategories?: CategoryKey[];
  destinations: DestinationKey[];
  durationLabel: L;
  durationMinutes: number;
  durationDays: number;
  startTimes: string[];
  /** Weekdays the tour runs (0 = Sunday … 6 = Saturday); omit for every day. */
  operatingWeekdays?: number[];
  /** Departure start dates (YYYY-MM-DD); when set, only these dates can be booked. */
  fixedDepartureDates?: string[];
  /** "shared" for group trips and tickets; omit for private departures. */
  departureType?: "private" | "shared";
  pickupIncluded: boolean;
  guideLanguages: string[];
  minGroup: number;
  maxGroup: number;
  capacityPerSlot: number;
  difficulty?: "easy" | "moderate" | "challenging";
  pricingModel: "per_group" | "per_person" | "tiered" | "per_vehicle";
  /** OMR (major units) */
  priceGroupOmr?: number;
  priceAdultOmr?: number;
  priceChildOmr?: number;
  /** Tiered: totals for the first adult and the first two adults, then flat add-ons per extra adult / child. */
  tieredOmr?: { firstAdult: number; firstTwoAdults: number; extraAdult: number; extraChild: number };
  /** Per-vehicle: flat price per 4WD; one vehicle carries up to `seats` guests, at most `maxAdults` adults. */
  vehicleOmr?: { pricePerVehicle: number; maxAdults: number; seats: number };
  childAgeMax?: number;
  /** USD reference from Viator, if any */
  usdReference?: number;
  depositPercent: number;
  freeCancellationHours: number;
  allowReserveNowPayLater: boolean;
  holdHours: number;
  ratingAverage: number;
  externalReviewCount?: number;
  image: string; // placeholder key under /media/placeholders
  isFeatured: boolean;
  featuredOrder?: number;
  tags: string[];
  meetingPoint?: { label: L; address?: string; lat?: number; lng?: number };
  priceIsPlaceholder?: boolean;
};

export const VIATOR_URL = (code: string) => `https://www.viator.com/tours/Muscat/x/d4304-${code}`;

/** "07:00","07:30",… every `stepMin` minutes from `from` to `to` inclusive. */
export function times(from: string, to: string, stepMin = 30): string[] {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const out: string[] = [];
  for (let m = fh * 60 + fm; m <= th * 60 + tm; m += stepMin) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export const hotelMuscat = { label: { en: "Your hotel in Muscat", ar: "فندقك في مسقط" }, lat: 23.588, lng: 58.3829 };
export const airportMuscat = { label: { en: "Muscat International Airport – Arrivals", ar: "مطار مسقط الدولي – صالة الوصول" }, lat: 23.5933, lng: 58.2844 };

export const commonExclusions: L[] = [
  { en: "Personal expenses and gratuities", ar: "المصاريف الشخصية والإكراميات" },
  { en: "Travel insurance", ar: "تأمين السفر" },
  { en: "Anything not mentioned under inclusions", ar: "أي شيء غير مذكور ضمن ما يشمله السعر" },
];

const pickupFaq = {
  question: { en: "Is hotel pickup included?", ar: "هل يشمل السعر الاستلام من الفندق؟" },
  answer: {
    en: "Yes. We collect you from any hotel or address in Muscat, from Muscat International Airport or from the cruise terminal at Sultan Qaboos Port, and drop you back at the end. Pickups far outside the city centre may carry a small supplement, which we confirm before payment.",
    ar: "نعم. نستقبلك من أي فندق أو عنوان في مسقط، أو من مطار مسقط الدولي، أو من محطة السفن السياحية في ميناء السلطان قابوس، ونعيدك في النهاية. قد يُطبَّق رسم بسيط للاستلام من المناطق البعيدة عن وسط المدينة، ونؤكده قبل الدفع.",
  },
};

const privateFaq = {
  question: { en: "Is this a private tour?", ar: "هل هذه جولة خاصة؟" },
  answer: {
    en: "Yes. Every departure is private to your party, with your own licensed Omani guide and vehicle, so the pace and the stops adapt to you.",
    ar: "نعم. كل انطلاقة خاصة بمجموعتك مع مرشد عُماني مرخّص وسيارة خاصة، بحيث تتكيّف الوتيرة والمحطات مع رغباتك.",
  },
};

const dayCancelFaq = {
  question: { en: "What is the cancellation policy?", ar: "ما هي سياسة الإلغاء؟" },
  answer: {
    en: "Free cancellation up to 72 hours before the start time for a full refund of the deposit. Later cancellations and no-shows are non-refundable. See our Cancellation Policy for the full terms.",
    ar: "إلغاء مجاني حتى 72 ساعة قبل موعد البدء مع استرداد كامل العربون. الإلغاء بعد ذلك أو عدم الحضور غير قابل للاسترداد. راجع سياسة الإلغاء للتفاصيل الكاملة.",
  },
};

const multiCancelFaq = {
  question: { en: "What is the cancellation policy?", ar: "ما هي سياسة الإلغاء؟" },
  answer: {
    en: "Multi-day journeys can be cancelled free of charge up to 30 days before departure for a full refund of the deposit; later cancellations are non-refundable because hotels and camps are booked in your name. See our Cancellation Policy for the full terms.",
    ar: "يمكن إلغاء الرحلات متعددة الأيام مجانًا حتى 30 يومًا قبل الانطلاق مع استرداد كامل العربون؛ والإلغاء بعد ذلك غير قابل للاسترداد لأن الفنادق والمخيمات تُحجز باسمك. راجع سياسة الإلغاء للتفاصيل الكاملة.",
  },
};

const paymentFaq = {
  question: { en: "How does payment work?", ar: "كيف يتم الدفع؟" },
  answer: {
    en: "You pay a 35% deposit online to confirm the booking; the balance is paid to your guide at the start of the trip in cash or by card. Direct bookings on this site are not subject to marketplace commissions, so the price you see is the price you pay.",
    ar: "تدفع عربونًا بنسبة 35% عبر الإنترنت لتأكيد الحجز، ويُدفع المبلغ المتبقي للمرشد عند بداية الرحلة نقدًا أو بالبطاقة. الحجز المباشر عبر هذا الموقع لا يخضع لعمولات المنصات، فالسعر الذي تراه هو ما تدفعه.",
  },
};

/** Matches what the booking engine charges: per-person prices, no automatic party-size discount (see migrations:fixRoomsFaq). */
export const roomsFaq = {
  question: { en: "Can we travel as a family of four?", ar: "هل يمكننا السفر كعائلة من أربعة أشخاص؟" },
  answer: {
    en: "Yes. Prices are per person, based on two travellers sharing a room. Children share their parents' room and pay the reduced child price shown on this page. Choose the number of travellers on the booking page and the total updates automatically. A single-room supplement and rates for larger parties are quoted on request, so just contact us.",
    ar: "نعم. الأسعار للفرد على أساس مسافرَين يتشاركان غرفة واحدة. يشارك الأطفال غرفة والديهم ويدفعون سعر الطفل المخفّض الموضّح في هذه الصفحة. اختر عدد المسافرين في صفحة الحجز وسيتحدّث الإجمالي تلقائيًا. أمّا مُلحق الغرفة المفردة وأسعار المجموعات الأكبر فنقدّمها عند الطلب، ويسعدنا تواصلكم معنا.",
  },
};

const hotelsFaq = {
  question: { en: "Which hotels and camps do you use?", ar: "ما الفنادق والمخيمات التي تستخدمونها؟" },
  answer: {
    en: "Four-star hotels in the cities and carefully chosen mid-range or classic camps and resorts in the desert, on the coast and in the mountains. Once you book we confirm every property by name, and we can upgrade to five-star options for a supplement.",
    ar: "فنادق أربع نجوم في المدن، ومخيمات ومنتجعات متوسطة أو كلاسيكية مختارة بعناية في الصحراء وعلى الساحل وفي الجبال. بعد الحجز نؤكد لك أسماء جميع أماكن الإقامة، ويمكن الترقية إلى خيارات خمس نجوم مقابل فرق في السعر.",
  },
};

export const dayFaqs = (...extra: { question: L; answer: L }[]) => [...extra, pickupFaq, privateFaq, dayCancelFaq, paymentFaq];
export const multiDayFaqs = (...extra: { question: L; answer: L }[]) => [...extra, roomsFaq, hotelsFaq, multiCancelFaq, paymentFaq];

/** Per-vehicle tours price the 4WD, not the traveller, so the family FAQ says so. */
const vehicleFamilyFaq = {
  question: { en: "Can we travel as a family or a larger group?", ar: "هل يمكننا السفر كعائلة أو مجموعة أكبر؟" },
  answer: {
    en: "Yes. The price is one flat amount per 4WD, which carries up to 4 adults and 6 guests in total — for example 4 adults and 2 children, or 1 adult and 5 children. A larger party simply takes a second vehicle at the same price; choose the number of travellers on the booking page and the total updates automatically.",
    ar: "نعم. السعر مبلغ ثابت لكل سيارة دفع رباعي تتسع حتى 4 بالغين و6 ضيوف إجمالًا، مثل 4 بالغين وطفلين، أو بالغ واحد و5 أطفال. وإن كان عددكم أكبر تُضاف سيارة ثانية بالسعر نفسه؛ اختر عدد المسافرين في صفحة الحجز ويتحدّث الإجمالي تلقائيًا.",
  },
};
export const multiDayVehicleFaqs = (...extra: { question: L; answer: L }[]) => [...extra, vehicleFamilyFaq, hotelsFaq, multiCancelFaq, paymentFaq];
export const serviceFaqs = (...extra: { question: L; answer: L }[]) => [...extra, dayCancelFaq, paymentFaq];

export const DAY = 1440;
