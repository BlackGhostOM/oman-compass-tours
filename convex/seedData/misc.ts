type L = { en: string; ar: string };

export const teamSeed: { name: L; roleTitle: L; bio: L; languages: string[]; image: string; placeholder?: boolean }[] = [
  {
    name: { en: "Musab", ar: "مصعب" },
    roleTitle: { en: "Senior Guide & Co-founder", ar: "مرشد أول وشريك مؤسس" },
    bio: {
      en: "Born in Muscat and licensed for more than a decade, Musab is the guide our guests mention by name in review after review. He knows every wadi track and every family majlis between the coast and the Green Mountain.",
      ar: "وُلد مصعب في مسقط وحصل على ترخيص الإرشاد منذ أكثر من عقد، وهو المرشد الذي يذكره ضيوفنا بالاسم في تقييم تلو الآخر. يعرف كل مسار في الأودية وكل مجلس عائلي بين الساحل والجبل الأخضر.",
    },
    languages: ["ar", "en"],
    image: "team-1",
  },
  {
    name: { en: "Guide (placeholder)", ar: "مرشد (نموذج)" },
    roleTitle: { en: "Desert & Mountain Guide", ar: "مرشد الصحراء والجبال" },
    bio: {
      en: "Placeholder profile — replace with a real team member from Admin → Content → Team.",
      ar: "ملف تعريفي مؤقت؛ استبدله بعضو فريق حقيقي من لوحة الإدارة ← المحتوى ← الفريق.",
    },
    languages: ["ar", "en"],
    image: "team-2",
    placeholder: true,
  },
  {
    name: { en: "Driver (placeholder)", ar: "سائق (نموذج)" },
    roleTitle: { en: "Professional 4WD Driver", ar: "سائق دفع رباعي محترف" },
    bio: {
      en: "Placeholder profile — replace with a real team member from Admin → Content → Team.",
      ar: "ملف تعريفي مؤقت؛ استبدله بعضو فريق حقيقي من لوحة الإدارة ← المحتوى ← الفريق.",
    },
    languages: ["ar", "en"],
    image: "team-3",
    placeholder: true,
  },
];

export const addOnsSeed: { key: string; name: L; description: L; priceOmr: number; priceType: "per_booking" | "per_person" }[] = [
  {
    key: "private_guide_upgrade",
    name: { en: "Dedicated senior guide", ar: "مرشد أول مخصّص" },
    description: { en: "Request Musab or another senior guide for your party.", ar: "اطلب مصعب أو مرشدًا أول آخر لمجموعتك." },
    priceOmr: 20,
    priceType: "per_booking",
  },
  {
    key: "lunch_upgrade",
    name: { en: "Restaurant lunch upgrade", ar: "ترقية الغداء إلى مطعم" },
    description: { en: "Replace the picnic with a sit-down lunch at a local restaurant.", ar: "استبدل الغداء الخفيف بغداء في مطعم محلي." },
    priceOmr: 8,
    priceType: "per_person",
  },
  {
    key: "photographer",
    name: { en: "Photo package", ar: "باقة التصوير" },
    description: { en: "Your guide shoots and shares 30+ edited photos within 48 hours.", ar: "يلتقط مرشدك أكثر من 30 صورة معدّلة ويشاركها خلال 48 ساعة." },
    priceOmr: 15,
    priceType: "per_booking",
  },
  {
    key: "child_seat",
    name: { en: "Child seat", ar: "مقعد أطفال" },
    description: { en: "ISOFIX child seat fitted before pickup.", ar: "مقعد أطفال ISOFIX يُركَّب قبل الاستلام." },
    priceOmr: 0,
    priceType: "per_booking",
  },
];

export const couponsSeed = [
  {
    code: "WELCOME10",
    name: { en: "Welcome 10 % off", ar: "خصم ترحيبي 10%" },
    type: "percent" as const,
    value: 10,
    maxDiscountOmr: 30,
    usageLimit: 500,
  },
  {
    code: "EARLYBIRD",
    name: { en: "Early bird — book 30 days ahead", ar: "الحجز المبكر قبل 30 يومًا" },
    type: "percent" as const,
    value: 8,
    earlyBirdDays: 30,
  },
  {
    code: "GROUP6",
    name: { en: "Group of 6+ discount", ar: "خصم المجموعات من 6 أفراد فأكثر" },
    type: "fixed" as const,
    value: 25,
    minGroupSize: 6,
  },
];

export const siteSettingsSeed: Record<string, unknown> = {
  "company.info": {
    name: "Oman Compass Tours Company",
    nameAr: "شركة بوصلة عُمان للسياحة",
    phone: "+968 9225 5028",
    whatsapp: "96892255028",
    email: "omancompasstours@gmail.com",
    license: "1440944",
  },
  "booking.holdHoursDefault": 24,
  "booking.reminderHoursBefore": 24,
  "booking.abandonedDraftReminderHours": 3,
  "chat.onlineHours": { start: "07:30", end: "19:30", timezone: "Asia/Muscat" },
  "chat.expectedResponseMinutes": 10,
  "leads.slaMinutes": 60,
  "payments.defaultProviderByCountry": { OM: "thawani", AE: "thawani", SA: "thawani", KW: "thawani", QA: "thawani", BH: "thawani", default: "stripe" },
  "home.heroVideoUrl": "",
  "home.heroPosterUrl": "/media/placeholders/hero.jpg",
};

export const bannersSeed: { key: string; placement: string; title: L; subtitle: L; ctaLabel: L; ctaHref: string; image: string; countdownDays?: number }[] = [
  {
    key: "home_hero",
    placement: "home_hero",
    title: { en: "Find your bearings in Oman", ar: "اكتشف عُمان على بوصلتك الخاصة" },
    subtitle: {
      en: "Deserts, wadis, mountains and living heritage — explored privately with expert Omani guides.",
      ar: "صحارٍ وأودية وجبال وتراث حيّ؛ تستكشفها بخصوصية تامة برفقة مرشدين عُمانيين خبراء.",
    },
    ctaLabel: { en: "Explore Tours", ar: "استكشف الجولات" },
    ctaHref: "/tours",
    image: "hero",
  },
  {
    key: "promo_winter",
    placement: "home_promo",
    title: { en: "Winter season is open", ar: "موسم الشتاء مفتوح" },
    subtitle: { en: "Book 30 days ahead and save 8 % with code EARLYBIRD.", ar: "احجز قبل 30 يومًا ووفّر 8% برمز EARLYBIRD." },
    ctaLabel: { en: "See all tours", ar: "جميع الجولات" },
    ctaHref: "/tours",
    image: "wahiba",
    countdownDays: 21,
  },
];
