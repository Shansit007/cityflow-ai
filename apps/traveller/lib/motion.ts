/**
 * Turning phone accelerometer samples into road-defect candidates.
 *
 * The approach follows the two studies this problem is usually traced to: MIT's
 * Pothole Patrol (Eriksson et al., MobiSys 2008), which detects defects from vertical
 * acceleration spikes gated on speed, and Microsoft Research India's Nericell (Mohan
 * et al., SenSys 2008), which added braking and honking detection and dealt with the
 * phone being in an arbitrary orientation.
 *
 * What is here is a threshold detector over hand-chosen features, not a trained
 * classifier. There is no labelled Indian road data to fit one to, and a model trained
 * on synthetic bumps would be a model of the generator rather than of roads. The
 * feature extraction below is the part a classifier would consume, so the thresholds
 * can be replaced by a fitted model once labels exist without changing anything else.
 */

export interface MotionSample {
  /** Milliseconds since the recording started. */
  t: number;
  x: number;
  y: number;
  z: number;
  /** Metres per second from the geolocation watch, or null if not yet known. */
  speed: number | null;
}

export interface WindowFeatures {
  /** Spread of vertical acceleration: a rough road raises it, a pothole spikes it. */
  verticalVariance: number;
  /** Largest departure from the window's own mean, in m/s squared. */
  peakDeviation: number;
  /**
   * Mean squared sample-to-sample change. A cheap high-pass: a speed bump is a slow
   * arc and a pothole edge is a step, and this separates them without an FFT over a
   * fifty-sample window where an FFT would resolve almost nothing anyway.
   */
  jerkEnergy: number;
  meanSpeed: number | null;
  sampleCount: number;
}

/**
 * Sampling and window sizes. DeviceMotion is capped well below 50 Hz on current mobile
 * browsers - iOS Safari delivers about 30 Hz and throttles further in the background -
 * so a window is defined by duration rather than by a sample count, and the count it
 * actually got is reported with the features.
 */
export const WINDOW_MS = 1000;
export const STEP_MS = 500;
export const MIN_SAMPLES_PER_WINDOW = 12;

/**
 * Gates. Below the lower speed a stationary phone being picked up looks exactly like a
 * pothole; above the upper one the vehicle is not on the kind of street this is for,
 * and vertical noise rises with speed regardless of the surface.
 */
export const MIN_SPEED_MS = 2.8;
export const MAX_SPEED_MS = 22;

/**
 * Thresholds, in m/s squared and its square. Chosen to sit above normal Indian urban
 * road roughness rather than fitted, which is why docs/engine.md calls the detector a
 * heuristic. They are the single thing most in need of per-city calibration.
 */
export const PEAK_DEVIATION_THRESHOLD = 3.2;
export const JERK_ENERGY_THRESHOLD = 1.4;

/**
 * Vertical magnitude, taken as the length of the acceleration vector.
 *
 * Using the vector magnitude rather than the z axis is what lets the phone sit in a
 * pocket or a cradle at any angle. It costs the ability to tell a vertical jolt from a
 * lateral swerve, which is a trade Nericell also makes and documents.
 */
export function magnitude(sample: MotionSample): number {
  return Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
}

export function extractFeatures(samples: MotionSample[]): WindowFeatures | null {
  if (samples.length < MIN_SAMPLES_PER_WINDOW) return null;

  const magnitudes = samples.map(magnitude);
  const mean = magnitudes.reduce((total, value) => total + value, 0) / magnitudes.length;

  let variance = 0;
  let peakDeviation = 0;
  for (const value of magnitudes) {
    const deviation = value - mean;
    variance += deviation * deviation;
    peakDeviation = Math.max(peakDeviation, Math.abs(deviation));
  }
  variance /= magnitudes.length;

  let jerk = 0;
  for (let index = 1; index < magnitudes.length; index += 1) {
    const change = magnitudes[index]! - magnitudes[index - 1]!;
    jerk += change * change;
  }
  jerk /= Math.max(1, magnitudes.length - 1);

  const speeds = samples
    .map((sample) => sample.speed)
    .filter((speed): speed is number => speed !== null);

  return {
    verticalVariance: variance,
    peakDeviation,
    jerkEnergy: jerk,
    meanSpeed:
      speeds.length > 0
        ? speeds.reduce((total, value) => total + value, 0) / speeds.length
        : null,
    sampleCount: samples.length,
  };
}

/**
 * Whether this window looks like a defect, and how strongly.
 *
 * Returns null rather than a low score when a gate fails, because "the vehicle was
 * stopped" and "the road was fine" are different statements and only the second one is
 * evidence about the road.
 */
export function score(features: WindowFeatures): number | null {
  if (features.meanSpeed === null) return null;
  if (features.meanSpeed < MIN_SPEED_MS || features.meanSpeed > MAX_SPEED_MS) return null;

  if (features.peakDeviation < PEAK_DEVIATION_THRESHOLD) return null;
  if (features.jerkEnergy < JERK_ENERGY_THRESHOLD) return null;

  // Squashed into [0, 1) so the severity the municipal side sorts by does not depend on
  // how hard one particular phone was thrown about.
  const excess = features.peakDeviation / PEAK_DEVIATION_THRESHOLD - 1;
  return 1 - Math.exp(-excess);
}

export interface Anomaly {
  at: number;
  magnitude: number;
  features: WindowFeatures;
}

/**
 * Slides a window over a recording and returns what it flagged.
 *
 * Overlapping windows mean one pothole can trip two of them, so a flagged window
 * suppresses the next: reporting the same hole twice from one phone would inflate the
 * confirmation count that the whole aggregation rule depends on.
 */
export function detect(samples: MotionSample[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  if (samples.length === 0) return anomalies;

  const start = samples[0]!.t;
  const end = samples[samples.length - 1]!.t;
  let suppressUntil = -Infinity;

  for (let from = start; from + WINDOW_MS <= end; from += STEP_MS) {
    if (from < suppressUntil) continue;

    const window = samples.filter(
      (sample) => sample.t >= from && sample.t < from + WINDOW_MS,
    );
    const features = extractFeatures(window);
    if (!features) continue;

    const magnitude = score(features);
    if (magnitude === null) continue;

    anomalies.push({ at: from + WINDOW_MS / 2, magnitude, features });
    suppressUntil = from + WINDOW_MS;
  }

  return anomalies;
}
