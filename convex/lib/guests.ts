/**
 * The party as one line for emails, the PDF voucher and the calendar file ("بالغان · 3 أطفال" / "2 adults · 3 children").
 * Pure (no Convex imports), so Next route handlers can import it too.
 */

/** Arabic and English count phrases, by plural category (the same forms as messages/ar.json common.adults and friends). */
const GUEST_FORMS: Record<"en" | "ar", Record<"adults" | "children" | "infants", Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }>> = {
  ar: {
    adults: { one: "بالغ واحد", two: "بالغان", few: "# بالغين", many: "# بالغًا", other: "# بالغ" },
    children: { one: "طفل واحد", two: "طفلان", few: "# أطفال", many: "# طفلًا", other: "# طفل" },
    infants: { one: "رضيع واحد", two: "رضيعان", few: "# رضّع", many: "# رضيعًا", other: "# رضيع" },
  },
  en: {
    adults: { one: "# adult", other: "# adults" },
    children: { one: "# child", other: "# children" },
    infants: { one: "# infant", other: "# infants" },
  },
};

/** "بالغان · 3 أطفال" / "2 adults · 3 children": correct plural forms, zero counts left out. */
export function guestsLine(b: { adults: number; children: number; infants: number }, locale: string): string {
  const rules = new Intl.PluralRules(locale === "ar" ? "ar" : "en");
  const forms = GUEST_FORMS[locale === "ar" ? "ar" : "en"];
  return (["adults", "children", "infants"] as const)
    .filter((k) => b[k] > 0)
    .map((k) => (forms[k][rules.select(b[k])] ?? forms[k].other).replace("#", String(b[k])))
    .join(" · ");
}
