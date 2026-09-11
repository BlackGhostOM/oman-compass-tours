import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * In development the JSON is read from disk on every request so message edits
 * show up without restarting the dev server (dynamic imports are cached by the
 * bundler). Production keeps the bundled import.
 */
async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  if (process.env.NODE_ENV === "development") {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return JSON.parse(await readFile(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
  }
  return (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
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
