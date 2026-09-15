import {
  detect,
  extractFeatures,
  magnitude,
  MIN_SAMPLES_PER_WINDOW,
  score,
  type MotionSample,
} from "@/lib/motion";

const GRAVITY = 9.81;

function ride(
  count: number,
  shape: (index: number) => { x: number; y: number; z: number },
  speed: number | null = 8,
): MotionSample[] {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 20,
    speed,
    ...shape(index),
  }));
}

const SMOOTH = (index: number) => ({
  x: 0.1 * Math.sin(index / 6),
  y: 0.05,
  z: GRAVITY + 0.15 * Math.sin(index / 5),
});

describe("magnitude", () => {
  it("is the length of the vector, so phone orientation does not matter", () => {
    const upright = { t: 0, x: 0, y: 0, z: GRAVITY, speed: 8 };
    const onItsSide = { t: 0, x: GRAVITY, y: 0, z: 0, speed: 8 };

    expect(magnitude(upright)).toBeCloseTo(magnitude(onItsSide));
  });
});

describe("extractFeatures", () => {
  it("refuses a window too sparse to say anything about", () => {
    expect(extractFeatures(ride(MIN_SAMPLES_PER_WINDOW - 1, SMOOTH))).toBeNull();
  });

  it("reports how many samples it actually got", () => {
    // Mobile browsers throttle DeviceMotion well below the rate they advertise, so the
    // count is evidence about the recording and not a constant.
    expect(extractFeatures(ride(30, SMOOTH))?.sampleCount).toBe(30);
  });

  it("has no speed when the location watch has not reported yet", () => {
    expect(extractFeatures(ride(30, SMOOTH, null))?.meanSpeed).toBeNull();
  });
});

describe("score", () => {
  it("declines to judge the road when the vehicle is barely moving", () => {
    const features = extractFeatures(ride(30, SMOOTH, 0.5));

    expect(features).not.toBeNull();
    expect(score(features!)).toBeNull();
  });

  it("returns null rather than zero for a quiet window", () => {
    // "The vehicle was stopped" and "the road was fine" are different statements, and
    // only the second is evidence about the road.
    expect(score(extractFeatures(ride(30, SMOOTH))!)).toBeNull();
  });
});

describe("detect", () => {
  it("finds nothing on a smooth road", () => {
    expect(detect(ride(60, SMOOTH))).toHaveLength(0);
  });

  it("finds a pothole", () => {
    const anomalies = detect(
      ride(60, (index) =>
        index === 30
          ? { x: 0.2, y: 0.3, z: GRAVITY + 6.5 }
          : index === 31
            ? { x: 0.2, y: 0.3, z: GRAVITY - 5 }
            : SMOOTH(index),
      ),
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.magnitude).toBeGreaterThan(0);
    expect(anomalies[0]!.magnitude).toBeLessThan(1);
  });

  it("does not report a speed bump as a defect", () => {
    // The same peak height as the pothole above, reached as a slow arc instead of a
    // step. Peak acceleration alone cannot tell these apart, which is why the detector
    // also requires jerk: this test fails if that gate is removed.
    const anomalies = detect(
      ride(60, (index) => ({
        x: 0.1,
        y: 0.05,
        z: GRAVITY + 4 * Math.exp(-((index - 30) ** 2) / 40),
      })),
    );

    expect(anomalies).toHaveLength(0);
  });

  it("ignores a jolt while the vehicle is stationary", () => {
    // Picking a parked phone out of a cradle produces a textbook spike.
    const anomalies = detect(
      ride(
        60,
        (index) => (index === 30 ? { x: 0.2, y: 0.3, z: GRAVITY + 6.5 } : SMOOTH(index)),
        0.5,
      ),
    );

    expect(anomalies).toHaveLength(0);
  });

  it("reports one hole once, not once per overlapping window", () => {
    // Windows overlap by half their length, so without suppression a single defect
    // would report twice from one phone and inflate the confirmation count that the
    // whole aggregation rule rests on.
    const anomalies = detect(
      ride(120, (index) =>
        index === 60
          ? { x: 0.2, y: 0.3, z: GRAVITY + 7 }
          : index === 61
            ? { x: 0.2, y: 0.3, z: GRAVITY - 5.5 }
            : SMOOTH(index),
      ),
    );

    expect(anomalies).toHaveLength(1);
  });

  it("handles an empty recording", () => {
    expect(detect([])).toHaveLength(0);
  });
});
