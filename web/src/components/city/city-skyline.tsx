import type { CityCode } from "@/lib/cities";

/**
 * City skyline illustrations.
 *
 * WHY DRAWN INSTEAD OF PHOTOGRAPHED
 *  - photographs of real places carry licensing questions; these drawings do not
 *  - an SVG is a few kilobytes, so the page stays fast on a mobile connection
 *  - the artwork inherits our theme colours, so it works in light AND dark mode
 *    without shipping two versions of every image
 *
 * Each city is drawn in three depth layers (far / mid / near) at low opacity,
 * with a road in the foreground. The result is a calm background texture that
 * signals "this is your city" without ever competing with the text on top.
 *
 * All drawings share the same 1200 x 400 canvas so they are interchangeable.
 */

interface CitySkylineProps {
  city: CityCode;
  className?: string;
}

export function CitySkyline({ city, className }: CitySkylineProps) {
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      // Decorative only: the meaningful description lives on the wrapper element.
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Sky wash: fades from a tinted top into the page background. */}
        <linearGradient id="cf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cf-backdrop-sky-top)" />
          <stop offset="100%" stopColor="var(--cf-backdrop-sky-bottom)" />
        </linearGradient>

        {/* Fades the whole drawing out towards the top so text stays readable. */}
        <linearGradient id="cf-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="45%" stopColor="white" stopOpacity="0.75" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>

        <mask id="cf-fade-mask">
          <rect x="0" y="0" width="1200" height="400" fill="url(#cf-fade)" />
        </mask>
      </defs>

      <rect x="0" y="0" width="1200" height="400" fill="url(#cf-sky)" />

      <g mask="url(#cf-fade-mask)" fill="var(--cf-backdrop-ink)">
        <CityArtwork city={city} />
      </g>

      {/* Shared foreground: the road that every CityFlow AI city has in common. */}
      <Road />
    </svg>
  );
}

/* ========================================================================== */
/*  Individual city drawings                                                   */
/* ========================================================================== */

function CityArtwork({ city }: { city: CityCode }) {
  switch (city) {
    case "delhi":
      return <DelhiArtwork />;
    case "bengaluru":
      return <BengaluruArtwork />;
    case "mumbai":
      return <MumbaiArtwork />;
    case "hyderabad":
      return <HyderabadArtwork />;
    case "pune":
      return <PuneArtwork />;
    case "bhopal":
      return <BhopalArtwork />;
    case "chennai":
      return <ChennaiArtwork />;
    case "kolkata":
      return <KolkataArtwork />;
    default:
      return <DelhiArtwork />;
  }
}

/** Delhi — the India Gate arch on a wide, tree-lined boulevard. */
function DelhiArtwork() {
  return (
    <>
      {/* far layer: low government-style blocks */}
      <g opacity="0.14">
        <rect x="40" y="250" width="150" height="80" />
        <rect x="210" y="268" width="110" height="62" />
        <rect x="880" y="256" width="140" height="74" />
        <rect x="1040" y="272" width="120" height="58" />
      </g>

      {/* mid layer: the arch */}
      <g opacity="0.3">
        {/* plinth */}
        <rect x="520" y="316" width="160" height="14" />
        {/* body of the arch, with the opening cut out */}
        <path d="M545 316 V190 q0-34 55-34 t55 34 V316 h-30 V206 q0-24-25-24 t-25 24 V316 Z" />
        {/* cornice + crown */}
        <rect x="536" y="176" width="128" height="16" />
        <rect x="552" y="160" width="96" height="12" />
        <rect x="580" y="146" width="40" height="12" />
      </g>

      {/* near layer: avenue trees */}
      <g opacity="0.22">
        {[120, 200, 280, 360, 840, 920, 1000, 1080].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="300" width="6" height="30" />
            <circle cx={x} cy="292" r="22" />
          </g>
        ))}
      </g>
    </>
  );
}

/** Bengaluru — glass tech-park towers set behind a green arterial road. */
function BengaluruArtwork() {
  return (
    <>
      <g opacity="0.13">
        <rect x="60" y="210" width="90" height="120" />
        <rect x="170" y="245" width="70" height="85" />
        <rect x="980" y="225" width="100" height="105" />
      </g>

      <g opacity="0.28">
        {/* three towers with window grids */}
        {[
          { x: 330, y: 150, w: 110, h: 180 },
          { x: 470, y: 118, w: 130, h: 212 },
          { x: 630, y: 168, w: 100, h: 162 },
          { x: 760, y: 196, w: 120, h: 134 },
        ].map((tower) => (
          <g key={tower.x}>
            <rect x={tower.x} y={tower.y} width={tower.w} height={tower.h} />
            {/* window grid, punched out in the page background colour */}
            <g fill="var(--cf-backdrop-sky-bottom)" opacity="0.55">
              {Array.from({ length: Math.floor(tower.h / 26) }).map((_, row) =>
                Array.from({ length: Math.floor(tower.w / 26) }).map((__, col) => (
                  <rect
                    key={`${row}-${col}`}
                    x={tower.x + 10 + col * 26}
                    y={tower.y + 14 + row * 26}
                    width="11"
                    height="13"
                  />
                ))
              )}
            </g>
          </g>
        ))}
      </g>

      {/* near layer: broad canopy trees along the road */}
      <g opacity="0.24">
        {[90, 175, 260, 940, 1030, 1120].map((x) => (
          <g key={x}>
            <rect x={x - 4} y="296" width="8" height="34" />
            <ellipse cx={x} cy="286" rx="32" ry="24" />
          </g>
        ))}
      </g>
    </>
  );
}

/** Mumbai — the Marine Drive curve in front of a dense skyline. */
function MumbaiArtwork() {
  return (
    <>
      <g opacity="0.13">
        <rect x="700" y="196" width="80" height="134" />
        <rect x="800" y="226" width="70" height="104" />
      </g>

      <g opacity="0.28">
        {[
          { x: 60, y: 176, w: 62, h: 154 },
          { x: 134, y: 128, w: 54, h: 202 },
          { x: 200, y: 200, w: 70, h: 130 },
          { x: 282, y: 104, w: 58, h: 226 },
          { x: 352, y: 168, w: 76, h: 162 },
          { x: 440, y: 142, w: 52, h: 188 },
          { x: 504, y: 208, w: 66, h: 122 },
          { x: 582, y: 156, w: 58, h: 174 },
          { x: 900, y: 186, w: 64, h: 144 },
          { x: 976, y: 148, w: 50, h: 182 },
          { x: 1038, y: 210, w: 72, h: 120 },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} />
        ))}
      </g>

      {/* the promenade curve + sea */}
      <g opacity="0.2">
        <path d="M0 356 Q 300 300 640 322 T 1200 300 V400 H0 Z" />
      </g>
      <g opacity="0.14">
        <path d="M60 340 h120 M240 332 h140 M440 330 h110 M640 328 h150 M860 318 h120" stroke="var(--cf-backdrop-ink)" strokeWidth="3" fill="none" />
      </g>
    </>
  );
}

/** Hyderabad — the Charminar's four minarets beside modern towers. */
function HyderabadArtwork() {
  return (
    <>
      <g opacity="0.13">
        <rect x="80" y="220" width="110" height="110" />
        <rect x="960" y="200" width="90" height="130" />
        <rect x="1070" y="238" width="80" height="92" />
      </g>

      <g opacity="0.3">
        {/* main square block with four arched openings */}
        <rect x="500" y="230" width="200" height="100" />
        <g fill="var(--cf-backdrop-sky-bottom)" opacity="0.7">
          <path d="M528 330 V276 q22-26 44 0 V330 Z" />
          <path d="M628 330 V276 q22-26 44 0 V330 Z" />
        </g>
        <rect x="492" y="214" width="216" height="18" />

        {/* four minarets */}
        {[500, 560, 640, 700].map((x, index) => {
          const isCorner = index === 0 || index === 3;
          const top = isCorner ? 120 : 150;
          return (
            <g key={x}>
              <rect x={x - 10} y={top} width="20" height={214 - top} />
              <rect x={x - 16} y={top - 10} width="32" height="10" />
              {/* small dome */}
              <path d={`M${x - 12} ${top - 10} q12 -26 24 0 Z`} />
              <rect x={x - 2} y={top - 44} width="4" height="18" />
            </g>
          );
        })}
      </g>

      <g opacity="0.2">
        {[160, 250, 1000, 1090].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="302" width="6" height="28" />
            <circle cx={x} cy="294" r="20" />
          </g>
        ))}
      </g>
    </>
  );
}

/** Pune — green hills rising behind a wide urban road. */
function PuneArtwork() {
  return (
    <>
      {/* far hills */}
      <g opacity="0.12">
        <path d="M0 300 Q 160 180 330 258 T 660 226 Q 860 170 1050 244 T 1200 220 V400 H0 Z" />
      </g>
      <g opacity="0.18">
        <path d="M0 330 Q 220 246 430 300 T 820 288 Q 1010 246 1200 296 V400 H0 Z" />
      </g>

      {/* mid-rise buildings tucked into the valley */}
      <g opacity="0.26">
        {[
          { x: 380, y: 244, w: 66, h: 86 },
          { x: 458, y: 216, w: 54, h: 114 },
          { x: 524, y: 254, w: 72, h: 76 },
          { x: 610, y: 228, w: 58, h: 102 },
          { x: 682, y: 258, w: 64, h: 72 },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} />
        ))}
      </g>

      <g opacity="0.24">
        {[110, 190, 270, 900, 990, 1080].map((x) => (
          <g key={x}>
            <rect x={x - 4} y="298" width="8" height="32" />
            <ellipse cx={x} cy="288" rx="28" ry="22" />
          </g>
        ))}
      </g>
    </>
  );
}

/** Bhopal — the Upper Lake with a bridge and a green city edge. */
function BhopalArtwork() {
  return (
    <>
      <g opacity="0.12">
        <path d="M0 288 Q 200 220 420 268 T 820 250 Q 1010 214 1200 262 V400 H0 Z" />
      </g>

      {/* city edge on the far bank */}
      <g opacity="0.24">
        {[
          { x: 120, y: 244, w: 54, h: 60 },
          { x: 186, y: 226, w: 44, h: 78 },
          { x: 242, y: 252, w: 60, h: 52 },
          { x: 880, y: 238, w: 50, h: 66 },
          { x: 942, y: 220, w: 42, h: 84 },
          { x: 996, y: 250, w: 58, h: 54 },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} />
        ))}
      </g>

      {/* causeway / bridge across the lake */}
      <g opacity="0.28">
        <rect x="330" y="292" width="540" height="10" />
        {[360, 450, 540, 630, 720, 810].map((x) => (
          <rect key={x} x={x} y="302" width="8" height="26" />
        ))}
      </g>

      {/* lake surface with reflection lines */}
      <g opacity="0.16">
        <rect x="0" y="330" width="1200" height="70" />
      </g>
      <g opacity="0.22" stroke="var(--cf-backdrop-sky-bottom)" strokeWidth="3" fill="none">
        <path d="M120 346 h150 M320 358 h210 M600 344 h180 M840 360 h190 M200 372 h260 M620 374 h230" />
      </g>
    </>
  );
}

/** Chennai — the Marina coastline with the lighthouse. */
function ChennaiArtwork() {
  return (
    <>
      <g opacity="0.13">
        <rect x="90" y="238" width="86" height="92" />
        <rect x="196" y="256" width="66" height="74" />
        <rect x="960" y="244" width="92" height="86" />
      </g>

      {/* lighthouse */}
      <g opacity="0.3">
        <path d="M560 330 V178 l16 -0 V330 Z" />
        <path d="M548 330 L560 178 h20 l12 152 Z" />
        <rect x="542" y="164" width="56" height="16" />
        <rect x="554" y="142" width="32" height="24" />
        <path d="M552 142 q18 -22 36 0 Z" />
      </g>

      {/* low shoreline buildings */}
      <g opacity="0.24">
        {[
          { x: 640, y: 262, w: 70, h: 68 },
          { x: 722, y: 244, w: 54, h: 86 },
          { x: 788, y: 268, w: 78, h: 62 },
        ].map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} />
        ))}
      </g>

      {/* sea + waves */}
      <g opacity="0.15">
        <path d="M0 344 Q 300 322 620 340 T 1200 328 V400 H0 Z" />
      </g>
      <g opacity="0.2" stroke="var(--cf-backdrop-sky-bottom)" strokeWidth="3" fill="none">
        <path d="M80 360 q20 -8 40 0 t40 0 M320 370 q20 -8 40 0 t40 0 M700 358 q20 -8 40 0 t40 0 M960 368 q20 -8 40 0 t40 0" />
      </g>
    </>
  );
}

/** Kolkata — the Howrah Bridge cantilever crossing the river. */
function KolkataArtwork() {
  return (
    <>
      <g opacity="0.12">
        <rect x="60" y="248" width="90" height="82" />
        <rect x="1060" y="242" width="86" height="88" />
      </g>

      <g opacity="0.3">
        {/* two towers */}
        {[330, 870].map((x) => (
          <g key={x}>
            <rect x={x - 16} y="140" width="12" height="190" />
            <rect x={x + 4} y="140" width="12" height="190" />
            <rect x={x - 20} y="140" width="40" height="10" />
            <rect x={x - 20} y="196" width="40" height="8" />
            <rect x={x - 20} y="252" width="40" height="8" />
          </g>
        ))}

        {/* deck */}
        <rect x="150" y="290" width="900" height="12" />

        {/* cantilever truss: a sagging suspension line plus diagonals */}
        <path
          d="M150 250 L330 150 L600 214 L870 150 L1050 250"
          fill="none"
          stroke="var(--cf-backdrop-ink)"
          strokeWidth="8"
        />
        <g stroke="var(--cf-backdrop-ink)" strokeWidth="4" fill="none">
          {[390, 450, 510, 570, 630, 690, 750, 810].map((x) => {
            // Straight line between the two tower tops, sagging in the middle.
            const t = (x - 330) / (870 - 330);
            const y = 150 + Math.sin(Math.PI * t) * 64;
            return <path key={x} d={`M${x} ${y} V290`} />;
          })}
        </g>
      </g>

      {/* river */}
      <g opacity="0.15">
        <rect x="0" y="330" width="1200" height="70" />
      </g>
      <g opacity="0.2" stroke="var(--cf-backdrop-sky-bottom)" strokeWidth="3" fill="none">
        <path d="M100 350 h180 M360 364 h220 M660 350 h200 M900 366 h200" />
      </g>
    </>
  );
}

/* ========================================================================== */
/*  Shared foreground                                                          */
/* ========================================================================== */

/** The road strip every city shares — CityFlow AI is, after all, about roads. */
function Road() {
  return (
    <g>
      <rect x="0" y="368" width="1200" height="32" fill="var(--cf-backdrop-ink)" opacity="0.1" />
      {/* dashed centre line */}
      <g fill="var(--cf-backdrop-ink)" opacity="0.22">
        {Array.from({ length: 24 }).map((_, index) => (
          <rect key={index} x={index * 52} width="30" y="382" height="4" rx="2" />
        ))}
      </g>
    </g>
  );
}
