"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Heart toggle; sends guests to sign-in and returns them to the same page. */
export function WishlistButton({ tourId, className, size = "md" }: { tourId: Id<"tours">; className?: string; size?: "md" | "lg" }) {
  const t = useTranslations("account.wishlist");
  const viewer = useQuery(api.users.viewer);
  const ids = useQuery(api.account.wishlistIds, viewer ? {} : "skip");
  const toggle = useMutation(api.account.toggleWishlist);
  const router = useRouter();
  const pathname = usePathname();
  const saved = ids?.includes(String(tourId)) ?? false;
  // Auth state (and the saved list for signed-in users) is still loading.
  const loading = viewer === undefined || (!!viewer && ids === undefined);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return; // don't bounce a signed-in user to sign-in while auth resolves
    if (!viewer) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const r = await toggle({ tourId });
    toast.success(r.saved ? t("added") : t("removed"));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-busy={loading}
      aria-label={saved ? t("remove") : t("save")} title={saved ? t("remove") : t("save")}
      className={cn(
        "flex items-center justify-center rounded-full bg-navy-950/70 text-sand-50 ring-1 ring-gold-500/40 backdrop-blur transition hover:bg-navy-950",
        size === "lg" ? "size-11" : "size-9",
        className,
      )}
    >
      <Heart className={cn(size === "lg" ? "size-5" : "size-4", saved && "fill-gold-500 text-gold-500")} />
    </button>
  );
}
