"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { capacityUnits, PARTY_MAX, roomsNeeded } from "../../../convex/lib/pricing";
import { isRealIsoDate } from "../../../convex/lib/dates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SlotTour = {
  _id: Id<"tours">;
  startTimes: string[];
  minGroup: number;
  maxGroup: number;
  pricingModel: "per_group" | "per_person" | "tiered" | "per_vehicle" | "per_vehicle_multiday";
  vehiclePricing?: { pricePerVehicle: number; maxAdults: number; seats: number } | null;
};
export type SlotValue = { date: string; startTime: string; adults: number; children: number; infants: number; /** per_vehicle_multiday only */ singleRooms?: number };

/**
 * Date, start time and party controls shared by the staff "Create manual booking" and "Change booking" dialogs.
 * Shows what is left on each departure of the chosen date (availability.forTour, the same numbers the website uses)
 * and non-blocking warnings for the departure rules; the server still asks for an explicit override.
 * `own` is the booking being changed: its own places are added back on its current departure.
 */
export function BookingSlotFields({ tour, value, onChange, idPrefix, own }: { tour?: SlotTour; value: SlotValue; onChange: (patch: Partial<SlotValue>) => void; idPrefix: string; own?: { date: string; startTime: string; units: number } }) {
  const t = useTranslations("admin.bookings.manual");
  const ts = useTranslations("admin.bookings.slot");
  const validDate = isRealIsoDate(value.date);
  const day = useQuery(api.availability.forTour, tour && validDate ? { tourId: tour._id, from: value.date, to: value.date } : "skip")?.dates[0];
  const remainingAt = (time: string) => {
    const slot = day?.slots.find((s) => s.time === time);
    if (!slot) return undefined;
    return slot.remaining + (own && own.date === value.date && own.startTime === time ? own.units : 0);
  };
  const remaining = value.startTime ? remainingAt(value.startTime) : undefined;
  const needed = tour ? capacityUnits({ pricingModel: tour.pricingModel, vehiclePricing: tour.vehiclePricing ?? undefined }, value.adults, value.children) : 0;
  const group = value.adults + value.children;

  const warnings: string[] = [];
  if (tour && day) {
    if (!day.operating) warnings.push(ts("notOperating"));
    else if (day.isBlackout) warnings.push(ts("blackout"));
    else if (remaining !== undefined && remaining < needed) warnings.push(ts("noCapacity", { remaining, needed }));
  }
  if (tour && (group < tour.minGroup || group > PARTY_MAX)) warnings.push(ts("groupSize", { min: tour.minGroup, max: PARTY_MAX }));
  if (value.infants > value.adults) warnings.push(ts("tooManyInfants"));

  const num = (x: string) => (x.trim() === "" ? 0 : Math.max(0, Math.floor(Number(x)) || 0));

  return (
    <>
      <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-date`}>{t("date")}</Label><Input id={`${idPrefix}-date`} type="date" required value={value.date} onChange={(e) => onChange({ date: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-time`}>{t("time")}</Label>
        <Select value={value.startTime} onValueChange={(v) => { if (v) onChange({ startTime: v }); }}>
          <SelectTrigger id={`${idPrefix}-time`} className="w-full"><SelectValue placeholder={ts("pickTime")} /></SelectTrigger>
          <SelectContent>
            {(tour?.startTimes ?? []).map((s) => {
              const left = day?.operating && !day.isBlackout ? remainingAt(s) : day ? 0 : undefined;
              return (
                <SelectItem key={s} value={s}>
                  <span dir="ltr">{s}</span>
                  {left !== undefined && <span className={left > 0 ? "text-muted-foreground" : "text-danger"}> · {left > 0 ? ts("left", { count: left }) : ts("full")}</span>}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-adults`}>{t("adults")}</Label><Input id={`${idPrefix}-adults`} type="number" min={1} value={value.adults} onChange={(e) => onChange({ adults: num(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-children`}>{t("children")}</Label><Input id={`${idPrefix}-children`} type="number" min={0} value={value.children} onChange={(e) => onChange({ children: num(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-infants`}>{t("infants")}</Label><Input id={`${idPrefix}-infants`} type="number" min={0} value={value.infants} onChange={(e) => onChange({ infants: num(e.target.value) })} /></div>
      </div>
      {tour?.pricingModel === "per_vehicle_multiday" && (() => {
        const rooms = roomsNeeded(group, value.singleRooms);
        return (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-single`}>{t("singleRooms")}</Label>
            <Input id={`${idPrefix}-single`} type="number" min={0} max={group} value={value.singleRooms ?? 0} onChange={(e) => onChange({ singleRooms: Math.min(group, num(e.target.value)) })} />
            <p className="text-xs text-muted-foreground">{t("roomsSummary", { shared: rooms.shared, single: rooms.single })}</p>
          </div>
        );
      })()}
      {warnings.length > 0 && (
        <ul role="status" className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground sm:col-span-2">
          {warnings.map((w) => <li key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> {w}</li>)}
        </ul>
      )}
    </>
  );
}
