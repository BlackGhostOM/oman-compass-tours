/**
 * Sample reviews for the demo. They are written in the voice of the real
 * Tripadvisor feedback the company receives (guide Musab is praised repeatedly)
 * but they are NOT verbatim copies. Replace them with imported real reviews
 * from Admin → Reviews; each one can be approved, featured or rejected there.
 */
export type ReviewSeed = {
  tourCode?: string;
  authorName: string;
  authorCountry?: string;
  rating: number;
  title?: string;
  body: string;
  language: "en" | "ar";
  source: "site" | "tripadvisor" | "viator" | "google";
  travelDate?: string;
  isFeatured: boolean;
};

export const reviewsSeed: ReviewSeed[] = [
  {
    tourCode: "OCT-001",
    authorName: "Hannah R.",
    authorCountry: "GB",
    rating: 5,
    title: "The perfect introduction to Muscat",
    body: "Musab was an outstanding guide — knowledgeable, funny and genuinely proud of his country. The Grand Mosque was breathtaking and the lunch he chose was the best meal of our trip. Highly recommended.",
    language: "en",
    source: "tripadvisor",
    travelDate: "2026-02",
    isFeatured: true,
  },
  {
    tourCode: "OCT-002",
    authorName: "Lukas & Mira",
    authorCountry: "DE",
    rating: 5,
    title: "Wadi Shab was the highlight of Oman",
    body: "Swimming through the keyhole into the cave waterfall is something we will never forget. Our guide carried our bag, took amazing photos and timed everything so we avoided the crowds.",
    language: "en",
    source: "viator",
    travelDate: "2026-01",
    isFeatured: true,
  },
  {
    tourCode: "OCT-003",
    authorName: "Priya S.",
    authorCountry: "IN",
    rating: 5,
    title: "Desert sunset with a Bedouin family",
    body: "The dune driving was thrilling but safe, and the visit to the Bedouin home felt authentic rather than staged. Coffee, dates and the kindest people. The sunset from the top of the dune was magical.",
    language: "en",
    source: "tripadvisor",
    travelDate: "2025-12",
    isFeatured: true,
  },
  {
    tourCode: "OCT-004",
    authorName: "أحمد الخليلي",
    authorCountry: "SA",
    rating: 5,
    title: "تنظيم ممتاز ومرشد محترف",
    body: "جولة رائعة إلى نزوى والجبل الأخضر. السيارة مريحة والمرشد مصعب على دراية كاملة بالتاريخ والطرق الجبلية. الغداء بإطلالة على الأخدود كان لا يُنسى. أنصح بهم بشدة للعائلات.",
    language: "ar",
    source: "google",
    travelDate: "2026-03",
    isFeatured: true,
  },
  {
    tourCode: "OCT-001",
    authorName: "Claire D.",
    authorCountry: "FR",
    rating: 5,
    body: "Private, flexible and relaxed. We asked to add the fish market and our guide adjusted the route immediately. Great value for a private tour with lunch included.",
    language: "en",
    source: "tripadvisor",
    travelDate: "2025-11",
    isFeatured: false,
  },
  {
    tourCode: "OCT-005",
    authorName: "Jonathan P.",
    authorCountry: "US",
    rating: 5,
    title: "Smooth transfer to Alila",
    body: "Driver was waiting with a sign, the 4WD was spotless and he stopped for photos at the checkpoint viewpoint. Booked the return too.",
    language: "en",
    source: "viator",
    travelDate: "2026-02",
    isFeatured: false,
  },
  {
    tourCode: "OCT-002",
    authorName: "سارة المري",
    authorCountry: "AE",
    rating: 5,
    body: "تجربة وادي شاب مع بوصلة عُمان كانت مذهلة. الفريق اهتم بكل التفاصيل من الاستقبال إلى العودة، وحفرة بمة كانت إضافة جميلة. شكرًا لكم.",
    language: "ar",
    source: "site",
    travelDate: "2026-01",
    isFeatured: true,
  },
  {
    tourCode: "OCT-003",
    authorName: "Tom & Ellie",
    authorCountry: "AU",
    rating: 5,
    title: "Best day of our honeymoon",
    body: "Wadi Bani Khalid in the morning and Wahiba Sands in the afternoon — two completely different worlds. Sandboarding was a laugh and the camels were very photogenic.",
    language: "en",
    source: "tripadvisor",
    travelDate: "2025-10",
    isFeatured: false,
  },
];
