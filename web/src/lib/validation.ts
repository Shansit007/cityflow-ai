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
