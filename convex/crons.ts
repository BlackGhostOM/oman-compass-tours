import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Release unpaid holds (reserve-now-pay-later / abandoned checkouts)
crons.interval("expire booking holds", { minutes: 15 }, internal.bookings.expireHolds, {});

// Move confirmed → in_progress → completed by date (Oman time), then ask for a review
crons.hourly("advance booking lifecycle", { minuteUTC: 5 }, internal.bookings.markInProgressAndCompleted, {});

// T-24h reminders
crons.hourly("send tour reminders", { minuteUTC: 10 }, internal.bookingEmails.sendDueReminders, {});

// Abandoned booking follow-ups (3h after last activity, once)
crons.hourly("abandoned booking follow-up", { minuteUTC: 20 }, internal.bookingEmails.followUpAbandonedDrafts, {});

// Display FX rates
crons.daily("refresh fx rates", { hourUTC: 2, minuteUTC: 0 }, internal.fx.refresh, {});

export default crons;
