import { z } from "zod";

/**
 * Input validation schemas.
 *
 * Every value that arrives from the browser is validated here BEFORE it reaches
 * the database. The same schemas are reused on the client for instant feedback,
 * so the rules can never drift apart.
 */

/** Email: trimmed and lower-cased so casing can never create duplicate accounts. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(254, "That email address is too long")
  .toLowerCase();

/**
 * Password rules, kept deliberately simple and explainable:
 * at least 8 characters, containing at least one letter and one number.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be shorter than 128 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/** Optional nickname used only to greet the user. */
export const displayNameSchema = z
  .string()
  .trim()
  .max(40, "Name must be shorter than 40 characters")
  .optional()
  .or(z.literal(""));

/** Payload accepted by POST /api/auth/signup */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  cityCode: z.string().trim().max(40).optional(),
});

/** Payload accepted by POST /api/auth/login */
export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login: an old password must still be able to sign in.
  password: z.string().min(1, "Password is required").max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Turns a Zod error into a simple `{ fieldName: message }` object that the
 * forms can render directly under each input.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

/* ==========================================================================
   PHASE 2 — travel profile (onboarding + profile editing)
   ========================================================================== */

/** 24-hour "HH:MM". */
export const timeOfDaySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please enter a time as HH:MM, e.g. 09:00");

/** An area name. Deliberately an AREA, never a full street address. */
export const areaSchema = z
  .string()
  .trim()
  .min(2, "Please enter at least 2 characters")
  .max(80, "Please keep this under 80 characters");

const transportModeSchema = z.enum([
  "CAR",
  "BIKE",
  "BUS",
  "METRO",
  "WALK",
  "CYCLE",
  "OTHER",
]);

const destinationTypeSchema = z.enum(["WORK", "COLLEGE", "SCHOOL", "OTHER"]);

const dayCodeSchema = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

/**
 * The complete travel routine.
 *
 * Used by BOTH the onboarding flow and the profile editor, so the two can never
 * drift apart and accept different things.
 */
export const travelProfileSchema = z
  .object({
    // Step 1 — the journey
    homeArea: areaSchema,
    destinationArea: areaSchema,
    destinationType: destinationTypeSchema,
    primaryMode: transportModeSchema,

    // Step 2 — the schedule
    usualDeparture: timeOfDaySchema,
    requiredArrival: timeOfDaySchema,
    typicalJourneyMinutes: z
      .number()
      .int("Please enter a whole number of minutes")
      .min(1, "Journey time must be at least 1 minute")
      .max(300, "Please enter a journey time under 5 hours"),
    travelDays: z
      .array(dayCodeSchema)
      .min(1, "Please choose at least one travel day"),
    isFlexible: z.boolean(),
    flexibilityMinutes: z.number().int().min(0).max(120),

    // Step 3 — preferences
    preferredModes: z.array(transportModeSchema).max(7),
    maxAcceptableDelayMinutes: z.number().int().min(0).max(120),
    willingToLeaveEarlier: z.boolean(),
    willingToLeaveLater: z.boolean(),
    carpoolInterest: z.boolean(),
    publicTransportInterest: z.boolean(),

    // Step 4 — privacy
    shareAggregatedDemand: z.boolean(),
    allowNotifications: z.boolean(),
  })
  .refine(
    (data) => {
      // The required arrival must leave room for the journey itself. Times that
      // cross midnight are allowed, so only same-day ordering is checked.
      const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const departure = toMin(data.usualDeparture);
      const arrival = toMin(data.requiredArrival);
      if (arrival < departure) return true; // crosses midnight — not our problem here
      return arrival - departure >= data.typicalJourneyMinutes;
    },
    {
      message:
        "Your required arrival is earlier than your departure plus your journey time. Please check these three values.",
      path: ["requiredArrival"],
    }
  )
  .refine((data) => !data.isFlexible || data.willingToLeaveEarlier || data.willingToLeaveLater, {
    message:
      "If your departure is flexible, please allow leaving earlier, later, or both.",
    path: ["willingToLeaveEarlier"],
  });

export type TravelProfileInput = z.infer<typeof travelProfileSchema>;

/** Payload for recording what the user decided about today's recommendation. */
export const recommendationDecisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "KEPT_USUAL", "CUSTOM"]),
  /** Required only when the decision is CUSTOM. */
  chosenDeparture: timeOfDaySchema.optional(),
});

export type RecommendationDecisionInput = z.infer<typeof recommendationDecisionSchema>;

/* ==========================================================================
   PHASE 3 — assistant messages and confirmed travel intentions
   ========================================================================== */

/** One message typed into the CityFlow AI assistant. */
export const chatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please type a message")
    .max(400, "Please keep messages under 400 characters"),
});

/**
 * A change the person has explicitly confirmed.
 *
 * At least one of the three must be present — an empty confirmation would write
 * a row that says nothing.
 */
export const intentConfirmSchema = z
  .object({
    /** The assistant message whose card was pressed, so it can be marked done. */
    messageId: z.string().trim().max(40).optional(),
    updatedDeparture: timeOfDaySchema.optional(),
    transportMode: z
      .enum(["CAR", "BIKE", "BUS", "METRO", "WALK", "CYCLE", "OTHER"])
      .optional(),
    cancel: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.updatedDeparture !== undefined ||
      data.transportMode !== undefined ||
      data.cancel === true,
    { message: "There is nothing to confirm." }
  );

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type IntentConfirmInput = z.infer<typeof intentConfirmSchema>;

/* ==========================================================================
   PHASE 4 — Admin Portal: recording a SUMO simulation result
   ========================================================================== */

/**
 * Metrics from one completed SUMO run.
 *
 * These are TYPED IN by the team after a run finishes — CityFlow AI does not
 * run SUMO and does not generate these numbers. The schema exists to stop a
 * typo becoming a result nobody can explain later.
 */
export const simulationRunSchema = z.object({
  cityCode: z.string().trim().min(2).max(40),
  scenario: z.enum(["BASELINE", "CITYFLOW"]),
  networkSource: z
    .string()
    .trim()
    .min(3, "Say where the road network came from, e.g. an OpenStreetMap extract date")
    .max(160),
  vehiclesDeparted: z.number().int().min(0).max(10_000_000),
  meanTravelTimeSeconds: z.number().int().min(0).max(86_400),
  totalDelaySeconds: z.number().int().min(0).max(1_000_000_000),
  peakSlotVehicles: z.number().int().min(0).max(10_000_000),
  meanWaitingSeconds: z.number().int().min(0).max(86_400),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
});

export type SimulationRunInput = z.infer<typeof simulationRunSchema>;
