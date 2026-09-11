import { cn } from "@/lib/utils";

/**
 * Thin-lined 8-point compass rose echoing the logo.
 * Used as a low-opacity watermark and as an icon.
 */
export function CompassRose({
  className,
  strokeWidth = 1,
  ...props
}: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("text-gold-500", className)}
      {...props}
    >
      <circle cx="100" cy="100" r="64" />
      <circle cx="100" cy="100" r="56" />
      <circle cx="100" cy="100" r="40" strokeDasharray="2 4" />
      {/* Cardinal points */}
      <path d="M100 6 L108 92 L100 100 L92 92 Z" />
      <path d="M100 194 L108 108 L100 100 L92 108 Z" />
      <path d="M6 100 L92 92 L100 100 L92 108 Z" />
      <path d="M194 100 L108 92 L100 100 L108 108 Z" />
      {/* Ordinal points */}
      <path d="M36 36 L96 88 L100 100 L88 96 Z" />
      <path d="M164 36 L104 88 L100 100 L112 96 Z" />
      <path d="M36 164 L96 112 L100 100 L88 104 Z" />
      <path d="M164 164 L104 112 L100 100 L112 104 Z" />
      {/* Rising sun & palm silhouette hint */}
      <circle cx="100" cy="88" r="10" />
      <path d="M78 118 Q100 104 122 118" />
      <path d="M100 118 V124" />
    </svg>
  );
}

/** Full-bleed watermark (4–6 % opacity) for hero and section backgrounds. */
export function CompassWatermark({
  className,
  opacity = 0.05,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
      style={{ opacity }}
    >
      <CompassRose className="h-[140%] w-auto max-w-none animate-spin-slow" strokeWidth={0.6} />
    </div>
  );
}

/** Small compass-point glyph usable as a bullet marker (N/E/S/W). */
export function CompassPoint({
  point = "N",
  className,
}: {
  point?: "N" | "E" | "S" | "W";
  className?: string;
}) {
  const rotation = { N: 0, E: 90, S: 180, W: 270 }[point];
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 text-gold-500", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
      fill="currentColor"
    >
      <path d="M8 1 L10 8 L8 15 L6 8 Z" opacity="0.9" />
      <path d="M1 8 L8 6 L15 8 L8 10 Z" opacity="0.45" />
    </svg>
  );
}
