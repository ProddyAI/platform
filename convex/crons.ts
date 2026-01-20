import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Note: Presence cleanup is now handled automatically by the @convex-dev/presence component
// No manual cleanup cron jobs needed for presence data

// Send weekly digests every Monday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-monday",
	{ dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "monday" }
);

// Send weekly digests every Tuesday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-tuesday",
	{ dayOfWeek: "tuesday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "tuesday" }
);

// Send weekly digests every Wednesday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-wednesday",
	{ dayOfWeek: "wednesday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "wednesday" }
);

// Send weekly digests every Thursday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-thursday",
	{ dayOfWeek: "thursday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "thursday" }
);

// Send weekly digests every Friday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-friday",
	{ dayOfWeek: "friday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "friday" }
);

// Send weekly digests every Saturday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-saturday",
	{ dayOfWeek: "saturday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "saturday" }
);

// Send weekly digests every Sunday at 9:00 AM UTC
crons.weekly(
	"weekly-digest-sunday",
	{ dayOfWeek: "sunday", hourUTC: 9, minuteUTC: 0 },
	internal.email.sendWeeklyDigests,
	{ dayOfWeek: "sunday" }
);

// Clean up expired rate limit entries every hour
crons.hourly(
	"cleanup-expired-rate-limits",
	{ minuteUTC: 0 }, // Run at the top of every hour
	internal.rateLimit.cleanupExpiredLimits
);

export default crons;
