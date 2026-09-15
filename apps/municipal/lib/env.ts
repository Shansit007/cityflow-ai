function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example and fill it in.`);
  }
  return value;
}

export function databaseUrl(): string {
  return required("DATABASE_URL");
}

let cachedSecret: Uint8Array | undefined;

export function authSecret(): Uint8Array {
  if (!cachedSecret) {
    const secret = required("AUTH_SECRET");
    if (secret.length < 32) {
      throw new Error("AUTH_SECRET must be at least 32 characters.");
    }
    cachedSecret = new TextEncoder().encode(secret);
  }
  return cachedSecret;
}
