import { Landmark, hasLandmark } from "@/components/landmark";

/**
 * The city, behind the page, drawn rather than photographed.
 *
 * Two soft washes of colour and the city's landmark in outline. Nothing is downloaded:
 * it is a gradient and a few hundred bytes of SVG, so it costs a commuter on a slow
 * connection nothing, stays sharp on any screen, and follows the theme control instead
 * of sitting there as a fixed image that only suits one of them.
 *
 * It is also the end of a licensing problem. A photograph of a monument needs terms that
 * permit redistribution and a credit line that has to stay correct forever; this belongs
 * to the project outright.
 */

interface Palette {
  /** Two hue angles, in degrees, for the warm and cool wash. */
  hues: [number, number];
  /** What the colour is reaching for, so a later edit knows what it would be breaking. */
  note: string;
}

const CITIES: Record<string, Palette> = {
  BLR: { hues: [155, 192], note: "gardens and rain trees" },
  DEL: { hues: [18, 36], note: "sandstone" },
  BOM: { hues: [206, 232], note: "the Arabian Sea" },
  HYD: { hues: [272, 300], note: "pearls and granite" },
  MAA: { hues: [176, 200], note: "the Coromandel coast" },
  PNQ: { hues: [96, 44], note: "the Deccan in late monsoon" },
  CCU: { hues: [24, 352], note: "terracotta" },
  AMD: { hues: [238, 262], note: "indigo dye" },
  JAI: { hues: [332, 350], note: "the pink city" },
};

const FALLBACK: Palette = { hues: [200, 168], note: "no city in particular" };

export function CityBackdrop({ city }: { city: string }) {
  const palette = CITIES[city] ?? FALLBACK;
  const [warm, cool] = palette.hues;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            // Placed off the top corners so the strongest colour sits behind the header
            // and fades out before it reaches the body text.
            `radial-gradient(90rem 55rem at 8% -10%, hsl(${warm} 62% 52% / 0.20), transparent 60%)`,
            `radial-gradient(80rem 50rem at 96% 4%, hsl(${cool} 58% 48% / 0.16), transparent 58%)`,
            `radial-gradient(70rem 45rem at 50% 108%, hsl(${cool} 45% 40% / 0.12), transparent 62%)`,
          ].join(","),
        }}
      />

      {hasLandmark(city) ? (
        <Landmark
          city={city}
          className="absolute right-[-6%] bottom-[-8%] w-[52%] max-w-4xl text-[var(--ink)] opacity-[0.07]"
        />
      ) : null}
    </div>
  );
}
