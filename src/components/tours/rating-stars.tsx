import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  rating,
  size = "sm",
  className,
  label,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizeClass = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-gold-500", className)}
      role="img"
      aria-label={label ?? `${rating} / 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = rating >= i + 1;
        const half = !filled && rating > i && rating < i + 1;
        return (
          <span key={i} className="relative inline-flex">
            <Star className={cn(sizeClass, "fill-transparent text-gold-500/40")} />
            {(filled || half) && (
              <Star
                className={cn(sizeClass, "absolute inset-0 fill-current text-gold-500")}
                style={half ? { clipPath: "inset(0 50% 0 0)" } : undefined}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
