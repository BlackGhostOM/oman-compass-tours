"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { countries } from "@/lib/countries";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * International phone input: country dial code (default +968) + national number.
 * `value` / `onChange` use E.164 (`+96892255028`) or "" when incomplete.
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
  const parsed = useMemo(() => (value ? parsePhoneNumberFromString(value) : undefined), [value]);
  const country = parsed?.country ?? defaultCountry;
  const national = parsed?.nationalNumber ?? "";

  function emit(nextCountry: string, nextNational: string) {
    const dial = countries.find((c) => c.code === nextCountry)?.dial ?? "968";
    const digits = nextNational.replace(/[^0-9]/g, "");
    if (!digits) return onChange("", { country: nextCountry, national: "", valid: false });
    const candidate = parsePhoneNumberFromString(`+${dial}${digits}`);
    const valid = !!candidate?.isValid();
    onChange(candidate ? candidate.number : `+${dial}${digits}`, { country: nextCountry, national: digits, valid });
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
