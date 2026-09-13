import { generateRecoveryCode } from "@/lib/city-id";
import { hashRecoveryCode, verifyRecoveryCode } from "@/lib/recovery";

describe("recovery code hashing", () => {
  it("verifies the code it was derived from", async () => {
    const code = generateRecoveryCode();
    expect(await verifyRecoveryCode(code, await hashRecoveryCode(code))).toBe(true);
  });

  it("rejects a different code", async () => {
    const stored = await hashRecoveryCode(generateRecoveryCode());
    expect(await verifyRecoveryCode(generateRecoveryCode(), stored)).toBe(false);
  });

  it("salts, so the same code hashes differently every time", async () => {
    const code = generateRecoveryCode();
    expect(await hashRecoveryCode(code)).not.toBe(await hashRecoveryCode(code));
  });

  it("rejects a stored value that is not a scrypt hash instead of throwing", async () => {
    const code = generateRecoveryCode();
    for (const stored of ["", "$argon2id$v=19$m=1$x$y", "$scrypt$N=1$onlyfour", "plaintext"]) {
      expect(await verifyRecoveryCode(code, stored)).toBe(false);
    }
  });
});
