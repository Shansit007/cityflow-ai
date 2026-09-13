import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * Stored form: $scrypt$N=..,r=..,p=..$<salt>$<key>, both base64url. Keeping the
 * parameters in the string means raising the cost later does not invalidate hashes
 * written under the old one.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = (await scryptAsync(code, salt, KEY_LENGTH, { N, r, p })) as Buffer;

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

  const params = parseParams(parts[2]!);
  if (!params) return false;

  const salt = Buffer.from(parts[3]!, "base64url");
  const expected = Buffer.from(parts[4]!, "base64url");

  const actual = (await scryptAsync(code, salt, expected.length, params)) as Buffer;

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseParams(raw: string): { N: number; r: number; p: number } | null {
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
