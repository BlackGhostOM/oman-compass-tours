/**
 * Tour & service catalogue seed (Viator product list, September 2026).
 * Split by kind to keep the files readable; `toursSeed` is the flat list the
 * seed runner and the catalogue migration consume.
 */
import { dayTours } from "./toursDay";
import { longJourneys } from "./toursLong";
import { shortJourneys } from "./toursMultiDay";
import { services } from "./toursServices";
import type { TourSeed } from "./tourSeedTypes";

export type { TourSeed } from "./tourSeedTypes";

export const toursSeed: TourSeed[] = [...dayTours, ...shortJourneys, ...longJourneys, ...services];

/** Seed codes that were retired when the catalogue was replaced; the migration archives them. */
export const RETIRED_TOUR_CODES = ["OCT-006"];
