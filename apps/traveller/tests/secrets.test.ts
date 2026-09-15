import { generateRecoveryCode } from "@/lib/city-id";
import { hashSecret, verifySecret } from "@cityflow/secrets";

describe("secret hashing", () => {
  it("verifies the code it was derived from", async () => {
    const code = generateRecoveryCode();
    expect(await verifySecret(code, await hashSecret(code))).toBe(true);
  });

  it("rejects a different code", async () => {
    const stored = await hashSecret(generateRecoveryCode());
    expect(await verifySecret(generateRecoveryCode(), stored)).toBe(false);
  });

  it("salts, so the same code hashes differently every time", async () => {
    const code = generateRecoveryCode();
    expect(await hashSecret(code)).not.toBe(await hashSecret(code));
  });

  it("rejects a stored value that is not a scrypt hash instead of throwing", async () => {
    const code = generateRecoveryCode();
    for (const stored of [
      "",
      "$argon2id$v=19$m=1$x$y",
      "$scrypt$N=1$onlyfour",
      "plaintext",
      "$scrypt$N=16384,r=8,p=1$c2FsdA$",
    ]) {
      expect(await verifySecret(code, stored)).toBe(false);
    }
  });
});
