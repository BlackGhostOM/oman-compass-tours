type L = { en: string; ar: string };

export type BlogSeed = {
  title: L;
  slug: L;
  excerpt: L;
  body: L;
  category: string;
  tags: string[];
  authorName: string;
  readingMinutes: number;
  image: string;
  publishedDaysAgo: number;
};

export const blogSeed: BlogSeed[] = [
  {
    title: { en: "When is the best time to visit Oman?", ar: "ما هو أفضل وقت لزيارة عُمان؟" },
    slug: { en: "best-time-to-visit-oman", ar: "افضل-وقت-لزيارة-عمان" },
    excerpt: {
      en: "October to April brings warm days and cool nights across most of the country — and Salalah flips the script every summer.",
      ar: "من أكتوبر إلى أبريل تكون الأيام دافئة والليالي معتدلة في معظم أنحاء البلاد، بينما تقلب صلالة المعادلة كل صيف.",
    },
    body: {
      en: `## The short answer
**October to April** is peak season: daytime temperatures of 25–32 °C in Muscat, pleasant evenings in the desert and crisp mornings on Jabal Akhdar.

## Month by month
- **October–November:** the sea is still warm for snorkelling; turtle nesting at Ras Al Jinz continues.
- **December–February:** the coolest months. Perfect for hiking Wadi Shab and Jebel Shams; pack a jacket for desert nights.
- **March–April:** the damask roses bloom on Jabal Akhdar and the wadis are at their fullest.
- **May–September:** hot on the coast, but Salalah's **Khareef** monsoon (mid-June to early September) turns Dhofar green and misty. Mountain resorts on Jabal Akhdar are 10–15 °C cooler than Muscat.

## Ramadan and Eid
Tours run as normal during Ramadan; restaurants open after sunset and the evening atmosphere in the souqs is wonderful. Eid holidays are busy — book early.`,
      ar: `## الجواب المختصر
**من أكتوبر إلى أبريل** هو موسم الذروة: درجات الحرارة نهارًا بين 25 و32 درجة مئوية في مسقط، وأمسيات لطيفة في الصحراء، وصباحات منعشة في الجبل الأخضر.

## شهرًا بشهر
- **أكتوبر–نوفمبر:** لا يزال البحر دافئًا للغطس؛ ويستمر تعشيش السلاحف في رأس الجنز.
- **ديسمبر–فبراير:** أبرد الشهور. مثالية للمشي في وادي شاب وجبل شمس؛ أحضر سترة لليالي الصحراء.
- **مارس–أبريل:** يتفتح الورد الدمشقي في الجبل الأخضر وتكون الأودية في أوج امتلائها.
- **مايو–سبتمبر:** حار على الساحل، لكن **خريف** صلالة (من منتصف يونيو إلى أوائل سبتمبر) يحوّل ظفار إلى خضرة وضباب. ومنتجعات الجبل الأخضر أبرد من مسقط بعشر إلى خمس عشرة درجة.

## رمضان والعيد
تعمل الجولات كالمعتاد خلال رمضان؛ وتفتح المطاعم بعد الغروب وتكون أجواء الأسواق مساءً رائعة. أما إجازات العيد فمزدحمة؛ فاحجز مبكرًا.`,
    },
    category: "planning",
    tags: ["seasons", "weather", "salalah", "khareef"],
    authorName: "Oman Compass Tours",
    readingMinutes: 4,
    image: "salalah",
    publishedDaysAgo: 12,
  },
  {
    title: { en: "Wadi Shab: what to pack and how to get to the cave", ar: "وادي شاب: ماذا تحمل وكيف تصل إلى الكهف" },
    slug: { en: "wadi-shab-guide", ar: "دليل-وادي-شاب" },
    excerpt: {
      en: "Water shoes, a dry bag and a little courage: everything you need for Oman's most photographed wadi.",
      ar: "أحذية مائية وحقيبة مقاومة للماء وقليل من الشجاعة: كل ما تحتاجه لأكثر أودية عُمان تصويرًا.",
    },
    body: {
      en: `## Getting there
Wadi Shab is 140 km south-east of Muscat on the coastal highway (about 1 h 30). A small boat (OMR 1 per person, included in our tour) ferries you across the lagoon at the entrance.

## The walk
Allow 40–50 minutes each way. The path is rocky and partly shaded; there are two short scrambles where hands help. Children from about six years old manage it well.

## The swim
Three pools lead to a narrow gap in the rock. Swim through, and you emerge in a cave with a waterfall — bring a waterproof phone case for the photo of the trip. Life jackets are available at the boat.

## Pack list
- Water shoes or sandals with straps
- Swimwear under light clothes
- Dry bag, towel, sunscreen, hat
- At least 1.5 litres of water per person (we provide it on our tour)

## Etiquette
Wadi Shab is a village water source. Change discreetly, take your rubbish and avoid soap in the pools.`,
      ar: `## الوصول
يقع وادي شاب على بعد 140 كيلومترًا جنوب شرق مسقط على الطريق الساحلي (نحو ساعة ونصف). ويعبر بك قارب صغير (ريال عُماني للشخص، مشمول في جولتنا) البحيرة عند المدخل.

## المسار
خصّص 40–50 دقيقة لكل اتجاه. المسار صخري ومظلل جزئيًا؛ وفيه مقطعان قصيران يحتاجان إلى الاستعانة باليدين. ويجتازه الأطفال من سن السادسة تقريبًا بسهولة.

## السباحة
تقود ثلاث برك إلى فتحة ضيقة في الصخر. اسبح عبرها لتخرج في كهف بداخله شلال؛ أحضر غطاءً مقاومًا للماء للهاتف لالتقاط صورة الرحلة. وتتوفر سترات النجاة عند القارب.

## قائمة الحاجيات
- أحذية مائية أو صنادل بأحزمة
- ملابس سباحة تحت ملابس خفيفة
- حقيبة مقاومة للماء، منشفة، واقي شمس، قبعة
- لتر ونصف من الماء على الأقل لكل شخص (نوفره في جولتنا)

## آداب المكان
وادي شاب مصدر مياه للقرية. بدّل ملابسك بتحفظ، واحمل نفاياتك معك، وتجنب الصابون في البرك.`,
    },
    category: "guides",
    tags: ["wadi-shab", "packing", "swimming"],
    authorName: "Musab",
    readingMinutes: 3,
    image: "wadi-shab",
    publishedDaysAgo: 30,
  },
  {
    title: { en: "Omani coffee etiquette: the three-cup rule", ar: "آداب القهوة العُمانية: قاعدة الفناجين الثلاثة" },
    slug: { en: "omani-coffee-etiquette", ar: "آداب-القهوة-العمانية" },
    excerpt: {
      en: "Kahwa arrives with dates, is poured from the right and is refused by shaking the cup. Here is how to be a gracious guest.",
      ar: "تأتي القهوة مع التمر، وتُصب من اليمين، ويُعلَن الاكتفاء بهزّ الفنجان. إليك كيف تكون ضيفًا لبقًا.",
    },
    body: {
      en: `Omani kahwa is light, cardamom-scented and served in small handle-less cups. When you visit a family home — or our office — expect the following:

1. **Dates first.** A sweet bite before the bitter coffee.
2. **Receive with the right hand.** The host pours a small amount; drink it and hold the cup out for more.
3. **Three cups is polite.** Accepting fewer can seem hurried; more is welcome.
4. **Shake to stop.** A gentle side-to-side shake of the empty cup tells the host you have had enough — no words needed.
5. **Halwa** often follows: a sticky, saffron-and-rosewater sweet eaten with a small spoon.

Join our Traditional Dinner with an Omani Family to experience the ritual in a real majlis.`,
      ar: `القهوة العُمانية خفيفة معطّرة بالهيل وتُقدَّم في فناجين صغيرة بلا مقبض. عند زيارة بيت عائلة، أو مكتبنا، توقّع ما يلي:

1. **التمر أولًا.** لقمة حلوة قبل القهوة المرّة.
2. **الاستلام باليد اليمنى.** يصب المضيف كمية صغيرة؛ اشربها ومدّ الفنجان للمزيد.
3. **ثلاثة فناجين من اللباقة.** قبول أقل قد يبدو استعجالًا؛ والمزيد مرحّب به.
4. **هزّ الفنجان للتوقف.** هزّة خفيفة للفنجان الفارغ تخبر المضيف بأنك اكتفيت، دون كلمات.
5. **الحلوى** تأتي غالبًا بعد ذلك: حلوى لزجة بالزعفران وماء الورد تؤكل بملعقة صغيرة.

انضم إلى تجربة العشاء التقليدي مع عائلة عُمانية لتعيش هذه الطقوس في مجلس حقيقي.`,
    },
    category: "culture",
    tags: ["culture", "food", "etiquette"],
    authorName: "Oman Compass Tours",
    readingMinutes: 2,
    image: "dinner",
    publishedDaysAgo: 45,
  },
];
