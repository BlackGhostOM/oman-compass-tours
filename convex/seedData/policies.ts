import { POLICY_TEXTS } from "./policyTexts2026";
type L = { en: string; ar: string };

export type PolicySeed = {
  key: string;
  order: number;
  requiredAtCheckout: boolean;
  title: L;
  body: L; // markdown
};

const legalNotice = {
  en: "> **Draft for legal review.** This text was prepared as a professional placeholder and must be reviewed by a qualified Omani lawyer before publication.\n\n",
  ar: "> **مسودة للمراجعة القانونية.** أُعدّ هذا النص كنموذج مهني مؤقت ويجب مراجعته من قِبل محامٍ عُماني مؤهل قبل النشر.\n\n",
};

const company = {
  en: "Oman Compass Tours Company (\"the Company\", \"we\"), a tour operator licensed by the Ministry of Heritage & Tourism of the Sultanate of Oman under licence no. 1440944, Bawshar, Muscat.",
  ar: "شركة بوصلة عُمان للسياحة (\"الشركة\"، \"نحن\")، وهي منظّم رحلات سياحية مرخّص من وزارة التراث والسياحة في سلطنة عُمان بموجب الترخيص رقم 1440944، بوشر، مسقط.",
};

export const policiesSeed: PolicySeed[] = [
  {
    key: "terms",
    order: 1,
    requiredAtCheckout: true,
    title: { en: "Terms & Conditions", ar: "الشروط والأحكام" },
    body: {
      en: `${legalNotice.en}## 1. Parties
These terms govern every booking made with ${company.en} By confirming a booking online, by WhatsApp, by phone, by email or at our office, the lead traveller ("you") accepts these terms on behalf of every member of the party.

## 2. Bookings and confirmation
1. A booking request becomes a confirmed booking only when we issue a booking reference and voucher after receiving the required payment (full payment or deposit) or, for "reserve now, pay later" requests, when the hold is converted before its expiry.
2. Prices are quoted in Omani Rial (OMR). Conversions to other currencies are shown for guidance only; the amount charged in the settlement currency is displayed before payment.
3. We reserve the right to correct obvious pricing errors before confirmation.

## 3. Your responsibilities
- Provide accurate traveller details, a working phone number and, where required, passport details.
- Be at the agreed pickup point at the agreed time. Waiting time is limited to 20 minutes for tours and 60 minutes for airport transfers.
- Follow the guide's safety instructions at all times, especially in wadis, on dunes and at sea.
- Hold valid travel insurance covering medical care, repatriation and adventure activities.

## 4. Itinerary changes
Oman's weather, road conditions and government advisories can change quickly. We may alter the order of stops, substitute comparable activities or, in rare cases, cancel a tour for safety. If we cancel, you may choose an alternative date, an alternative tour of equal value, or a full refund.

## 5. Liability
We act with reasonable care and skill. Our liability for loss or damage arising from a booking is limited to the amount paid for that booking, except where the law does not allow such limitation. We are not liable for events outside our reasonable control (force majeure), including but not limited to weather, flooding of wadis, road closures, strikes or public health restrictions.

## 6. Conduct
We may refuse or terminate service, without refund, to any guest whose behaviour endangers others, damages property or breaks Omani law or customs.

## 7. Governing law
These terms are governed by the laws of the Sultanate of Oman. Disputes are subject to the exclusive jurisdiction of the courts of Muscat.

## 8. Contact
Oman Compass Tours Company · +968 9225 5028 · omancompasstours@gmail.com`,
      ar: `${legalNotice.ar}## 1. الأطراف
تحكم هذه الشروط كل حجز يُجرى مع ${company.ar} وبتأكيد الحجز عبر الإنترنت أو واتساب أو الهاتف أو البريد الإلكتروني أو في مكتبنا، يقبل المسافر الرئيسي ("أنت") هذه الشروط نيابةً عن جميع أفراد المجموعة.

## 2. الحجوزات والتأكيد
1. يصبح طلب الحجز حجزًا مؤكدًا فقط عندما نصدر رقم الحجز والقسيمة بعد استلام الدفعة المطلوبة (كامل المبلغ أو العربون)، أو في طلبات "احجز الآن وادفع لاحقًا" عند تحويل الحجز المؤقت قبل انتهاء مدته.
2. تُعرض الأسعار بالريال العُماني. والتحويلات إلى العملات الأخرى للإرشاد فقط؛ ويُعرض المبلغ الذي سيُحصَّل بعملة التسوية قبل الدفع.
3. نحتفظ بالحق في تصحيح أخطاء التسعير الواضحة قبل التأكيد.

## 3. مسؤولياتك
- تقديم بيانات دقيقة للمسافرين ورقم هاتف فعّال، وبيانات جواز السفر عند الحاجة.
- الحضور إلى نقطة الاستلام المتفق عليها في الوقت المحدد. يقتصر وقت الانتظار على 20 دقيقة للجولات و60 دقيقة للنقل من المطار.
- اتباع تعليمات السلامة الصادرة عن المرشد في جميع الأوقات، خاصة في الأودية وعلى الكثبان وفي البحر.
- حمل تأمين سفر ساري المفعول يغطي الرعاية الطبية والإعادة إلى الوطن وأنشطة المغامرة.

## 4. تغييرات البرنامج
قد تتغير أحوال الطقس والطرق والتوجيهات الحكومية في عُمان بسرعة. يجوز لنا تغيير ترتيب المحطات أو استبدال أنشطة مماثلة، وفي حالات نادرة إلغاء الجولة حفاظًا على السلامة. وفي حال إلغائنا للجولة، يمكنك اختيار موعد بديل أو جولة بديلة بالقيمة نفسها أو استرداد كامل المبلغ.

## 5. المسؤولية
نتصرف بعناية ومهارة معقولتين. وتقتصر مسؤوليتنا عن أي خسارة أو ضرر ناشئ عن الحجز على المبلغ المدفوع لذلك الحجز، ما لم يمنع القانون هذا التحديد. ولسنا مسؤولين عن الأحداث الخارجة عن سيطرتنا المعقولة (القوة القاهرة) بما في ذلك، على سبيل المثال لا الحصر، الطقس وفيضان الأودية وإغلاق الطرق والإضرابات وقيود الصحة العامة.

## 6. السلوك
يجوز لنا رفض تقديم الخدمة أو إنهاؤها دون استرداد لأي ضيف يعرّض سلوكه الآخرين للخطر أو يُتلف الممتلكات أو يخالف القوانين والأعراف العُمانية.

## 7. القانون الواجب التطبيق
تخضع هذه الشروط لقوانين سلطنة عُمان، وتختص محاكم مسقط حصريًا بالنظر في أي نزاع.

## 8. التواصل
شركة بوصلة عُمان للسياحة · +968 9225 5028 · omancompasstours@gmail.com`,
    },
  },
  {
    key: "cancellation",
    order: 2,
    requiredAtCheckout: true,
    title: { en: "Booking & Cancellation Policy", ar: "سياسة الحجز والإلغاء" },
    body: {
      en: POLICY_TEXTS.cancellation.en,
      ar: POLICY_TEXTS.cancellation.ar,
    },
  },
  {
    key: "refund",
    order: 3,
    requiredAtCheckout: false,
    title: { en: "Refund Policy", ar: "سياسة الاسترداد" },
    body: {
      en: POLICY_TEXTS.refund.en,
      ar: POLICY_TEXTS.refund.ar,
    },
  },
  {
    key: "privacy",
    order: 4,
    requiredAtCheckout: true,
    title: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
    body: {
      en: `${legalNotice.en}This policy explains how ${company.en} collects and uses personal data in accordance with Oman's **Personal Data Protection Law (Royal Decree 6/2022)** and its executive regulations.

## What we collect
- **Identity and contact data:** name, nationality, phone, email, hotel or pickup address.
- **Booking data:** tour, dates, party size, special requests, payment status and provider transaction IDs. We never store card numbers.
- **Documents:** passport or ID copies only when required by a hotel, airline or authority; stored encrypted and deleted 90 days after the trip.
- **Technical data:** IP address, device and browser, pages visited, and cookies (see the Cookie Policy).
- **Communications:** messages sent through our chat widget, WhatsApp, email or contact forms.

## Why we use it
To deliver the services you book, comply with tourism and immigration regulations, respond to enquiries, prevent fraud, improve our website and — only with your consent — send marketing.

## Legal basis
Performance of a contract, compliance with legal obligations, our legitimate interests in running the business, and your consent where required.

## Sharing
With hotels, camps, airlines and drivers necessary to deliver your booking; with payment providers (Thawani, Stripe, PayPal); with our hosting and email providers (Vercel, Convex, Resend); and with authorities when the law requires. We do not sell personal data.

## International transfers
Some providers process data outside Oman under contractual safeguards.

## Retention
Booking records are kept for 10 years for accounting and legal purposes; marketing data until you unsubscribe; chat transcripts for 24 months.

## Your rights
You may request access, correction, deletion, restriction, portability, or withdraw consent from **My Account → Privacy** or by emailing omancompasstours@gmail.com. We respond within 30 days. You may complain to the Ministry of Transport, Communications & Information Technology (MTCIT).

## Children
We do not knowingly collect data from children under 18 except as part of a booking made by a parent or guardian.

## Contact
Data controller: Oman Compass Tours Company, Bawshar, Muscat · omancompasstours@gmail.com`,
      ar: `${legalNotice.ar}توضّح هذه السياسة كيف تجمع ${company.ar} البيانات الشخصية وتستخدمها وفقًا **لقانون حماية البيانات الشخصية العُماني (المرسوم السلطاني رقم 6/2022)** ولائحته التنفيذية.

## ما نجمعه
- **بيانات الهوية والتواصل:** الاسم والجنسية والهاتف والبريد الإلكتروني وعنوان الفندق أو نقطة الاستلام.
- **بيانات الحجز:** الجولة والتواريخ وعدد الأفراد والطلبات الخاصة وحالة الدفع ومعرّفات المعاملات لدى مزوّد الدفع. ولا نخزّن أرقام البطاقات أبدًا.
- **الوثائق:** نسخ جواز السفر أو الهوية فقط عندما يشترطها فندق أو شركة طيران أو جهة رسمية؛ وتُخزَّن مشفّرة وتُحذف بعد 90 يومًا من انتهاء الرحلة.
- **البيانات التقنية:** عنوان IP والجهاز والمتصفح والصفحات التي زرتها وملفات تعريف الارتباط (انظر سياسة ملفات تعريف الارتباط).
- **المراسلات:** الرسائل المرسلة عبر أداة الدردشة أو واتساب أو البريد الإلكتروني أو نماذج التواصل.

## سبب الاستخدام
لتقديم الخدمات التي تحجزها، والامتثال للوائح السياحة والهجرة، والرد على الاستفسارات، ومنع الاحتيال، وتحسين موقعنا، وإرسال المواد التسويقية بموافقتك فقط.

## الأساس القانوني
تنفيذ العقد، والامتثال للالتزامات القانونية، ومصالحنا المشروعة في إدارة العمل، وموافقتك حيثما تُشترط.

## المشاركة
مع الفنادق والمخيمات وشركات الطيران والسائقين اللازمين لتنفيذ حجزك؛ ومع مزوّدي الدفع (ثواني، سترايب، باي بال)؛ ومع مزوّدي الاستضافة والبريد (Vercel وConvex وResend)؛ ومع الجهات الرسمية عندما يقتضي القانون ذلك. ولا نبيع البيانات الشخصية.

## النقل الدولي
يعالج بعض المزوّدين البيانات خارج عُمان بموجب ضمانات تعاقدية.

## الاحتفاظ بالبيانات
تُحفظ سجلات الحجز لمدة 10 سنوات لأغراض محاسبية وقانونية؛ وبيانات التسويق حتى إلغاء الاشتراك؛ ونصوص الدردشة لمدة 24 شهرًا.

## حقوقك
يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها أو تقييد معالجتها أو نقلها أو سحب موافقتك من **حسابي ← الخصوصية** أو عبر البريد omancompasstours@gmail.com. ونرد خلال 30 يومًا. ويحق لك تقديم شكوى إلى وزارة النقل والاتصالات وتقنية المعلومات.

## الأطفال
لا نجمع عن قصد بيانات من أطفال دون 18 عامًا إلا في إطار حجز يجريه أحد الوالدين أو الوصي.

## التواصل
المتحكم في البيانات: شركة بوصلة عُمان للسياحة، بوشر، مسقط · omancompasstours@gmail.com`,
    },
  },
  {
    key: "cookies",
    order: 5,
    requiredAtCheckout: false,
    title: { en: "Cookie Policy", ar: "سياسة ملفات تعريف الارتباط" },
    body: {
      en: `${legalNotice.en}## What cookies we use
| Category | Purpose | Examples |
| --- | --- | --- |
| Strictly necessary | Language preference, login session, booking draft, cookie-consent choice | \`NEXT_LOCALE\`, auth session, \`oct_session\` |
| Analytics (consent) | Understand how the site is used | Vercel Analytics, Google Analytics 4 |
| Marketing (consent) | Measure advertising campaigns | Meta Pixel, Snapchat Pixel, TikTok Pixel |

## Your choices
Analytics and marketing cookies load only after you accept them in the consent banner. Change your choice at any time from the "Cookie settings" link in the footer. Blocking strictly necessary cookies may prevent booking.

## Third parties
Payment pages hosted by Thawani, Stripe and PayPal set their own cookies under their policies.`,
      ar: `${legalNotice.ar}## ملفات تعريف الارتباط التي نستخدمها
| الفئة | الغرض | أمثلة |
| --- | --- | --- |
| ضرورية | تفضيل اللغة، جلسة تسجيل الدخول، مسودة الحجز، اختيار الموافقة | \`NEXT_LOCALE\`، جلسة المصادقة، \`oct_session\` |
| تحليلية (بموافقة) | فهم كيفية استخدام الموقع | Vercel Analytics، Google Analytics 4 |
| تسويقية (بموافقة) | قياس الحملات الإعلانية | Meta Pixel، Snapchat Pixel، TikTok Pixel |

## خياراتك
لا تُحمَّل ملفات التحليل والتسويق إلا بعد قبولها في شريط الموافقة. ويمكنك تغيير اختيارك في أي وقت من رابط "إعدادات ملفات تعريف الارتباط" في أسفل الصفحة. وقد يمنع حظر الملفات الضرورية إتمام الحجز.

## الأطراف الثالثة
تضع صفحات الدفع المستضافة لدى ثواني وسترايب وباي بال ملفات تعريف ارتباط خاصة بها وفق سياساتها.`,
    },
  },
  {
    key: "waiver",
    order: 6,
    requiredAtCheckout: true,
    title: { en: "Travel Safety & Liability Waiver", ar: "سلامة السفر وإخلاء المسؤولية" },
    body: {
      en: POLICY_TEXTS.waiver.en,
      ar: POLICY_TEXTS.waiver.ar,
    },
  },
  {
    key: "child",
    order: 7,
    requiredAtCheckout: false,
    title: { en: "Child Policy", ar: "سياسة الأطفال" },
    body: {
      en: `${legalNotice.en}- **Infants (0–2)** travel free on most tours when seated on an adult's lap; child seats are available on request at no charge.
- **Children (3–11)** pay the child rate shown on the tour page (typically 50 % of the adult rate) on per-person tours; per-group prices already include children.
- **Teenagers (12+)** pay the adult rate.
- Children under 18 must be accompanied by a parent or legal guardian.
- Some activities have minimum ages for safety: the Wadi Shab cave swim (8+), dune bashing (4+), and multi-day desert camps (6+). Your guide will offer alternatives where a child cannot take part.`,
      ar: `${legalNotice.ar}- **الرضّع (0–2 سنة)** يسافرون مجانًا في معظم الجولات عند جلوسهم في حضن شخص بالغ؛ وتتوفر مقاعد الأطفال عند الطلب دون رسوم.
- **الأطفال (3–11 سنة)** يدفعون سعر الطفل المبيّن في صفحة الجولة (عادةً 50% من سعر البالغ) في الجولات المسعّرة للشخص؛ أما الأسعار للمجموعة فتشمل الأطفال.
- **المراهقون (12 سنة فأكثر)** يدفعون سعر البالغ.
- يجب أن يكون الأطفال دون 18 عامًا برفقة أحد الوالدين أو الوصي القانوني.
- لبعض الأنشطة حد أدنى للعمر لأسباب تتعلق بالسلامة: السباحة إلى كهف وادي شاب (8 سنوات فأكثر)، وقيادة الكثبان (4 سنوات فأكثر)، والمخيمات الصحراوية متعددة الأيام (6 سنوات فأكثر). وسيقترح مرشدك بدائل عندما يتعذر على الطفل المشاركة.`,
    },
  },
  {
    key: "payment",
    order: 8,
    requiredAtCheckout: true,
    title: { en: "Payment Terms", ar: "شروط الدفع" },
    body: {
      en: POLICY_TEXTS.payment.en,
      ar: POLICY_TEXTS.payment.ar,
    },
  },
];
