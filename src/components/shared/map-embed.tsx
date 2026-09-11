import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Google Maps embed. Uses the key-less `output=embed` query URL by default;
 * when NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY is set, the Embed API place mode is used.
 */
export function MapEmbed({
  query,
  lat,
  lng,
  title,
  className,
  zoom = 15,
}: {
  query?: string;
  lat?: number;
  lng?: number;
  title: string;
  className?: string;
  zoom?: number;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const q = query ?? (lat !== undefined && lng !== undefined ? `${lat},${lng}` : undefined);
  const src = key && q
    ? `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(q)}&zoom=${zoom}`
    : q
      ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`
      : site.mapsEmbedUrl;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-sand-200 bg-sand-100", className)}>
      <iframe
        src={src}
        title={title}
        width="100%"
        height="100%"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full min-h-72 w-full"
      />
    </div>
  );
}
