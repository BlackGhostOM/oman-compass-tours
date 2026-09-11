"use client";

import { useLocale } from "next-intl";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CompassPoint } from "@/components/brand/compass-rose";
import { pick, type LocalizedString } from "@/lib/content";

export type ItineraryDay = { time?: string; title: LocalizedString; body: LocalizedString };

export function ItineraryAccordion({ items }: { items: ItineraryDay[] }) {
  const locale = useLocale();
  const points = ["N", "E", "S", "W"] as const;
  return (
    <Accordion type="multiple" defaultValue={items.slice(0, 2).map((_, i) => `item-${i}`)} className="w-full">
      {items.map((it, i) => (
        <AccordionItem key={i} value={`item-${i}`} className="border-sand-200">
          <AccordionTrigger className="py-4 text-start hover:no-underline">
            <span className="flex items-center gap-3">
              <CompassPoint point={points[i % 4]} className="size-4" />
              {it.time && (
                <span className="min-w-14 font-heading text-xs tracking-wide text-gold-700" dir="ltr">
                  {it.time}
                </span>
              )}
              <span className="font-medium text-ink-900">{pick(it.title, locale)}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="ps-11 text-ink-500">{pick(it.body, locale)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
