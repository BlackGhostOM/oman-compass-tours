import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Props = { className?: string; iconClassName?: string };

const Icon = ({ d, viewBox = "0 0 24 24" }: { d: string; viewBox?: string }) => (
  <svg viewBox={viewBox} aria-hidden="true" className="size-4 fill-current">
    <path d={d} />
  </svg>
);

const items = [
  {
    key: "instagram",
    label: "Instagram",
    href: site.social.instagram,
    d: "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z",
  },
  {
    key: "tiktok",
    label: "TikTok",
    href: site.social.tiktok,
    d: "M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.3a7.3 7.3 0 0 0 4.3 1.4V7.6a4.3 4.3 0 0 1-3.2-1.8z",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    href: site.social.snapchat,
    d: "M12 2c2.9 0 5.2 2.2 5.2 5.5v2.2c.5.2 1.2 0 1.6-.2.4-.2.9 0 .9.4 0 .5-.7.8-1.4 1.1-.4.2-.8.3-.9.6-.1.3.5 1.5 1.7 2.6.8.7 1.9 1.1 2.4 1.2.3.1.4.3.3.6-.2.5-1.2.8-2.2 1-.2.3-.2.9-.5 1-.4.1-1.1-.2-1.9-.1-.8.1-1.5.7-2.5 1.2-.6.3-1.1.4-1.7.4s-1.1-.1-1.7-.4c-1-.5-1.7-1.1-2.5-1.2-.8-.1-1.5.2-1.9.1-.3-.1-.3-.7-.5-1-1-.2-2-.5-2.2-1-.1-.3 0-.5.3-.6.5-.1 1.6-.5 2.4-1.2 1.2-1.1 1.8-2.3 1.7-2.6-.1-.3-.5-.4-.9-.6C4.5 10.7 3.8 10.4 3.8 9.9c0-.4.5-.6.9-.4.4.2 1.1.4 1.6.2V7.5C6.8 4.2 9.1 2 12 2z",
  },
  {
    key: "facebook",
    label: "Facebook",
    href: site.social.facebook,
    d: "M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z",
  },
  {
    key: "x",
    label: "X",
    href: site.social.x,
    d: "M17.5 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9L17.5 3zm-1.1 16.2h1.7L7 4.7H5.2l11.2 14.5z",
  },
  {
    key: "tripadvisor",
    label: "Tripadvisor",
    href: site.social.tripadvisor,
    d: "M12 6.5c2.2 0 4.2.6 5.9 1.6H22l-1.6 1.8c1 .9 1.6 2.2 1.6 3.6 0 2.7-2.2 4.9-4.9 4.9-1.3 0-2.5-.5-3.4-1.4L12 19l-1.7-2c-.9.9-2.1 1.4-3.4 1.4C4.2 18.4 2 16.2 2 13.5c0-1.4.6-2.7 1.6-3.6L2 8.1h4.1c1.7-1 3.7-1.6 5.9-1.6zm-5.1 3.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6zm10.2 0a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6zM6.9 11.8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm10.2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  },
];

export function SocialLinks({ className, iconClassName }: Props) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Social media">
      {items.map((s) => (
        <li key={s.key}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border border-navy-800 bg-navy-900 text-sand-100/80 transition hover:border-gold-500 hover:text-gold-400",
              iconClassName,
            )}
          >
            <Icon d={s.d} />
          </a>
        </li>
      ))}
    </ul>
  );
}
