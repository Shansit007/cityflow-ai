import {
  generateCityId,
  generateRecoveryCode,
  isValidCityId,
  isValidRecoveryCode,
  normaliseRecoveryCode,
} from "@/lib/city-id";

describe("City ID", () => {
  it("produces IDs that pass their own validator", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isValidCityId(generateCityId("BLR"))).toBe(true);
    }
  });

  it("keeps the city code as the prefix so the ID says where it was issued", () => {
    expect(generateCityId("PNQ").startsWith("PNQ-")).toBe(true);
  });

  it("refuses a city code that is not three capital letters", () => {
    expect(() => generateCityId("blr")).toThrow();
    expect(() => generateCityId("BENG")).toThrow();
  });

  it("never emits characters that are misread when transcribed", () => {
    const ids = Array.from({ length: 200 }, () => generateCityId("BLR").slice(4));
    expect(ids.join("")).not.toMatch(/[01OILS58]/);
  });

  it("does not repeat itself across a realistic number of signups", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateCityId("BLR")));
    expect(ids.size).toBe(5000);
  });
});

describe("recovery code", () => {
  it("produces codes that pass their own validator", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isValidRecoveryCode(generateRecoveryCode())).toBe(true);
    }
  });

  it("accepts the code back in the shapes people actually type it", () => {
    const code = generateRecoveryCode();
    const bare = code.replace(/-/g, "");

    expect(normaliseRecoveryCode(bare.toLowerCase())).toBe(code);
    expect(normaliseRecoveryCode(`  ${bare} `)).toBe(code);
    expect(normaliseRecoveryCode(bare.match(/.{4}/g)!.join(" "))).toBe(code);
  });

  it("leaves a code of the wrong length alone rather than inventing groups", () => {
    expect(isValidRecoveryCode(normaliseRecoveryCode("ABC"))).toBe(false);
  });
});
