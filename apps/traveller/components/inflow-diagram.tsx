const WINDOWS = 9;
const BAR = 18;
const GAP = 8;
const HEIGHT = 92;
const CAPACITY = 58;

// Relative heights only. This is a drawing of the mechanism, not a measurement, so it
// carries no axis and no figures: a chart with numbers on it in a product page is a
// claim, and the measured ones live in docs/engine.md where their script can be read.
const CROWDED = [12, 26, 48, 78, 88, 72, 44, 22, 10];
const SPREAD = [30, 42, 52, 56, 57, 56, 50, 40, 28];

function Panel({ values, label }: { values: number[]; label: string }) {
  const width = WINDOWS * BAR + (WINDOWS - 1) * GAP;

  return (
    <figure className="min-w-0 flex-1">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT + 10}`}
        className="w-full"
        role="img"
        aria-label={label}
      >
        {values.map((value, index) => {
          const over = value > CAPACITY;
          return (
            <rect
              key={index}
              x={index * (BAR + GAP)}
              y={HEIGHT - value}
              width={BAR}
              height={value}
              rx="2"
              fill={over ? "var(--warn)" : "var(--accent)"}
              opacity={over ? 0.9 : 0.55}
            />
          );
        })}
        <line
          x1="0"
          x2={width}
          y1={HEIGHT - CAPACITY}
          y2={HEIGHT - CAPACITY}
          stroke="var(--ink-muted)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <text
          x="0"
          y={HEIGHT - CAPACITY - 5}
          fontSize="9"
          fill="var(--ink-muted)"
          letterSpacing="0.06em"
        >
          CAPACITY
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-[var(--ink-muted)]">{label}</figcaption>
    </figure>
  );
}

/** The product thesis as a picture: same journeys, different arrival rate. */
export function InflowDiagram() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
      <Panel
        values={CROWDED}
        label="Everyone leaves at the usual time. The middle windows overflow, and the
          overflow is the jam."
      />
      <Panel
        values={SPREAD}
        label="The same journeys, departures nudged by minutes. Nothing exceeds what the
          road absorbs."
      />
    </div>
  );
}
