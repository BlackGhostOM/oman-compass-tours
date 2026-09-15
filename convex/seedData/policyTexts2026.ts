/**
 * Official policy wording supplied by Oman Compass Tours (September 2026).
 * Used by the seed for fresh deployments and by `migrations.publishSeededPolicies`
 * to publish a new version on existing deployments.
 */
export const POLICY_TEXTS: Record<"payment" | "cancellation" | "refund" | "waiver", { en: string; ar: string }> = {
  payment: {
    en: `## Multi-day tour packages (including overnight stay)
Bookings for tour packages that include one or more overnight stays require an advance **35% deposit** of the total package price. Guests may also choose to pay the full amount (100%) at the time of booking if preferred.

## Remaining balance for multi-day tours
Any outstanding balance for tour packages lasting more than one day must be settled **at the start of the trip** directly with the company's assigned tour guide, either in cash or by card, subject to guest preference.

## Day tours and self-drive car rentals
Bookings for daily tours or self-drive car rentals require an advance **35% deposit** of the total booking value. Guests may also choose to pay the full amount (100%) in advance if preferred.

## Remaining balance for day tours and self-drive car rentals
Any outstanding balance must be settled at the start of the trip directly with the company's assigned tour guide, either in cash or by card, subject to guest preference.

## Payment methods
Payments can be made through the company's official website [www.omancompasstours.com](https://www.omancompasstours.com), by direct transfer to the company's business bank account, or via approved online payment gateways through secure payment links. Please note that some payment gateways may apply a small additional processing fee. Guests may contact the Oman Compass Tours team for customized payment arrangements or further assistance.`,
    ar: `## باقات الجولات متعددة الأيام (شاملة المبيت)
تتطلب حجوزات الباقات السياحية التي تشمل ليلة مبيت أو أكثر دفع **عربون مقدم بنسبة 35%** من إجمالي سعر الباقة. ويمكن للضيوف إن رغبوا دفع المبلغ كاملًا (100%) عند الحجز.

## المبلغ المتبقي للجولات متعددة الأيام
يُسدَّد أي مبلغ متبقٍ للباقات التي تزيد مدتها عن يوم واحد **عند بداية الرحلة** مباشرة إلى المرشد السياحي المكلَّف من الشركة، نقدًا أو بالبطاقة، حسب رغبة الضيف.

## الجولات اليومية وتأجير السيارات بدون سائق
تتطلب حجوزات الجولات اليومية أو تأجير السيارات بدون سائق دفع **عربون مقدم بنسبة 35%** من إجمالي قيمة الحجز. ويمكن للضيوف إن رغبوا دفع المبلغ كاملًا (100%) مسبقًا.

## المبلغ المتبقي للجولات اليومية وتأجير السيارات
يُسدَّد أي مبلغ متبقٍ عند بداية الرحلة مباشرة إلى المرشد السياحي المكلَّف من الشركة، نقدًا أو بالبطاقة، حسب رغبة الضيف.

## طرق الدفع
يمكن الدفع عبر الموقع الرسمي للشركة [www.omancompasstours.com](https://www.omancompasstours.com)، أو بالتحويل المباشر إلى الحساب البنكي التجاري للشركة، أو عبر بوابات الدفع الإلكتروني المعتمدة من خلال روابط دفع آمنة. يُرجى العلم بأن بعض بوابات الدفع قد تفرض رسوم معالجة إضافية بسيطة. ويمكن للضيوف التواصل مع فريق بوصلة عُمان للسياحة لترتيبات دفع مخصصة أو لأي مساعدة إضافية.`,
  },
  cancellation: {
    en: `## Multi-day tours and 4WD rentals
**Free cancellation, 30 days or more before arrival.** Cancellations made 30 days or more before the scheduled arrival/travel date are eligible for a 100% refund of the deposit paid.

**Cancellation within 29 days of arrival.** Cancellations made 29 days or less before the scheduled arrival/travel date are non-refundable, and the full amount paid will be retained.

## Day trips
**Free cancellation, 72 hours or more before the tour.** Cancellations made 72 hours or more before the scheduled tour date are eligible for a 100% refund of the deposit paid.

**Cancellation within 72 hours of the tour.** Cancellations made less than 72 hours before the scheduled tour date are non-refundable, and the full amount paid will be retained.

## B2B and corporate group bookings
For group bookings, travel agencies, or corporate partners working with the company on a B2B basis, separate agreements may apply. Cancellation terms and conditions will be outlined individually by the Oman Compass Tours team.

## How to cancel
Cancel from **My Account → My Bookings**, or contact us on WhatsApp +968 9225 5028 or omancompasstours@gmail.com quoting your booking reference. The time we receive your request (Oman time) determines which window applies.

## Refund processing time
Approved refunds may take up to 2–48 days to be processed and reflected to the customer, depending on the payment provider or banking institution.`,
    ar: `## الجولات متعددة الأيام وتأجير سيارات الدفع الرباعي
**إلغاء مجاني قبل 30 يومًا أو أكثر من الوصول.** الإلغاءات التي تتم قبل 30 يومًا أو أكثر من تاريخ الوصول/السفر المحدد تستحق استرداد 100% من العربون المدفوع.

**الإلغاء خلال 29 يومًا من الوصول.** الإلغاءات التي تتم قبل 29 يومًا أو أقل من تاريخ الوصول/السفر المحدد غير قابلة للاسترداد، ويُحتفظ بكامل المبلغ المدفوع.

## الرحلات اليومية
**إلغاء مجاني قبل 72 ساعة أو أكثر من الجولة.** الإلغاءات التي تتم قبل 72 ساعة أو أكثر من تاريخ الجولة المحدد تستحق استرداد 100% من العربون المدفوع.

**الإلغاء خلال 72 ساعة من الجولة.** الإلغاءات التي تتم قبل أقل من 72 ساعة من تاريخ الجولة المحدد غير قابلة للاسترداد، ويُحتفظ بكامل المبلغ المدفوع.

## حجوزات المجموعات والشركات (B2B)
بالنسبة لحجوزات المجموعات أو وكالات السفر أو الشركاء من الشركات الذين يتعاملون مع الشركة على أساس B2B، قد تُطبَّق اتفاقيات منفصلة، ويحدد فريق بوصلة عُمان للسياحة شروط وأحكام الإلغاء لكل حالة على حدة.

## كيفية الإلغاء
يمكنك الإلغاء من **حسابي ← حجوزاتي**، أو التواصل معنا عبر واتساب +968 9225 5028 أو البريد omancompasstours@gmail.com مع ذكر رقم الحجز. ويُحدَّد النطاق الزمني المطبَّق بوقت استلامنا للطلب (بتوقيت عُمان).

## مدة معالجة الاسترداد
قد تستغرق عمليات الاسترداد المعتمدة ما يصل إلى 2–48 يومًا حتى تُعالَج وتظهر لدى العميل، بحسب مزوّد خدمة الدفع أو المؤسسة المصرفية.`,
  },
  refund: {
    en: `## When a refund applies
Refunds follow the Booking & Cancellation Policy: the deposit is refunded in full when a multi-day tour or 4WD rental is cancelled 30 days or more before arrival, or when a day trip is cancelled 72 hours or more before the tour date. Cancellations inside those windows are non-refundable.

## How refunds are paid
Refunds are returned to the original payment method whenever possible. Deposits paid by bank transfer are refunded by transfer to the account you nominate. Any processing fee charged by a payment gateway is outside our control and may not be recoverable.

## Processing time
Approved refunds may take up to 2–48 days to be processed and reflected to the customer, depending on the payment provider or banking institution.

## Changes by Oman Compass Tours
If we have to cancel a tour for safety, weather or operational reasons, you may choose a new date, an alternative tour of equal value, or a full refund of everything you have paid.`,
    ar: `## متى يُطبَّق الاسترداد
يخضع الاسترداد لسياسة الحجز والإلغاء: يُسترد العربون كاملًا عند إلغاء جولة متعددة الأيام أو تأجير سيارة دفع رباعي قبل 30 يومًا أو أكثر من الوصول، أو عند إلغاء رحلة يومية قبل 72 ساعة أو أكثر من تاريخ الجولة. أما الإلغاءات داخل هذه النطاقات فغير قابلة للاسترداد.

## كيفية دفع المبالغ المستردة
تُعاد المبالغ إلى وسيلة الدفع الأصلية كلما أمكن ذلك. والعربون المدفوع بالتحويل البنكي يُعاد بالتحويل إلى الحساب الذي تحدده. وأي رسوم معالجة تفرضها بوابة الدفع خارجة عن سيطرتنا وقد لا تكون قابلة للاسترداد.

## مدة المعالجة
قد تستغرق عمليات الاسترداد المعتمدة ما يصل إلى 2–48 يومًا حتى تُعالَج وتظهر لدى العميل، بحسب مزوّد خدمة الدفع أو المؤسسة المصرفية.

## التغييرات من جانب بوصلة عُمان للسياحة
إذا اضطررنا لإلغاء جولة لأسباب تتعلق بالسلامة أو الطقس أو التشغيل، يمكنك اختيار تاريخ جديد، أو جولة بديلة بالقيمة نفسها، أو استرداد كامل ما دفعته.`,
  },
  waiver: {
    en: `## Liability waiver
By booking or participating in any tour with Compass Tours SPC, guests acknowledge and accept the inherent risks associated with travel and outdoor activities. Participation is voluntary and at the guest's own risk.

Compass Tours SPC shall not be liable for any injury, illness, loss, damage, accident, drowning, death, or other claims arising from events beyond its reasonable control or from participation in any activity, to the fullest extent permitted by applicable law.

By confirming a booking, guests agree to these terms and release the Company from related liability claims.

## Your part in staying safe
Follow your guide's instructions at all times, disclose any medical condition that could affect your participation before the tour starts, wear suitable footwear and clothing for the activity, and drink plenty of water. Guides may modify or stop an activity when conditions are unsafe.`,
    ar: `## إخلاء المسؤولية
بحجز أي جولة مع شركة Compass Tours SPC أو المشاركة فيها، يقرّ الضيوف بالمخاطر الملازمة للسفر والأنشطة الخارجية ويقبلونها. والمشاركة طوعية وعلى مسؤولية الضيف الشخصية.

لا تتحمل Compass Tours SPC أي مسؤولية عن أي إصابة أو مرض أو خسارة أو ضرر أو حادث أو غرق أو وفاة أو أي مطالبات أخرى تنشأ عن أحداث خارجة عن سيطرتها المعقولة أو عن المشاركة في أي نشاط، وذلك إلى أقصى حد يسمح به القانون المعمول به.

وبتأكيد الحجز، يوافق الضيوف على هذه الشروط ويعفون الشركة من مطالبات المسؤولية المتعلقة بها.

## دورك في الحفاظ على سلامتك
اتبع تعليمات المرشد في جميع الأوقات، وأفصح عن أي حالة صحية قد تؤثر في مشاركتك قبل بدء الجولة، وارتدِ أحذية وملابس مناسبة للنشاط، واشرب كمية كافية من الماء. ويحق للمرشد تعديل أي نشاط أو إيقافه إذا كانت الظروف غير آمنة.`,
  },
};
