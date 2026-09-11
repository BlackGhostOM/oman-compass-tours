import type { Id } from "../../../convex/_generated/dataModel";
import type { LocalizedString } from "@/lib/content";

export type BookingTour = {
  _id: Id<"tours">;
  code: string;
  title: LocalizedString;
  slug: LocalizedString;
  summary: LocalizedString;
  coverImage: { url?: string; alt: LocalizedString } | null;
  durationLabel: LocalizedString;
  durationDays: number;
  startTimes: string[];
  pricingModel: "per_group" | "per_person";
  priceGroup: number | null;
  priceAdult: number | null;
  priceChild: number | null;
  childAgeMax: number | null;
  infantAgeMax: number;
  minGroup: number;
  maxGroup: number;
  depositPercent: number;
  freeCancellationHours: number;
  allowReserveNowPayLater: boolean;
  holdHours: number;
  pickupIncluded: boolean;
  addOns: { _id: Id<"addOns">; key: string; name: LocalizedString; description: LocalizedString | null; price: number; priceType: "per_booking" | "per_person" }[];
  requiredPolicies: { _id: Id<"policies">; key: string; title: LocalizedString; versionId: Id<"policyVersions"> }[];
};

export type WizardState = {
  step: 1 | 2 | 3 | 4;
  date: string;
  startTime: string;
  adults: number;
  children: number;
  infants: number;
  addOns: Record<string, number>; // addOnId → quantity
  couponCode: string;
  traveller: {
    firstName: string;
    lastName: string;
    nationality: string;
    phone: string;
    email: string;
    hotel: string;
    pickupLocation: string;
    specialRequests: string;
  };
  acceptedPolicies: boolean;
  acceptedWaiver: boolean;
  payLater: boolean;
  tourSlug: string;
};

export const STEPS = ["dates", "traveller", "review", "payment"] as const;
