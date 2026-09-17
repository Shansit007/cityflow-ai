import type { Window } from "@/lib/pressure";

const HEIGHT = 120;
const GAP = 2;
const RADIUS = 4;

/**
 * Segments over capacity, by quarter hour.
 *
 * One series, so there is no legend: the heading names it. Rendered as plain SVG on the
 * server rather than through a charting library, because this is nine numbers and a
 * commuter on a slow connection should not download a plotting runtime to read them.
 * The table underneath is not a fallback for failure, it is the same data for anyone
 * who cannot use the picture.
 */
export function PressureChart({
  windows,
  now,
}: {
  windows: Window[];
  now: Window | null;
}) {
  if (windows.length === 0) return null;

  const peak = Math.max(...windows.map((window) => window.over), 1);
  const width = 100;
  const slot = width / windows.length;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={`Segments over capacity by quarter hour, peaking at ${peak}`}
      >
        {windows.map((window, index) => {
          const height = (window.over / peak) * (HEIGHT - 8);
          const current = now !== null && window.at === now.at;
          return (
            <rect
              key={window.startsAt.toISOString()}
              x={index * slot + GAP / 2}
              y={HEIGHT - height}
              width={Math.max(slot - GAP, 0.5)}
              height={height}
              rx={RADIUS}
              fill={current ? "var(--accent)" : "var(--line-strong)"}
            >
              <title>
                {window.at}: {window.over.toLocaleString()} of{" "}
                {window.measured.toLocaleString()} segments over capacity
              </title>
            </rect>
          );
        })}
      </svg>

      <figcaption className="mt-2 flex justify-between text-xs text-[var(--ink-muted)]">
        <span>{windows[0]!.at}</span>
        <span>peak {peak.toLocaleString()}</span>
        <span>{windows[windows.length - 1]!.at}</span>
      </figcaption>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-[var(--ink-muted)]">
          Show these numbers as a table
        </summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--ink-muted)]">
              <th scope="col" className="py-1 font-medium">
                Quarter hour
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Over capacity
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Measured
              </th>
            </tr>
          </thead>
          <tbody>
            {windows.map((window) => (
              <tr
                key={window.startsAt.toISOString()}
                className="border-t border-[var(--line)]"
              >
                <td className="py-1">{window.at}</td>
                <td className="py-1 text-right tabular-nums">
                  {window.over.toLocaleString()}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {window.measured.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
