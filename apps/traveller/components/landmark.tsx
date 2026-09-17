import type { ReactNode } from "react";

/**
 * A line drawing of something the city is known for.
 *
 * Drawn here from primitives rather than photographed: a stock photograph of a monument
 * needs a licence that permits redistribution, fights with the text laid over it, and
 * has to be dimmed until it is mush. These are a few hundred bytes each, sharp at any
 * size, take the surrounding text colour, and belong to this project.
 *
 * They are stylised, not architectural drawings, and are decoration rather than a claim
 * that any of these institutions has anything to do with CityFlow.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 100" className="h-full w-full" aria-hidden="true">
      <g {...STROKE}>{children}</g>
    </svg>
  );
}

/** India Gate: a single deep arch on a wide plinth. */
function IndiaGate() {
  return (
    <Frame>
      <path d="M60 95 h80 M66 95 V38 M134 95 V38" />
      <path d="M66 38 a34 34 0 0 1 68 0" />
      <path d="M78 95 V46 a22 22 0 0 1 44 0 V95" />
      <path d="M58 38 h84 M56 32 h88 M62 26 h76" />
      <path d="M92 26 v-8 h16 v8" />
    </Frame>
  );
}

/** Vidhana Soudha: a long colonnaded front under a central dome. */
function VidhanaSoudha() {
  return (
    <Frame>
      <path d="M20 95 h160 M28 95 V58 M172 95 V58 M24 58 h152" />
      {[44, 60, 76, 124, 140, 156].map((x) => (
        <path key={x} d={`M${x} 95 V62`} />
      ))}
      <path d="M86 95 V52 M114 95 V52 M82 52 h36" />
      <path d="M84 52 a16 16 0 0 1 32 0" />
      <path d="M100 36 v-7 M96 29 h8" />
      <path d="M14 95 h172" />
    </Frame>
  );
}

/** Gateway of India: a broad arch flanked by two turrets. */
function GatewayOfIndia() {
  return (
    <Frame>
      <path d="M46 95 h108 M62 95 V40 M138 95 V40" />
      <path d="M62 40 h76 M58 34 h84" />
      <path d="M80 95 V54 a20 20 0 0 1 40 0 V95" />
      <path d="M62 40 V24 h-10 V40 M138 40 V24 h10 V40" />
      <path d="M52 24 a6 6 0 0 1 10 0 M138 24 a6 6 0 0 1 10 0" />
      <path d="M86 34 a14 14 0 0 1 28 0" />
    </Frame>
  );
}

/** Charminar: four minarets around a two-storey arcade. */
function Charminar() {
  return (
    <Frame>
      <path d="M50 95 h100 M58 95 V44 M142 95 V44 M54 44 h92" />
      <path d="M74 95 V62 a12 12 0 0 1 24 0 V95 M102 95 V62 a12 12 0 0 1 24 0 V95" />
      <path d="M58 44 V22 M70 44 V22 M130 44 V22 M142 44 V22" />
      <path d="M58 22 a6 6 0 0 1 12 0 M130 22 a6 6 0 0 1 12 0" />
      <path d="M64 16 v-5 M136 16 v-5" />
      <path d="M86 44 a14 14 0 0 1 28 0" />
    </Frame>
  );
}

/** Howrah Bridge: a cantilever truss over the Hooghly. */
function HowrahBridge() {
  return (
    <Frame>
      <path d="M10 78 h180 M24 78 V34 M176 78 V34" />
      <path d="M24 34 h152" />
      <path d="M24 34 L60 58 L100 44 L140 58 L176 34" />
      <path d="M60 58 V78 M100 44 V78 M140 58 V78" />
      <path d="M24 46 L60 58 M176 46 L140 58" />
      <path d="M10 88 h180 M10 94 h180" />
    </Frame>
  );
}

/** Hawa Mahal: a tall honeycomb facade stepping up to a crown. */
function HawaMahal() {
  return (
    <Frame>
      <path d="M40 95 h120 M48 95 V30 M152 95 V30" />
      <path d="M44 30 h112 M52 30 V20 h96 V30" />
      {[38, 52, 66].map((y) => (
        <path key={y} d={`M48 ${y} h104`} />
      ))}
      {[62, 78, 94, 110, 126, 142].map((x) => (
        <path key={x} d={`M${x} 95 V34`} />
      ))}
      <path d="M70 20 a8 8 0 0 1 16 0 M92 20 a8 8 0 0 1 16 0 M114 20 a8 8 0 0 1 16 0" />
    </Frame>
  );
}

/** Napier Bridge: the arches on the way into Chennai. */
function NapierBridge() {
  return (
    <Frame>
      <path d="M10 70 h180 M10 80 h180" />
      <path d="M30 70 a26 26 0 0 1 52 0 M118 70 a26 26 0 0 1 52 0" />
      <path d="M82 70 a18 18 0 0 1 36 0" />
      <path d="M30 70 V88 M82 70 V88 M118 70 V88 M170 70 V88" />
      <path d="M10 88 h180" />
    </Frame>
  );
}

/** Shaniwar Wada: the fortified gate at Pune. */
function ShaniwarWada() {
  return (
    <Frame>
      <path d="M36 95 h128 M46 95 V36 M154 95 V36 M42 36 h116" />
      <path d="M86 95 V56 a14 14 0 0 1 28 0 V95" />
      <path d="M46 36 V24 M66 36 V24 M134 36 V24 M154 36 V24" />
      <path d="M42 24 h20 M138 24 h20" />
      <path d="M46 20 a10 10 0 0 1 20 0 M134 20 a10 10 0 0 1 20 0" />
    </Frame>
  );
}

/** Sidi Saiyyed jali: the tree-of-life lattice of Ahmedabad. */
function SidiSaiyyed() {
  return (
    <Frame>
      <path d="M50 95 h100 M58 95 V40 M142 95 V40" />
      <path d="M58 40 a42 42 0 0 1 84 0" />
      <path d="M100 95 V54" />
      <path d="M100 66 c-16 -4 -24 -14 -26 -26 M100 66 c16 -4 24 -14 26 -26" />
      <path d="M100 78 c-12 -3 -18 -11 -20 -20 M100 78 c12 -3 18 -11 20 -20" />
      <path d="M100 54 c-8 -6 -10 -14 -10 -20 M100 54 c8 -6 10 -14 10 -20" />
    </Frame>
  );
}

const LANDMARKS: Record<string, () => ReactNode> = {
  DEL: IndiaGate,
  BLR: VidhanaSoudha,
  BOM: GatewayOfIndia,
  HYD: Charminar,
  CCU: HowrahBridge,
  JAI: HawaMahal,
  MAA: NapierBridge,
  PNQ: ShaniwarWada,
  AMD: SidiSaiyyed,
};

export function hasLandmark(city: string): boolean {
  return city in LANDMARKS;
}

export function Landmark({ city, className }: { city: string; className?: string }) {
  const Drawing = LANDMARKS[city];
  if (!Drawing) return null;

  return <div className={className}>{Drawing()}</div>;
}
