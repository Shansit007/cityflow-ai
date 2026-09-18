import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * IMPORTANT: this module runs only in the Node.js runtime (API route handlers).
 * It must never be imported from `middleware.ts`, which runs on the Edge runtime.
 */

/**
 * Cost factor for bcrypt. 10 rounds is the widely used default: strong enough
 * for real use, fast enough that a login on a free hosting tier stays snappy.
 */
const SALT_ROUNDS = 10;

/** Turns a plain password into a salted bcrypt hash for storage. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Checks a plain password against a stored hash.
 * Returns false (never throws) when the stored hash is malformed.
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, storedHash);
  } catch {
    return false;
  }
}
