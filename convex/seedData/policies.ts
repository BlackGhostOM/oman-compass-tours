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
      en: `${legalNotice.en}## Free cancellation
Most day tours and transfers can be cancelled **free of charge up to 24 hours** before the start time. Multi-day packages can be cancelled free of charge up to **72 hours** (2-day and 3-day) or **7 days** (6-day and 8-day) before departure. The exact window is shown on each tour page and on your voucher.

## Late cancellation and no-show
Cancellations inside the free window, and failure to appear at the pickup point, are charged at 100 % of the booking value.

## How to cancel
Cancel from **My Account → My Bookings**, or contact us on WhatsApp +968 9225 5028 or omancompasstours@gmail.com quoting your booking reference. The time we receive your message (Oman time) determines eligibility.

## Changes
Date, time and group-size changes are free when requested before the free-cancellation deadline and subject to availability. Price differences apply.

## Reserve now, pay later
Holds expire automatically at the time shown in your confirmation email (24–48 hours). An expired hold is not a booking and carries no charge.

## Cancellation by us
If we cancel for weather, safety or operational reasons, you receive a full refund or a free rebooking — your choice.`,
      ar: `${legalNotice.ar}## الإلغاء المجاني
يمكن إلغاء معظم الجولات اليومية وخدمات النقل **مجانًا حتى 24 ساعة** قبل موعد البدء. ويمكن إلغاء الباقات متعددة الأيام مجانًا حتى **72 ساعة** (باقات اليومين والثلاثة أيام) أو **7 أيام** (باقات الستة والثمانية أيام) قبل الانطلاق. تُعرض المهلة الدقيقة في صفحة كل جولة وعلى قسيمة الحجز.

## الإلغاء المتأخر وعدم الحضور
يُحتسب الإلغاء داخل مهلة الإلغاء المجاني، وكذلك عدم الحضور في نقطة الاستلام، بنسبة 100% من قيمة الحجز.

## كيفية الإلغاء
ألغِ من **حسابي ← حجوزاتي**، أو تواصل معنا عبر واتساب +968 9225 5028 أو omancompasstours@gmail.com مع ذكر رقم الحجز. ويُحدَّد الاستحقاق وفق وقت استلامنا لرسالتك (بتوقيت عُمان).

## التعديلات
تعديلات التاريخ والوقت وحجم المجموعة مجانية عند طلبها قبل موعد الإلغاء المجاني ورهنًا بالتوفر. وتُطبَّق فروق الأسعار.

## احجز الآن وادفع لاحقًا
ينتهي الحجز المؤقت تلقائيًا في الوقت المبيّن في رسالة التأكيد (24–48 ساعة). ولا يُعد الحجز المؤقت المنتهي حجزًا ولا تترتب عليه أي رسوم.

## الإلغاء من جانبنا
إذا ألغينا الجولة لأسباب تتعلق بالطقس أو السلامة أو التشغيل، تحصل على استرداد كامل أو إعادة حجز مجانية؛ الخيار لك.`,
    },
  },
  {
    key: "refund",
    order: 3,
    requiredAtCheckout: false,
    title: { en: "Refund Policy", ar: "سياسة الاسترداد" },
    body: {
      en: `${legalNotice.en}## Eligible refunds
Refunds are issued for cancellations made within the free-cancellation window, for tours cancelled by us, and for services not delivered through our fault.

## Method and timing
Refunds are returned **to the original payment method** through the same provider (Thawani, Stripe or PayPal). We initiate refunds within 2 business days; banks and card issuers typically take 5–10 business days to show the credit. Refunds are made in the currency originally charged; exchange-rate differences are outside our control.

## Partial refunds
Where part of a package is cancelled or not used, we refund the unused portion at the rates shown on your invoice, less any non-recoverable third-party costs (hotel deposits, flights).

## Deposits
Deposits on multi-day packages are refundable under the same windows as the package itself.

## Disputes
Please contact us before opening a dispute with your bank; most issues are resolved within one business day.`,
      ar: `${legalNotice.ar}## الحالات المستحقة للاسترداد
يُرد المبلغ في حالات الإلغاء ضمن مهلة الإلغاء المجاني، وفي الجولات التي نلغيها نحن، وفي الخدمات التي لم تُقدَّم بسبب تقصير من جانبنا.

## طريقة الاسترداد ومدته
تُعاد المبالغ **إلى وسيلة الدفع الأصلية** عبر مزوّد الدفع نفسه (ثواني أو سترايب أو باي بال). نبدأ إجراءات الاسترداد خلال يومَي عمل؛ وعادةً ما تستغرق البنوك ومُصدرو البطاقات 5–10 أيام عمل لإظهار المبلغ. ويُرد المبلغ بالعملة التي حُصِّلت أصلًا؛ وفروق أسعار الصرف خارجة عن سيطرتنا.

## الاسترداد الجزئي
عند إلغاء جزء من الباقة أو عدم استخدامه، نرد قيمة الجزء غير المستخدم وفق الأسعار المبيّنة في الفاتورة، مخصومًا منها أي تكاليف غير قابلة للاسترداد من أطراف ثالثة (عربون الفنادق، تذاكر الطيران).

## العربون
يُرد عربون الباقات متعددة الأيام وفق المهل نفسها المطبقة على الباقة.

## النزاعات
يرجى التواصل معنا قبل فتح أي نزاع مع البنك؛ فمعظم المسائل تُحل خلال يوم عمل واحد.`,
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
      en: `${legalNotice.en}## Acknowledgement of risk
Tours may include off-road driving, swimming in natural pools, hiking on uneven terrain, dune driving, boat trips and exposure to heat. You confirm that you and every member of your party are in good health, able to take part, and have disclosed any medical condition that could affect participation.

## Safety rules
- Follow the guide's instructions at all times; the guide may stop any activity for safety.
- Wear seat belts; remain seated during dune driving.
- Do not enter wadis when rain is forecast; flash floods are dangerous.
- Life jackets must be worn on boats and are recommended for weak swimmers in wadis.
- Children must be supervised by an adult at all times.

## Release
To the extent permitted by Omani law, you release ${company.en} and its guides and drivers from claims arising from your own negligence, failure to follow instructions, pre-existing medical conditions or force majeure.

## Animal welfare
We do not offer activities that harm animals. Camel encounters take place with licensed Bedouin families who care for their animals; riding is optional and short.

## Insurance
Comprehensive travel insurance including adventure activities is a condition of participation.`,
      ar: `${legalNotice.ar}## الإقرار بالمخاطر
قد تتضمن الجولات قيادة على الطرق الوعرة وسباحة في برك طبيعية ومشيًا على أرض غير مستوية وقيادة على الكثبان ورحلات بحرية وتعرّضًا للحرارة. وتؤكد أنك وجميع أفراد مجموعتك بصحة جيدة وقادرون على المشاركة، وأنك أفصحت عن أي حالة طبية قد تؤثر في المشاركة.

## قواعد السلامة
- اتبع تعليمات المرشد في جميع الأوقات؛ ويحق للمرشد إيقاف أي نشاط حفاظًا على السلامة.
- اربط حزام الأمان؛ وابقَ جالسًا أثناء القيادة على الكثبان.
- لا تدخل الأودية عند توقّع هطول الأمطار؛ فالسيول الجارفة خطيرة.
- يجب ارتداء سترات النجاة في القوارب ويُنصح بها لضعاف السباحة في الأودية.
- يجب أن يكون الأطفال تحت إشراف شخص بالغ طوال الوقت.

## الإبراء
إلى الحد الذي يسمح به القانون العُماني، تُبرئ ${company.ar} ومرشديها وسائقيها من أي مطالبات ناشئة عن إهمالك أو عدم اتباعك للتعليمات أو حالاتك الطبية السابقة أو القوة القاهرة.

## رفق الحيوان
لا نقدّم أنشطة تضر بالحيوانات. وتتم لقاءات الإبل مع عائلات بدوية مرخّصة تعتني بحيواناتها؛ والركوب اختياري وقصير.

## التأمين
التأمين الشامل على السفر بما يشمل أنشطة المغامرة شرط للمشاركة.`,
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
      en: `${legalNotice.en}## Accepted methods
- **Thawani** — Omani and GCC debit/credit cards, charged in OMR.
- **Stripe** — international Visa, Mastercard, American Express, Apple Pay and Google Pay, charged in USD, EUR or GBP.
- **PayPal** — charged in USD.
- **Bank transfer, cash at our office, or a staff-issued payment link** for bookings made by WhatsApp, phone or email.

## Full payment and deposits
Day tours and transfers require full payment at booking. Multi-day packages require a **30 % deposit**; the balance is due 7 days before departure and we send a payment link automatically. Unpaid balances may result in cancellation under the cancellation policy.

## Currency
All prices are set in Omani Rial (OMR). When you pay through Stripe or PayPal, the amount is converted at the rate shown on the checkout page at the time of payment. Your bank may apply its own fees.

## Security
Payments are processed on the providers' PCI-DSS-compliant hosted pages. We never see or store card numbers; we keep only the provider's transaction reference.

## Receipts and invoices
A receipt is emailed immediately after payment and a VAT-compliant invoice (5 % VAT included where applicable) is available in My Account → Payments.`,
      ar: `${legalNotice.ar}## وسائل الدفع المقبولة
- **ثواني** — بطاقات الخصم والائتمان العُمانية والخليجية، وتُحصَّل بالريال العُماني.
- **سترايب** — بطاقات فيزا وماستركارد وأمريكان إكسبريس الدولية وApple Pay وGoogle Pay، وتُحصَّل بالدولار الأمريكي أو اليورو أو الجنيه الإسترليني.
- **باي بال** — يُحصَّل بالدولار الأمريكي.
- **التحويل البنكي أو الدفع نقدًا في مكتبنا أو رابط دفع يصدره فريقنا** للحجوزات عبر واتساب أو الهاتف أو البريد الإلكتروني.

## الدفع الكامل والعربون
تتطلب الجولات اليومية وخدمات النقل الدفع الكامل عند الحجز. وتتطلب الباقات متعددة الأيام **عربونًا بنسبة 30%**؛ ويُستحق الباقي قبل 7 أيام من الانطلاق ونرسل رابط الدفع تلقائيًا. وقد يؤدي عدم سداد الباقي إلى الإلغاء وفق سياسة الإلغاء.

## العملة
تُحدَّد جميع الأسعار بالريال العُماني. وعند الدفع عبر سترايب أو باي بال يُحوَّل المبلغ بسعر الصرف المعروض في صفحة الدفع وقت السداد. وقد يفرض بنكك رسومًا خاصة به.

## الأمان
تُعالَج المدفوعات على صفحات مستضافة لدى المزوّدين متوافقة مع معيار PCI-DSS. ولا نطّلع على أرقام البطاقات ولا نخزّنها؛ ونحتفظ فقط بمرجع المعاملة لدى المزوّد.

## الإيصالات والفواتير
يُرسل الإيصال بالبريد الإلكتروني فور الدفع، وتتوفر فاتورة متوافقة مع ضريبة القيمة المضافة (شاملة 5% حيثما تنطبق) في حسابي ← المدفوعات.`,
    },
  },
];
