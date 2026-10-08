/**
 * The party as one line for emails, the PDF voucher and the calendar file ("بالغان · 3 أطفال" / "2 adults · 3 children").
 * Pure (no Convex imports), so Next route handlers can import it too.
 */

type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Arabic and English count phrases, by plural category (the same forms as messages/ar.json common.adults and friends). */
const GUEST_FORMS: Record<"en" | "ar", Record<"adults" | "children" | "infants", Forms>> = {
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

const ROOM_FORMS: Record<"en" | "ar", Record<"shared" | "single", Forms>> = {
  ar: {
    shared: { one: "غرفة مشتركة واحدة", two: "غرفتان مشتركتان", few: "# غرف مشتركة", many: "# غرفة مشتركة", other: "# غرفة مشتركة" },
    single: { one: "غرفة فردية واحدة", two: "غرفتان فرديتان", few: "# غرف فردية", many: "# غرفة فردية", other: "# غرفة فردية" },
  },
  en: {
    shared: { one: "# shared room", other: "# shared rooms" },
    single: { one: "# single room", other: "# single rooms" },
  },
};

function countLine<K extends string>(counts: Record<K, number>, keys: readonly K[], forms: Record<K, Forms>, locale: string): string {
  const rules = new Intl.PluralRules(locale === "ar" ? "ar" : "en");
  return keys
    .filter((k) => counts[k] > 0)
    .map((k) => (forms[k][rules.select(counts[k])] ?? forms[k].other).replace("#", String(counts[k])))
    .join(" · ");
}

/** "غرفة مشتركة واحدة · غرفتان فرديتان" / "1 shared room · 2 single rooms" (multi-day 4WD trips), zero counts left out. */
export function roomsLine(rooms: { shared: number; single: number }, locale: string): string {
  return countLine(rooms, ["shared", "single"] as const, ROOM_FORMS[locale === "ar" ? "ar" : "en"], locale);
}

/** "بالغان · 3 أطفال" / "2 adults · 3 children": correct plural forms, zero counts left out; a multi-day trip adds its rooms. */
export function guestsLine(b: { adults: number; children: number; infants: number; rooms?: { shared: number; single: number } | null }, locale: string): string {
  const people = countLine(b, ["adults", "children", "infants"] as const, GUEST_FORMS[locale === "ar" ? "ar" : "en"], locale);
  const rooms = b.rooms ? roomsLine(b.rooms, locale) : "";
  return rooms ? `${people} · ${rooms}` : people;
}
