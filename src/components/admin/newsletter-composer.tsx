"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Image as ImageIcon, LayoutGrid, Minus, MousePointerClick, Star, Trash2, Type } from "lucide-react";
import type { NewsletterBlock } from "../../../convex/lib/newsletterEmail";
import type { LocalizedString } from "@/lib/content";
import { pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalizedField } from "@/components/admin/ui";
import { MediaUrlField } from "@/components/admin/media-url-field";
import { cn } from "@/lib/utils";

export type TourOption = { code: string; title: LocalizedString; durationLabel: LocalizedString; kind: string };
export type Block = NewsletterBlock;

const L = (): LocalizedString => ({ en: "", ar: "" });
const NONE = "__none__";

/** Returns `value` after it has stopped changing for `ms` (keeps the live preview from re-rendering on every keystroke). */
export function useDebounced<T>(value: T, ms = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function TourSelect({ value, onChange, options, locale, allowNone = false, className }: { value: string; onChange: (code: string) => void; options: TourOption[]; locale: string; allowNone?: boolean; className?: string }) {
  const t = useTranslations("admin.content.newsletter");
  return (
    <Select value={value || (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className={cn("w-full", className)}><SelectValue placeholder={t("chooseTour")} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{t("noTour")}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>
            <span className="font-mono text-xs text-muted-foreground">{o.code}</span> · {pick(o.title, locale)} · {pick(o.durationLabel, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const BLOCK_ICON: Record<Block["type"], React.ComponentType<{ className?: string }>> = { text: Type, image: ImageIcon, tour: Star, tours: LayoutGrid, button: MousePointerClick, divider: Minus };

function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "text": return { type, body: L() };
    case "image": return { type, url: "", alt: L() };
    case "tour": return { type, code: "" };
    case "tours": return { type, codes: [] };
    case "button": return { type, label: L(), url: "" };
    case "divider": return { type };
  }
}

/** Ordered content blocks of a campaign: add, edit, reorder, remove. */
export function BlockEditor({ blocks, onChange, tours, locale }: { blocks: Block[]; onChange: (b: Block[]) => void; tours: TourOption[]; locale: string }) {
  const t = useTranslations("admin.content.newsletter");
  const update = (i: number, b: Block) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const types: Block["type"][] = ["text", "image", "tour", "tours", "button", "divider"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("blocks")}</Label>
      </div>
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("noBlocks")}</p>}
      {blocks.map((b, i) => {
        const Icon = BLOCK_ICON[b.type];
        return (
          <div key={i} className="rounded-lg border border-border bg-card p-3" data-testid={`block-${b.type}`}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="size-4 text-gold-600" />
              <span className="text-sm font-medium">{t(`block.${b.type}`)}</span>
              <span className="ms-auto flex items-center gap-1">
                <Button size="icon-xs" variant="ghost" aria-label={t("moveUp")} title={t("moveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></Button>
                <Button size="icon-xs" variant="ghost" aria-label={t("moveDown")} title={t("moveDown")} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></Button>
                <Button size="icon-xs" variant="ghost" className="text-danger" aria-label={t("removeBlock")} title={t("removeBlock")} onClick={() => remove(i)}><Trash2 className="size-3.5" /></Button>
              </span>
            </div>
            {b.type === "text" && (
              <div className="space-y-1">
                <LocalizedField label={t("body")} value={b.body} onChange={(body) => update(i, { ...b, body })} multiline rows={6} />
                <p className="text-xs text-muted-foreground">{t("bodyHint")}</p>
              </div>
            )}
            {b.type === "image" && (
              <div className="space-y-3">
                <MediaUrlField label={t("block.image")} kind="image" value={b.url} onChange={(url) => update(i, { ...b, url })} placeholder={t("imageUpload")} />
                <LocalizedField label={t("imageAlt")} value={b.alt} onChange={(alt) => update(i, { ...b, alt })} />
                <div className="space-y-1.5"><Label>{t("imageLink")}</Label><Input dir="ltr" value={b.link ?? ""} onChange={(e) => update(i, { ...b, link: e.target.value || undefined })} placeholder="https://" /></div>
              </div>
            )}
            {b.type === "tour" && (
              <div className="space-y-1.5"><Label>{t("heroTour")}</Label><TourSelect value={b.code} onChange={(code) => update(i, { ...b, code })} options={tours} locale={locale} /></div>
            )}
            {b.type === "tours" && (
              <div className="grid gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((slot) => (
                  <TourSelect key={slot} value={b.codes[slot] ?? ""} allowNone options={tours} locale={locale} onChange={(code) => { const codes = [...b.codes]; codes[slot] = code; update(i, { ...b, codes: codes.filter(Boolean) }); }} />
                ))}
              </div>
            )}
            {b.type === "button" && (
              <div className="space-y-3">
                <LocalizedField label={t("buttonLabel")} value={b.label} onChange={(label) => update(i, { ...b, label })} />
                <div className="space-y-1.5"><Label>{t("buttonUrl")}</Label><Input dir="ltr" value={b.url} onChange={(e) => update(i, { ...b, url: e.target.value })} placeholder="https://www.omancompasstours.com/…" /></div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("addBlock")}:</span>
        {types.map((type) => {
          const Icon = BLOCK_ICON[type];
          return <Button key={type} size="xs" variant="outline" onClick={() => onChange([...blocks, newBlock(type)])}><Icon className="size-3.5" /> {t(`block.${type}`)}</Button>;
        })}
      </div>
    </div>
  );
}

/** Renders the email HTML exactly as it will arrive, with a language switch. */
export function EmailPreview({ html, locale, onLocale, className }: { html: string | undefined; locale: "en" | "ar"; onLocale: (l: "en" | "ar") => void; className?: string }) {
  const t = useTranslations("admin.content.newsletter");
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div><Label>{t("preview")}</Label><p className="text-xs text-muted-foreground">{t("previewHint")}</p></div>
        <Tabs value={locale} onValueChange={(v) => onLocale(v as "en" | "ar")}>
          <TabsList><TabsTrigger value="en">EN</TabsTrigger><TabsTrigger value="ar">AR</TabsTrigger></TabsList>
        </Tabs>
      </div>
      {html === undefined ? (
        <div className="h-[560px] w-full animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : (
        <iframe title={t("preview")} srcDoc={html} sandbox="" className="h-[640px] w-full rounded-lg border border-border bg-[#0E0B2E]" data-testid="email-preview" />
      )}
    </div>
  );
}
