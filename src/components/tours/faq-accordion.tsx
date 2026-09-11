"use client";

import { useLocale } from "next-intl";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { pick, type LocalizedString } from "@/lib/content";

export function FaqAccordion({ items }: { items: { question: LocalizedString; answer: LocalizedString }[] }) {
  const locale = useLocale();
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((f, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border-sand-200">
          <AccordionTrigger className="py-4 text-start font-medium text-ink-900 hover:no-underline">
            {pick(f.question, locale)}
          </AccordionTrigger>
          <AccordionContent className="text-ink-500">{pick(f.answer, locale)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
