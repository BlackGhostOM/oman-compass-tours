"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConvex, useMutation } from "convex/react";
import { ImagePlus, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "image" | "video" | "any";

const LIMITS: Record<Kind, number> = { image: 15 * 1024 * 1024, video: 100 * 1024 * 1024, any: 100 * 1024 * 1024 };
const ACCEPT: Record<Kind, string> = { image: "image/*", video: "video/mp4,video/webm,video/quicktime", any: "image/*,video/mp4,video/webm,video/quicktime" };

/**
 * URL input with an "upload" button: staff can paste a link or attach a file,
 * which is stored in Convex storage and its public URL written into the field.
 */
export function MediaUrlField({ label, value, onChange, kind = "image", placeholder, className }: { label: string; value: string; onChange: (url: string) => void; kind?: Kind; placeholder?: string; className?: string }) {
  const t = useTranslations("admin.media");
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if ((kind === "image" && !isImage) || (kind === "video" && !isVideo) || (kind === "any" && !isImage && !isVideo)) return toast.error(t("wrongType"));
    if (file.size > LIMITS[kind]) return toast.error(t("tooLarge", { mb: Math.round(LIMITS[kind] / 1024 / 1024) }));
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({ purpose: "media" });
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const url = await convex.query(api.files.getUrl, { storageId });
      if (!url) throw new Error("no url");
      onChange(url);
      toast.success(t("uploaded"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  const Icon = kind === "video" ? Video : kind === "image" ? ImagePlus : Upload;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" placeholder={placeholder} className="flex-1" />
        <label className={cn("inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted", busy && "pointer-events-none opacity-60")}>
          <Icon className="size-4" /> {busy ? t("uploading") : t("upload")}
          <input type="file" accept={ACCEPT[kind]} className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </label>
      </div>
      {value && kind !== "video" && /^(https?:\/\/|\/)/.test(value) && (
        // eslint-disable-next-line @next/next/no-img-element -- staff preview of an arbitrary URL
        <img src={value} alt="" className="h-16 w-auto rounded-md border border-border object-cover" />
      )}
    </div>
  );
}
