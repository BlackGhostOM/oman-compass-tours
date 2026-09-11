"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "@/components/booking/types";

export function WizardProgress({ step, onJump }: { step: number; onJump?: (s: 1 | 2 | 3 | 4) => void }) {
  const t = useTranslations("booking.steps");
  const total = STEPS.length + 1; // + confirmation
  return (
    <nav aria-label={t("label")} className="w-full">
      <ol className="flex items-center gap-2">
        {STEPS.map((key, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!done || !onJump}
                onClick={() => onJump?.(n as 1 | 2 | 3 | 4)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 text-start text-xs sm:text-sm",
                  done ? "text-navy-950" : current ? "text-navy-950" : "text-ink-300",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-heading text-xs",
                    done && "border-gold-500 bg-gold-gradient text-navy-950",
                    current && "border-gold-500 bg-white text-navy-950 ring-2 ring-gold-500/30",
                    !done && !current && "border-sand-200 bg-white",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : n}
                </span>
                <span className={cn("hidden sm:inline", current && "font-medium")}>{t(key)}</span>
              </button>
              {n < STEPS.length && <span className={cn("h-px flex-1", done ? "bg-gold-500" : "bg-sand-200")} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-sand-200" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <div className="h-full bg-gold-gradient transition-all" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </nav>
  );
}
