"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { capacityUnits } from "../../../convex/lib/pricing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/admin/ui";
import { BookingSlotFields, type SlotTour, type SlotValue } from "@/components/admin/booking-slot-fields";
import { useConfirm } from "@/components/admin/confirm-dialog";

type ChangeBooking = {
  _id: Id<"bookings">;
  date: string;
  startTime?: string;
  adults: number;
  children: number;
  infants: number;
  rooms?: { singleRequested: number } | null;
  total: number;
  amountPaid: number;
  tour: SlotTour | null;
};

/**
 * Staff "Change booking": date, start time, party and (optionally) an agreed total, with a live preview of the new
 * price and balance from admin.bookings.amendPreview and the departure rules the change would break.
 */
export function ChangeBookingDialog({ booking, open, onOpenChange }: { booking: ChangeBooking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("admin.bookings.change");
  const tm = useTranslations("admin.bookings.manual");
  const amend = useMutation(api.admin.bookings.amend);
  const [confirmDialog, confirm] = useConfirm();
  const tour = booking.tour ?? undefined;
  // A start time the tour no longer runs cannot be kept: staff pick a listed one
  const initialTime = booking.startTime && tour?.startTimes.includes(booking.startTime) ? booking.startTime : booking.startTime ? "" : (tour?.startTimes[0] ?? "");
  const [value, setValue] = useState<SlotValue>({ date: booking.date, startTime: initialTime, adults: booking.adults, children: booking.children, infants: booking.infants, ...(tour?.pricingModel === "per_vehicle_multiday" ? { singleRooms: booking.rooms?.singleRequested ?? 0 } : {}) });
  const [agreedTotal, setAgreedTotal] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const totalOmrOverride = agreedTotal.trim() === "" ? undefined : Number(agreedTotal);
  const preview = useQuery(api.admin.bookings.amendPreview, open && value.startTime ? { id: booking._id, ...value, totalOmrOverride: Number.isFinite(totalOmrOverride) ? totalOmrOverride : undefined } : "skip");
  const ownUnits = tour ? capacityUnits({ pricingModel: tour.pricingModel, vehiclePricing: tour.vehiclePricing ?? undefined }, booking.adults, booking.children) : 0;
  const reasonText = (code: string, data: { remaining?: number; needed?: number }) => (tm.has(`overrideReasons.${code}`) ? tm(`overrideReasons.${code}`, { remaining: data.remaining ?? 0, needed: data.needed ?? 0 }) : code);
  const errorText = (e: { code: string; field?: string }) => (t.has(`errors.${e.code}`) ? t(`errors.${e.code}`, { field: e.field ?? "" }) : `${t("error")} (${e.code}${e.field ? ` · ${e.field}` : ""})`);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !value.startTime) return;
    setBusy(true);
    try {
      const args = { id: booking._id, ...value, totalOmrOverride, reason, notifyCustomer: notify };
      let r: { total: number; refundDue: number; couponDropped?: string };
      try {
        r = await amend(args);
      } catch (err) {
        const data = err instanceof ConvexError ? (err.data as { code?: string; reasons?: string[]; remaining?: number; needed?: number }) : undefined;
        if (data?.code !== "NEEDS_OVERRIDE") throw err;
        const ok = await confirm({ title: tm("overrideTitle"), items: (data.reasons ?? []).map((x) => reasonText(x, data)), confirm: t("saveAnyway"), cancel: t("cancel"), danger: true });
        if (!ok) return;
        r = await amend({ ...args, override: true });
      }
      toast.success(t("saved"));
      if (r.refundDue > 0) toast.warning(t("refundDue", { amount: (r.refundDue / 1000).toFixed(3) }));
      onOpenChange(false);
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code: string; field?: string }) : undefined;
      toast.error(data?.code ? errorText(data) : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <BookingSlotFields idPrefix="cb" tour={tour} value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} own={{ date: booking.date, startTime: booking.startTime ?? "", units: ownUnits }} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cb-total">{t("agreedTotal")}</Label>
            <Input id="cb-total" type="number" step="0.001" min={0} value={agreedTotal} onChange={(e) => setAgreedTotal(e.target.value)} placeholder={t("agreedTotalPlaceholder")} />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm sm:col-span-2" aria-live="polite">
            {preview === undefined ? (
              <p className="text-muted-foreground">{value.startTime ? t("calculating") : t("pickTime")}</p>
            ) : preview === null ? (
              <p className="text-danger">{t("notAmendable")}</p>
            ) : !preview.ok ? (
              <p className="text-danger">{errorText(preview.error)}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">{t("currentTotal")}</dt><dd className="text-end"><Money baisa={booking.total} /></dd>
                <dt className="text-muted-foreground">{t("newTotal")}</dt><dd className="text-end font-medium"><Money baisa={preview.total} /></dd>
                <dt className="text-muted-foreground">{t("paid")}</dt><dd className="text-end"><Money baisa={preview.amountPaid} /></dd>
                {preview.refundDue > 0 ? (
                  <><dt className="text-danger">{t("refundLabel")}</dt><dd className="text-end text-danger"><Money baisa={preview.refundDue} /></dd></>
                ) : (
                  <><dt className="text-muted-foreground">{t("balance")}</dt><dd className="text-end"><Money baisa={preview.balance} /></dd></>
                )}
                {preview.couponDropped && <p className="col-span-2 text-xs text-warning">{t("couponDropped")}</p>}
                {preview.problems.length > 0 && (
                  <ul className="col-span-2 mt-1 list-disc space-y-0.5 ps-5 text-xs text-warning">{preview.problems.map((x) => <li key={x}>{reasonText(x, preview)}</li>)}</ul>
                )}
              </dl>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cb-reason">{t("reason")}</Label>
            <Textarea id="cb-reason" rows={2} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            {t("notify")}
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={busy || !reason.trim() || !value.startTime || preview === null || (preview !== undefined && !preview.ok)} className="bg-gold-gradient text-navy-950">{busy ? t("saving") : t("save")}</Button>
          </div>
        </form>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
