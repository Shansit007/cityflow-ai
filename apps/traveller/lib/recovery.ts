import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import type { ScryptOptions } from "node:crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// promisify() picks scrypt's three-argument overload and drops the one that takes
// options, so the cost parameters are passed through an explicit wrapper instead.
function deriveKey(
  code: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * Stored form: $scrypt$N=..,r=..,p=..$<salt>$<key>, both base64url. Keeping the
 * parameters in the string means raising the cost later does not invalidate hashes
 * written under the old one.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(code, salt, KEY_LENGTH, { N, r, p });

  return [
    "",
    "scrypt",
    `N=${N},r=${r},p=${p}`,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyRecoveryCode(code: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") return false;

  const options = parseOptions(parts[2]!);
  if (!options) return false;

  const salt = Buffer.from(parts[3]!, "base64url");
  const expected = Buffer.from(parts[4]!, "base64url");
  // scrypt rejects a zero key length, so a truncated stored value would throw
  // out of a function whose whole contract is to return false instead.
  if (expected.length === 0) return false;

  const actual = await deriveKey(code, salt, expected.length, options);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseOptions(raw: string): ScryptOptions | null {
  const found: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const [key, value] = pair.split("=");
    if (!key || !value) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    found[key] = parsed;
  }

  const { N: n, r: rr, p: pp } = found;
  if (n === undefined || rr === undefined || pp === undefined) return null;
  return { N: n, r: rr, p: pp };
}
