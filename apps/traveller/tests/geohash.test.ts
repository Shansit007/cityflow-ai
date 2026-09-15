import { cellFor, cellSize, isCell } from "@/lib/geohash";

describe("cellFor", () => {
  it("places a known point in its published geohash", () => {
    // Bengaluru city centre. tdr1v9 is the six-character geohash for this point.
    expect(cellFor(12.9716, 77.5946).hash).toBe("tdr1v9");
  });

  it("returns a cell containing the point it was given", () => {
    const cell = cellFor(19.076, 72.8777);

    expect(cell.south).toBeLessThanOrEqual(19.076);
    expect(cell.north).toBeGreaterThanOrEqual(19.076);
    expect(cell.west).toBeLessThanOrEqual(72.8777);
    expect(cell.east).toBeGreaterThanOrEqual(72.8777);
  });

  it("gives neighbouring addresses the same cell", () => {
    // Two points about 200 m apart. The privacy model only means something if a
    // street and the next street over are indistinguishable once stored.
    const one = cellFor(12.9716, 77.5946).hash;
    const other = cellFor(12.9734, 77.5946).hash;

    expect(one).toBe(other);
  });

  it("separates places that are genuinely far apart", () => {
    expect(cellFor(12.9716, 77.5946).hash).not.toBe(cellFor(19.076, 72.8777).hash);
  });

  it("produces a hash the database domain accepts", () => {
    expect(isCell(cellFor(28.6139, 77.209).hash)).toBe(true);
  });

  it("refuses coordinates that are not on the planet", () => {
    expect(() => cellFor(91, 0)).toThrow(RangeError);
    expect(() => cellFor(0, 181)).toThrow(RangeError);
    expect(() => cellFor(Number.NaN, 0)).toThrow(RangeError);
  });
});

describe("cellSize", () => {
  it("is the sub-kilometre scale the privacy note claims", () => {
    const { width, height } = cellSize(cellFor(12.9716, 77.5946));

    expect(width).toBeGreaterThan(900);
    expect(width).toBeLessThan(1400);
    expect(height).toBeGreaterThan(400);
    expect(height).toBeLessThan(800);
  });
});
