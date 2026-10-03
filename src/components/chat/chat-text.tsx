import { ArrowUpRight, CalendarCheck, Compass, HelpCircle, Mail, Map as MapIcon, MessageCircle, Phone, Sparkles } from "lucide-react";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Markdown links `[label](url)` or bare http(s) URLs. */
const TOKEN = /\[([^\]\n]{1,120})\]\(((?:https?:\/\/|tel:|mailto:)[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
const STARTS_WITH_EMOJI = /^\p{Extended_Pictographic}/u;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const OWN_HOST = host(site.url);

function isOwnSite(url: string) {
  const h = host(url);
  return h !== "" && (h === OWN_HOST || h === "localhost" || h === "127.0.0.1");
}

function iconFor(url: string) {
  if (url.includes("wa.me/")) return MessageCircle;
  if (url.startsWith("tel:")) return Phone;
  if (url.startsWith("mailto:")) return Mail;
  if (/\/(book|booking|checkout)\b/.test(url)) return CalendarCheck;
  if (url.includes("/plan-my-trip")) return Sparkles;
  if (url.includes("/destinations")) return MapIcon;
  if (url.includes("/faq")) return HelpCircle;
  return Compass;
}

function LinkChip({ href, label }: { href: string; label: string }) {
  const own = isOwnSite(href) || href.startsWith("tel:") || href.startsWith("mailto:");
  const whatsapp = href.includes("wa.me/");
  const Icon = iconFor(href);
  return (
    <a
      href={href}
      target={own ? undefined : "_blank"}
      rel="noopener noreferrer"
      className={cn(
        "my-1 inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline shadow-sm transition-colors",
        whatsapp
          ? "border-[#25D366]/40 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20"
          : "border-gold-500/40 bg-background text-navy-950 hover:border-gold-500 hover:bg-gold-500/10 dark:text-gold-400",
      )}
    >
      {!STARTS_WITH_EMOJI.test(label) && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{label}</span>
      {!own && <ArrowUpRight className="size-3 shrink-0 opacity-70" aria-hidden />}
    </a>
  );
}

/**
 * Renders a chat message: labelled markdown links become tappable chips with an icon,
 * bare URLs become short links. Only http(s), tel: and mailto: targets are ever linked.
 */
export function ChatText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (m[1] && m[2]) {
      out.push(<LinkChip key={index} href={m[2]} label={m[1].trim()} />);
    } else if (m[3]) {
      out.push(
        <a key={index} href={m[3]} target={isOwnSite(m[3]) ? undefined : "_blank"} rel="noopener noreferrer" className="break-all underline underline-offset-2">
          {m[3].replace(/^https?:\/\/(www\.)?/, "")}
        </a>,
      );
    }
    last = index + m[0].length;
  }
  if (last === 0) return <>{text}</>;
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
