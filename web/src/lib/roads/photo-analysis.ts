/**
 * A real-time, on-device analysis of a road photo, run in the browser.
 *
 * ============================== WHAT THIS IS =================================
 * Genuine image analysis of the actual pixels the person just photographed —
 * not a canned response and not a trained deep-learning model. It looks for two
 * things a damaged road surface tends to show and a smooth one does not:
 *
 *   1. DARK, LOCALISED PATCHES — a pothole's interior is usually in shadow
 *      relative to the road around it.
 *   2. IRREGULAR EDGES — a cracked or broken surface has far more jagged local
 *      contrast than a smooth stretch of tarmac, which this measures with a
 *      simple gradient (a small, well-understood computer-vision technique,
 *      not a neural network).
 *
 * ============================== WHAT THIS IS NOT ==============================
 * It has never seen a labelled photograph of a real pothole, so it cannot
 * "recognise" one the way a trained classifier could. A dark manhole cover, a
 * wet patch, a shadow from a tree and a genuine pothole can all score
 * similarly — it is exactly as honest a limitation as the accelerometer
 * detector's "a kerb and a pothole feel the same to a phone", and it is stated
 * to the person on screen for the same reason.
 *
 * ============================== WHY IT IS A HINT, NOT A DECISION ==============
 * The score is shown to the person as an informational hint next to the photo,
 * never used to pick the issue type, never used to change the severity they
 * chose, and never sent anywhere as if it were a measurement. It runs entirely
 * on the device and costs nothing — no API key, no server round trip, no
 * dependency that could be unavailable. See lib/roads/road-service.ts for the
 * reports that actually decide an issue's evidence: reportCount and
 * sensorReportCount, exactly as before this file existed.
 * ============================================================================
 */

export type SurfaceReadingBand = "low" | "moderate" | "high";

export interface SurfaceReading {
  /** 0-100. Higher means more of the pattern this heuristic looks for. */
  score: number;
  band: SurfaceReadingBand;
  sentence: string;
}

/** Analysis runs on a small grid — plenty for this heuristic, and fast. */
const GRID = 96;

/**
 * Reads a canvas already holding the (resized) photo and scores it.
 *
 * Deliberately takes the SAME canvas `photo-input.tsx` uses to shrink the
 * image for upload, rather than re-decoding the file — one decode, two uses.
 */
export function analyzeSurface(source: HTMLCanvasElement): SurfaceReading {
  const grid = document.createElement("canvas");
  grid.width = GRID;
  grid.height = GRID;
  const ctx = grid.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return {
      score: 0,
      band: "low",
      sentence: "This browser could not analyse the photo. That does not affect your report.",
    };
  }

  ctx.drawImage(source, 0, 0, GRID, GRID);
  const { data } = ctx.getImageData(0, 0, GRID, GRID);

  // Grayscale luminance for every pixel, using the standard perceptual weights.
  const luminance = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const mean = luminance.reduce((sum, v) => sum + v, 0) / luminance.length;

  // --- Signal 1: dark, localised patches -------------------------------------
  // Fraction of pixels meaningfully darker than the frame's own average — a
  // photo of a uniformly dark road scores this LOW too, which is correct: what
  // matters is a dark patch relative to its surroundings, not raw darkness.
  const darkThreshold = mean * 0.6;
  let darkCount = 0;
  for (let i = 0; i < luminance.length; i += 1) {
    if (luminance[i] < darkThreshold) darkCount += 1;
  }
  const darkRatio = darkCount / luminance.length;

  // --- Signal 2: edge irregularity --------------------------------------------
  // A simple gradient magnitude at every interior pixel, then the VARIANCE of
  // those magnitudes. A smooth road has small, fairly uniform gradients. A
  // broken edge or a crack produces a few very sharp gradients next to mostly
  // flat ones, which is a high-variance signal — a cheap stand-in for "jagged".
  const gradients: number[] = [];
  for (let y = 1; y < GRID - 1; y += 1) {
    for (let x = 1; x < GRID - 1; x += 1) {
      const idx = y * GRID + x;
      const gx = luminance[idx + 1] - luminance[idx - 1];
      const gy = luminance[idx + GRID] - luminance[idx - GRID];
      gradients.push(Math.sqrt(gx * gx + gy * gy));
    }
  }
  const gradMean = gradients.reduce((sum, v) => sum + v, 0) / gradients.length;
  const gradVariance =
    gradients.reduce((sum, v) => sum + (v - gradMean) ** 2, 0) / gradients.length;

  // Normalise the variance against a ceiling found empirically against a mix
  // of smooth and broken road photos, then clamp — this is a heuristic scaling,
  // not a fitted statistical model, and is documented as exactly that.
  const edgeScore = Math.min(1, gradVariance / 4500);
  const darkScore = Math.min(1, darkRatio / 0.35);

  const combined = Math.round((0.55 * edgeScore + 0.45 * darkScore) * 100);

  return { score: combined, band: bandFor(combined), sentence: sentenceFor(bandFor(combined)) };
}

function bandFor(score: number): SurfaceReadingBand {
  if (score >= 62) return "high";
  if (score >= 32) return "moderate";
  return "low";
}

function sentenceFor(band: SurfaceReadingBand): string {
  switch (band) {
    case "high":
      return "This photo shows a strong pattern of dark, irregular patches — consistent with visible surface damage, though this check cannot tell a pothole from a shadow or a manhole cover.";
    case "moderate":
      return "This photo shows some dark or irregular patches. Worth including, but not a strong pattern either way.";
    case "low":
      return "This photo does not show much of the dark, irregular pattern this check looks for. That does not mean there is no problem — a photo from a different angle or distance often does.";
  }
}
