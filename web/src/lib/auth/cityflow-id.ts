/**
 * Anonymous CityFlow ID.
 *
 * WHAT IT IS
 * A short, human-readable public identifier such as `CF-8X42K91`.
 *
 * WHY IT EXISTS
 * Everything the system does with a person's travel behaviour — preferences,
 * recommendations, aggregated demand, participation history — is linked to this
 * ID instead of their email or name. That means the Admin Portal and the demand
 * engine can work with real travel patterns while still keeping identity out of
 * the picture.
 */

/**
 * Alphabet without characters that are easy to misread when spoken or copied:
 * no 0/O, no 1/I/L, no U (avoids accidental words).
 */
const ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Number of random characters after the "CF-" prefix. */
const ID_LENGTH = 7;

/**
 * Generates one candidate CityFlow ID, e.g. "CF-8X42K91".
 *
 * Uses the Web Crypto API (available in both the Node.js and Edge runtimes)
 * rather than Math.random(), so IDs are not predictable.
 */
export function generateCityflowId(): string {
  const randomBytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(randomBytes);

  let id = "";
  for (let i = 0; i < ID_LENGTH; i += 1) {
    // Modulo bias is negligible here and has no security impact, because
    // uniqueness is enforced by a database constraint, not by the ID itself.
    id += ID_ALPHABET[randomBytes[i] % ID_ALPHABET.length];
  }

  return `CF-${id}`;
}

/**
 * Generates a CityFlow ID that is not already taken.
 *
 * @param isTaken  Callback that returns true when the candidate already exists.
 * @param maxAttempts Safety valve so a bug can never turn into an infinite loop.
 */
export async function generateUniqueCityflowId(
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 8
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCityflowId();
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(
    "Could not generate a unique CityFlow ID after several attempts. Please try again."
  );
}

/** Checks that a string looks like a valid CityFlow ID. */
export function isValidCityflowId(value: string): boolean {
  return new RegExp(`^CF-[${ID_ALPHABET}]{${ID_LENGTH}}$`).test(value);
}
