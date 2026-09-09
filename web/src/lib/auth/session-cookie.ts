/**
 * The name of the session cookie, in a file of its own.
 *
 * WHY A SEPARATE FILE?
 * `middleware.ts` runs on the Edge runtime and must not import anything that
 * pulls in Prisma or bcrypt. `session.ts` does both. Keeping this one constant
 * on its own lets middleware use it without dragging Node-only code along.
 */
export const SESSION_COOKIE_NAME = "cityflow_session";
