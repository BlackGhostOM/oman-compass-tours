"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { countries } from "@/lib/countries";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits become ASCII so any keyboard works. */
function toAsciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

function dialFor(country: string): string {
  return countries.find((c) => c.code === country)?.dial ?? "968";
}

/** Splits an E.164 value into country + national digits, tolerating incomplete numbers. */
function split(value: string, fallbackCountry: string): { country: string; national: string } {
  if (!value) return { country: fallbackCountry, national: "" };
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  const match = countries
    .filter((c) => value.startsWith(`+${c.dial}`))
    .sort((a, b) => b.dial.length - a.dial.length)[0];
  if (match) return { country: match.code, national: value.slice(match.dial.length + 1) };
  return { country: fallbackCountry, national: value.replace(/[^0-9]/g, "") };
}

/**
 * International phone input: country dial code (default +968) + national number.
 * `value` / `onChange` use E.164 (`+96892255028`); incomplete numbers are still
 * emitted so the parent can keep them, and `meta.valid` says whether they are complete.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  className,
  invalid,
  defaultCountry = "OM",
}: {
  value: string;
  onChange: (e164: string, meta: { country: string; national: string; valid: boolean }) => void;
  id?: string;
  className?: string;
  invalid?: boolean;
  defaultCountry?: string;
}) {
  const locale = useLocale();
  const initial = split(value, defaultCountry);
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);
  const lastEmitted = useRef(value);

  // Follow external changes (e.g. a restored draft) without fighting what the user is typing.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const next = split(value, defaultCountry);
    setCountry(next.country);
    setNational(next.national);
    lastEmitted.current = value;
  }, [value, defaultCountry]);

  function emit(nextCountry: string, nextNational: string) {
    const digits = toAsciiDigits(nextNational).replace(/[^0-9]/g, "").slice(0, 15);
    setCountry(nextCountry);
    setNational(digits);
    const dial = dialFor(nextCountry);
    const e164 = digits ? `+${dial}${digits}` : "";
    const candidate = digits ? parsePhoneNumberFromString(e164) : undefined;
    const out = candidate?.isValid() ? candidate.number : e164;
    lastEmitted.current = out;
    onChange(out, { country: nextCountry, national: digits, valid: !!candidate?.isValid() });
  }

  return (
    <div className={cn("flex gap-2", className)} dir="ltr">
      <Select value={country} onValueChange={(c) => emit(c, national)}>
        <SelectTrigger className="w-32 shrink-0" aria-label="Country code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {countries.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="me-1">{String.fromCodePoint(...[...c.code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)))}</span>
              +{c.dial} <span className="text-muted-foreground">{locale === "ar" ? c.ar : c.en}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={(e) => emit(country, e.target.value)}
        placeholder="9225 5028"
        aria-invalid={invalid || undefined}
        className="flex-1"
      />
    </div>
  );
}
