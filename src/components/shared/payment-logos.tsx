import { cn } from "@/lib/utils";

/** Text-safe payment badges (no external assets → CSP-friendly, crisp in RTL). */
const methods = [
  { key: "visa", label: "VISA", style: "italic font-black tracking-tight" },
  { key: "mastercard", label: "Mastercard", style: "font-semibold" },
  { key: "amex", label: "AMEX", style: "font-bold tracking-wide" },
  { key: "applepay", label: " Pay", style: "font-semibold" },
  { key: "googlepay", label: "G Pay", style: "font-semibold" },
  { key: "paypal", label: "PayPal", style: "font-bold italic" },
  { key: "thawani", label: "Thawani", style: "font-semibold" },
  { key: "omannet", label: "OmanNet", style: "font-semibold" },
] as const;

export function PaymentLogos({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Accepted payment methods">
      {methods.map((m) => (
        <li
          key={m.key}
          className={cn(
            "rounded-md border border-navy-800 bg-navy-900 px-2.5 py-1 text-[11px] leading-none text-sand-100/85",
            m.style,
          )}
          dir="ltr"
        >
          {m.label}
        </li>
      ))}
    </ul>
  );
}
