/**
 * Characters that survive being read aloud, written down and typed back in.
 * No 0/O, no 1/I/L, no 5/S, no 8/B.
 */
const ALPHABET = "234679ACDEFGHJKMNPQRTUVWXYZ";

const GROUP = 4;
const ID_GROUPS = 2;
const RECOVERY_GROUPS = 6;

export const CITY_CODE_PATTERN = /^[A-Z]{3}$/;
export const CITY_ID_PATTERN = /^[A-Z]{3}(-[0-9A-Z]{4}){2}$/;
export const RECOVERY_CODE_PATTERN = /^([0-9A-Z]{4}-){5}[0-9A-Z]{4}$/;

function randomGroups(count: number): string[] {
  const bytes = new Uint8Array(count * GROUP);
  crypto.getRandomValues(bytes);

  const groups: string[] = [];
  for (let g = 0; g < count; g += 1) {
    let group = "";
    for (let i = 0; i < GROUP; i += 1) {
      group += ALPHABET[bytes[g * GROUP + i]! % ALPHABET.length]!;
    }
    groups.push(group);
  }
  return groups;
}

/** e.g. "BLR-7X3K-9QMN". Generated in the browser; the server only ever sees the result. */
export function generateCityId(cityCode: string): string {
  if (!CITY_CODE_PATTERN.test(cityCode)) {
    throw new Error(`City code must be three capital letters, received "${cityCode}".`);
  }
  return [cityCode, ...randomGroups(ID_GROUPS)].join("-");
}

/**
 * 24 characters drawn from a 27-symbol alphabet, about 114 bits. Shown once, never
 * stored anywhere but the user's own records, and the only way back into an account.
 */
export function generateRecoveryCode(): string {
  return randomGroups(RECOVERY_GROUPS).join("-");
}

export function isValidCityId(value: string): boolean {
  return CITY_ID_PATTERN.test(value);
}

export function isValidRecoveryCode(value: string): boolean {
  return RECOVERY_CODE_PATTERN.test(value);
}

/** Accepts what a person actually types: lowercase, stray spaces, missing dashes. */
export function normaliseRecoveryCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (bare.length !== RECOVERY_GROUPS * GROUP) return input.trim().toUpperCase();
  return (bare.match(/.{4}/g) ?? []).join("-");
}
