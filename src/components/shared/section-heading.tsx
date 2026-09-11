import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "start";
  tone?: "light" | "dark";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-start", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag
        className={cn(
          "heading-brand mt-3 font-heading text-3xl leading-tight sm:text-4xl",
          dark ? "text-sand-50" : "text-navy-950",
        )}
      >
        {title}
      </Tag>
      <div className={cn("hairline mt-5 w-24", align === "center" ? "mx-auto" : "")} />
      {description && (
        <p className={cn("mt-5 text-base leading-relaxed sm:text-lg", dark ? "text-sand-100/75" : "text-ink-500")}>
          {description}
        </p>
      )}
    </div>
  );
}
