/**
 * Frequently asked questions, bilingual. Used by the public /faq page and fed
 * to the AI concierge so chat answers match what the website says.
 */
export type FaqItem = { q: { en: string; ar: string }; a: { en: string; ar: string } };
export type FaqGroup = { key: string; title: { en: string; ar: string }; items: FaqItem[] };

const g = (key: string, en: string, ar: string, items: [string, string, string, string][]): FaqGroup => ({
  key,
  title: { en, ar },
  items: items.map(([qEn, qAr, aEn, aAr]) => ({ q: { en: qEn, ar: qAr }, a: { en: aEn, ar: aAr } })),
});

export const FAQ: FaqGroup[] = [
  g("about", "About Oman Compass Tours", "عن بوصلة عُمان للسياحة", [
    ["What is Oman Compass Tours known for?", "بمَ تشتهر بوصلة عُمان للسياحة؟", "Oman Compass Tours is known for private, personalized tours across Oman with friendly local guides, comfortable 4WD vehicles, and flexible itineraries.", "تشتهر بوصلة عُمان للسياحة بالجولات الخاصة المصمَّمة حسب رغبة الضيف في أنحاء عُمان، مع مرشدين محليين ودودين، وسيارات دفع رباعي مريحة، وبرامج مرنة."],
    ["Where is Oman Compass Tours located?", "أين يقع مقر بوصلة عُمان للسياحة؟", "We are based in Muscat and provide tours throughout Oman.", "مقرّنا في مسقط، وننظّم الجولات في جميع أنحاء عُمان."],
    ["Why should I book with Oman Compass Tours?", "لماذا أحجز مع بوصلة عُمان للسياحة؟", "Guests choose us for reliable service, knowledgeable guides, authentic local experiences, and excellent customer care.", "يختارنا الضيوف لخدمتنا الموثوقة، ومرشدينا ذوي المعرفة، وتجاربنا المحلية الأصيلة، وعنايتنا الممتازة بالعملاء."],
    ["Are you a licensed tour operator?", "هل أنتم شركة سياحة مرخّصة؟", "Yes, we are a fully licensed Omani tour company.", "نعم، نحن شركة سياحة عُمانية مرخّصة بالكامل."],
    ["Is Oman Compass Tours suitable for first-time visitors?", "هل تناسب بوصلة عُمان للسياحة من يزور عُمان للمرة الأولى؟", "Absolutely. We help first-time visitors discover the best of Oman in an easy and enjoyable way.", "بالتأكيد. نساعد الزائرين لأول مرة على اكتشاف أجمل ما في عُمان بطريقة سهلة وممتعة."],
  ]),
  g("booking", "Booking & Payments", "الحجز والدفع", [
    ["How do I book a tour with Oman Compass Tours?", "كيف أحجز جولة مع بوصلة عُمان للسياحة؟", "You can book directly with us through WhatsApp, email, social media, or our website.", "يمكنك الحجز معنا مباشرة عبر واتساب أو البريد الإلكتروني أو وسائل التواصل الاجتماعي أو موقعنا الإلكتروني."],
    ["Do I need to book in advance?", "هل يلزم الحجز مسبقًا؟", "Advance booking is recommended, especially during the busy travel season.", "يُنصح بالحجز المسبق، خصوصًا في موسم الذروة السياحية."],
    ["Can I make a last-minute booking?", "هل يمكنني الحجز في اللحظة الأخيرة؟", "Yes, last-minute bookings are possible depending on availability.", "نعم، الحجز في اللحظة الأخيرة ممكن حسب التوفر."],
    ["Do you require a deposit?", "هل تطلبون عربونًا؟", "All tours require a deposit to confirm the booking, especially multi-day packages. In some cases, full payment may be required depending on the tour or booking details.", "تتطلب جميع الجولات عربونًا لتأكيد الحجز، خصوصًا الباقات متعددة الأيام. وفي بعض الحالات قد يُطلب الدفع الكامل حسب نوع الجولة وتفاصيل الحجز."],
    ["What payment methods do you accept?", "ما طرق الدفع التي تقبلونها؟", "We accept cash, bank transfer, selected online payment methods, and direct payment through our website.", "نقبل الدفع نقدًا، والتحويل البنكي، وبعض طرق الدفع الإلكتروني، والدفع المباشر عبر موقعنا."],
  ]),
  g("tours", "Tours & Experiences", "الجولات والتجارب", [
    ["What tours do you offer?", "ما الجولات التي تقدمونها؟", "We offer city tours, desert adventures, mountain trips, wadi tours, beach tours, dhow cruises, transfers, camping trips, and multi-day travel packages.", "نقدّم جولات المدن، ومغامرات الصحراء، ورحلات الجبال، وجولات الأودية، والشواطئ، ورحلات القوارب التقليدية، وخدمات النقل، ورحلات التخييم، والباقات السياحية متعددة الأيام."],
    ["Do you offer Muscat city tours?", "هل تقدمون جولات في مدينة مسقط؟", "Yes, we offer half-day and full-day tours of Muscat's main attractions.", "نعم، نقدّم جولات لنصف يوم وليوم كامل لأبرز معالم مسقط."],
    ["Do you offer desert tours in Oman?", "هل تقدمون جولات صحراوية في عُمان؟", "Yes, our desert tours include Wahiba Sands, dune driving, camel rides, and overnight camps.", "نعم، تشمل جولاتنا الصحراوية رمال وهيبة، والقيادة على الكثبان، وركوب الجمال، والمبيت في المخيمات."],
    ["Can I visit Jebel Akhdar or Jebel Shams with you?", "هل يمكنني زيارة الجبل الأخضر أو جبل شمس معكم؟", "Yes, we provide mountain tours to both destinations using suitable 4WD vehicles.", "نعم، ننظّم رحلات جبلية إلى الوجهتين بسيارات دفع رباعي مناسبة."],
    ["Do you offer Wadi Shab and Wadi Bani Khalid tours?", "هل تقدمون جولات إلى وادي شاب ووادي بني خالد؟", "Yes, these are among our most popular nature tours.", "نعم، وهما من أكثر جولاتنا الطبيعية شعبية."],
  ]),
  g("private", "Private & Customized Tours", "الجولات الخاصة والمخصّصة", [
    ["Are your tours private?", "هل جولاتكم خاصة؟", "Yes, we specialize in private tours for couples, families, solo travelers, and groups.", "نعم، نتخصص في الجولات الخاصة للأزواج والعائلات والمسافرين الفرديين والمجموعات."],
    ["Can I customize my itinerary?", "هل يمكنني تخصيص برنامج رحلتي؟", "Yes, we can fully customize your tour based on your interests, timing, and budget.", "نعم، يمكننا تخصيص جولتك بالكامل حسب اهتماماتك ووقتك وميزانيتك."],
    ["Can you arrange honeymoon tours or special occasions?", "هل تنظمون رحلات شهر العسل أو المناسبات الخاصة؟", "Yes, romantic and celebration trips can be arranged.", "نعم، يمكن ترتيب رحلات رومانسية ورحلات للاحتفال بالمناسبات."],
    ["Can families with children join?", "هل يمكن للعائلات مع الأطفال المشاركة؟", "Yes, many of our tours are family-friendly.", "نعم، كثير من جولاتنا مناسبة للعائلات."],
    ["Are solo travelers welcome?", "هل المسافرون الفرديون مرحّب بهم؟", "Yes, solo travelers are always welcome.", "نعم، المسافرون الفرديون مرحّب بهم دائمًا."],
  ]),
  g("vehicles", "Vehicles & Transport", "المركبات والنقل", [
    ["What type of vehicles do you use?", "ما نوع المركبات التي تستخدمونها؟", "We use clean, modern, comfortable vehicles including 4WD SUVs, vans, and buses.", "نستخدم مركبات نظيفة وحديثة ومريحة، تشمل سيارات الدفع الرباعي والفانات والحافلات."],
    ["Are your vehicles air-conditioned?", "هل مركباتكم مكيّفة؟", "Yes, all our vehicles are fully air-conditioned.", "نعم، جميع مركباتنا مكيّفة بالكامل."],
    ["Do you offer airport transfers?", "هل تقدمون خدمة النقل من المطار وإليه؟", "Yes, we provide Muscat airport pick-up and drop-off services.", "نعم، نوفّر خدمة الاستقبال والتوصيل من مطار مسقط وإليه."],
    ["Can you provide transport across Oman?", "هل توفرون النقل بين مدن عُمان؟", "Yes, we offer transfers to destinations throughout Oman and UAE.", "نعم، نوفّر خدمات النقل إلى الوجهات في أنحاء عُمان والإمارات."],
    ["Do you provide child seats?", "هل توفرون مقاعد للأطفال؟", "Yes, child seats can be arranged on request.", "نعم، يمكن توفير مقاعد الأطفال عند الطلب."],
  ]),
  g("guides", "Guides & Service", "المرشدون والخدمة", [
    ["Are your guides friendly and professional?", "هل مرشدوكم ودودون ومحترفون؟", "Yes, our guides are known for being helpful, flexible, and knowledgeable.", "نعم، يُعرف مرشدونا بالمساعدة والمرونة والمعرفة الواسعة."],
    ["Do your guides speak English?", "هل يتحدث مرشدوكم الإنجليزية؟", "Yes, English-speaking guides are available.", "نعم، يتوفر لدينا مرشدون يتحدثون الإنجليزية."],
    ["Can I request a specific guide?", "هل يمكنني طلب مرشد بعينه؟", "Yes, subject to availability.", "نعم، حسب التوفر."],
    ["Will guides explain local culture and history?", "هل يشرح المرشدون الثقافة والتاريخ المحليين؟", "Yes, our guides enjoy sharing Oman's traditions, heritage, and local stories.", "نعم، يستمتع مرشدونا بمشاركة تقاليد عُمان وتراثها وحكاياتها المحلية."],
    ["Do you help guests during the whole trip?", "هل تساعدون الضيوف طوال الرحلة؟", "Yes, we support our guests before, during, and after the tour.", "نعم، نرافق ضيوفنا بالدعم قبل الجولة وأثناءها وبعدها."],
  ]),
  g("pricing", "Pricing & Value", "الأسعار والقيمة", [
    ["Are your prices reasonable?", "هل أسعاركم معقولة؟", "Yes, we offer competitive prices with high-quality service.", "نعم، نقدّم أسعارًا تنافسية مع خدمة عالية الجودة."],
    ["Are there hidden charges?", "هل هناك رسوم خفية؟", "No, pricing is clear and transparent.", "لا، أسعارنا واضحة وشفافة."],
    ["Are entrance fees included?", "هل رسوم الدخول مشمولة؟", "This depends on the selected package. We always explain inclusions before booking.", "يعتمد ذلك على الباقة المختارة، ونوضّح دائمًا ما يشمله السعر قبل الحجز."],
    ["Are meals included?", "هل الوجبات مشمولة؟", "Some tours include meals, snacks, or refreshments.", "بعض الجولات تشمل وجبات أو وجبات خفيفة أو مرطبات."],
    ["Do you offer group discounts?", "هل تقدمون خصومات للمجموعات؟", "Yes, discounts may be available for larger groups.", "نعم، قد تتوفر خصومات للمجموعات الكبيرة."],
  ]),
  g("travel", "Travel Information", "معلومات السفر", [
    ["Is Oman safe for tourists?", "هل عُمان آمنة للسياح؟", "Yes, Oman is one of the safest and most welcoming countries for travelers.", "نعم، عُمان من أكثر الدول أمانًا وترحيبًا بالمسافرين."],
    ["What is the best time to visit Oman?", "ما أفضل وقت لزيارة عُمان؟", "October to April is the most popular season due to pleasant weather.", "الفترة من أكتوبر إلى أبريل هي الموسم الأكثر شعبية بفضل الطقس اللطيف."],
    ["What should I wear during tours?", "ماذا أرتدي خلال الجولات؟", "Comfortable clothing, walking shoes, and modest dress for cultural sites are recommended.", "يُنصح بملابس مريحة، وأحذية مناسبة للمشي، ولباس محتشم عند زيارة المواقع الثقافية."],
    ["Should I bring cash?", "هل أحتاج إلى حمل نقود؟", "Yes, small amounts of cash are useful for personal purchases.", "نعم، من المفيد حمل مبالغ نقدية صغيرة للمشتريات الشخصية."],
    ["Is Oman Compass Tours suitable for elderly travelers?", "هل تناسب جولاتكم كبار السن؟", "Yes, we can arrange comfortable tours with lighter activities.", "نعم، يمكننا ترتيب جولات مريحة بأنشطة أخف."],
  ]),
  g("adventure", "Adventure & Nature", "المغامرة والطبيعة", [
    ["Can I swim during wadi tours?", "هل يمكنني السباحة خلال جولات الأودية؟", "Yes, many wadi tours offer swimming opportunities.", "نعم، كثير من جولات الأودية تتيح فرصة السباحة."],
    ["Do you offer camping trips?", "هل تنظمون رحلات تخييم؟", "Yes, we organize camping in deserts, mountains, and scenic areas.", "نعم، ننظّم التخييم في الصحاري والجبال والمناطق ذات المناظر الخلابة."],
    ["Do you provide camping equipment?", "هل توفرون معدات التخييم؟", "Yes, camping gear can be arranged.", "نعم، يمكن توفير معدات التخييم."],
    ["Can I go snorkeling or dolphin watching?", "هل يمكنني الغطس السطحي أو مشاهدة الدلافين؟", "Yes, we can arrange sea activities and boat tours.", "نعم، يمكننا ترتيب الأنشطة البحرية ورحلات القوارب."],
    ["Can I see turtles in Oman?", "هل يمكنني مشاهدة السلاحف في عُمان؟", "Yes, seasonal turtle watching tours can be arranged.", "نعم، يمكن ترتيب رحلات موسمية لمشاهدة السلاحف."],
  ]),
  g("policies", "Policies & Flexibility", "السياسات والمرونة", [
    ["What is your cancellation policy?", "ما سياسة الإلغاء لديكم؟", "Cancellation policies depend on the booking type and timing.", "تعتمد سياسة الإلغاء على نوع الحجز وتوقيته."],
    ["Can I change my booking date?", "هل يمكنني تغيير تاريخ الحجز؟", "Yes, changes are possible depending on availability.", "نعم، التغيير ممكن حسب التوفر."],
    ["What happens if weather affects the tour?", "ماذا يحدث إذا أثّر الطقس على الجولة؟", "We may reschedule or offer a suitable alternative for safety reasons.", "قد نعيد جدولة الجولة أو نقدّم بديلًا مناسبًا حرصًا على السلامة."],
    ["Are tours available every day?", "هل الجولات متاحة كل يوم؟", "Most tours are available daily.", "معظم الجولات متاحة يوميًا."],
    ["How can I contact Oman Compass Tours quickly?", "كيف أتواصل مع بوصلة عُمان للسياحة بسرعة؟", "You can contact us anytime through WhatsApp, email, phone, or social media.", "يمكنك التواصل معنا في أي وقت عبر واتساب أو البريد الإلكتروني أو الهاتف أو وسائل التواصل الاجتماعي."],
    ["Why should I choose Oman Compass Tours?", "لماذا أختار بوصلة عُمان للسياحة؟", "Because we combine local expertise, personalized care, flexible itineraries, and memorable authentic experiences.", "لأننا نجمع بين الخبرة المحلية، والعناية الشخصية، والبرامج المرنة، والتجارب الأصيلة التي لا تُنسى."],
    ["Do you arrange corporate or business trips?", "هل تنظمون رحلات للشركات؟", "Yes, we provide transport and custom travel services for companies.", "نعم، نوفّر خدمات النقل والرحلات المخصّصة للشركات."],
    ["Can photographers join your tours?", "هل يمكن للمصورين الانضمام إلى جولاتكم؟", "Absolutely, Oman is a paradise for photographers.", "بالتأكيد، فعُمان جنّة للمصورين."],
  ]),
];

/** Plain-text digest for the AI concierge's knowledge base. */
export function faqAsText(locale: "en" | "ar"): string {
  return FAQ.map((group) => `## ${group.title[locale]}\n${group.items.map((i) => `Q: ${i.q[locale]}\nA: ${i.a[locale]}`).join("\n")}`).join("\n\n");
}
