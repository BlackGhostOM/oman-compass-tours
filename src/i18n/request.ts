import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Muscat",
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit" },
      },
      number: {
        omr: { style: "currency", currency: "OMR", minimumFractionDigits: 3 },
        usd: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
      },
    },
  };
});
