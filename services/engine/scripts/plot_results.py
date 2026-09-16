"""Draw the charts docs/engine.md and the README show, from the sweep's own output.

Reads docs/results/sweep-<city>.json and writes docs/images/. Nothing here computes a
result; if a number in the documentation cannot be traced to that file, it should not
be in the documentation.
"""

import argparse
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402  (backend must be set before pyplot)
import matplotlib.patheffects as path_effects  # noqa: E402

# Two series, checked for colour-vision separation rather than chosen by eye: this
# pair measures dE 24.7 under protanopia and 33.6 under normal vision against the
# chart surface below.
COORDINATED = "#2a78d6"
NAIVE = "#eb6834"

SURFACE = "#fcfcfb"
INK = "#1a1a19"
MUTED = "#6b6a63"
GRID = "#e4e3dd"

plt.rcParams.update(
    {
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "axes.edgecolor": GRID,
        "axes.labelcolor": MUTED,
        "text.color": INK,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.titleweight": "bold",
        "figure.dpi": 160,
    }
)


def style(axes) -> None:
    """Recessive axes: one horizontal grid, no box, nothing competing with the data."""
    axes.grid(axis="y", color=GRID, linewidth=1)
    axes.set_axisbelow(True)
    for side in ("top", "right", "left"):
        axes.spines[side].set_visible(False)
    axes.spines["bottom"].set_color(GRID)
    axes.tick_params(length=0)


def outlined(text) -> None:
    """A thin surface-coloured stroke so a label stays legible over a gridline."""
    text.set_path_effects(
        [path_effects.withStroke(linewidth=3, foreground=SURFACE)]
    )


def adoption_chart(data: dict, field: str, title: str, ylabel: str, path: Path) -> None:
    levels = data["levels"]
    # Evenly spaced positions, not the adoption value. The levels are a chosen set and
    # 0, 1 and 5 percent sit on top of each other on a linear axis.
    positions = list(range(len(levels)))
    labels = [f"{level['adoption']:.0%}" for level in levels]
    coordinated = [level[field] for level in levels]
    naive = [level[f"naive_{field}"] for level in levels]
    baseline = data[f"baseline_{field}"]

    figure, axes = plt.subplots(figsize=(6.6, 3.9))
    style(axes)

    axes.axhline(baseline, color=MUTED, linewidth=1.5, linestyle=(0, (4, 4)))
    outlined(
        axes.annotate(
            "nobody shifts",
            xy=(positions[-1], baseline),
            xytext=(-2, 6),
            textcoords="offset points",
            ha="right",
            fontsize=9,
            color=MUTED,
        )
    )

    axes.plot(positions, naive, color=NAIVE, linewidth=2, marker="o", markersize=5)
    axes.plot(
        positions, coordinated, color=COORDINATED, linewidth=2, marker="o", markersize=5
    )

    # Direct labels on the last point rather than a number on every one, anchored
    # clear of their own line.
    for values, colour, label, offset in (
        (naive, NAIVE, "each traveller advised alone", 20),
        (coordinated, COORDINATED, "capacity-aware allocation", -20),
    ):
        outlined(
            axes.annotate(
                label,
                xy=(positions[-1], values[-1]),
                xytext=(-4, offset),
                textcoords="offset points",
                ha="right",
                fontsize=9,
                color=colour,
                fontweight="bold",
            )
        )

    axes.set_title(title)
    axes.set_xlabel("Share of travellers using CityFlow")
    axes.set_ylabel(ylabel)
    axes.set_xticks(positions)
    axes.set_xticklabels(labels)
    axes.set_ylim(bottom=0, top=max(baseline, max(naive)) * 1.12)

    figure.tight_layout()
    figure.savefig(path)
    plt.close(figure)


def shift_chart(data: dict, adoption: float, path: Path) -> None:
    level = next(
        entry for entry in data["levels"] if entry["adoption"] == adoption
    )
    buckets = level["shift_histogram"]
    # Ranges, not "10 or less": these are exclusive bands and a cumulative-sounding
    # label would overstate every bucket after the first.
    labels = []
    lower = 0
    for bucket in buckets:
        upper = bucket["upto_minutes"]
        if upper is None:
            labels.append(f"over {lower}")
        else:
            labels.append(f"up to {upper}" if lower == 0 else f"{lower}–{upper}")
            lower = upper
    counts = [bucket["travellers"] for bucket in buckets]

    figure, axes = plt.subplots(figsize=(6.4, 3.4))
    style(axes)
    axes.grid(axis="y", visible=False)
    axes.grid(axis="x", color=GRID, linewidth=1)

    axes.barh(labels, counts, color=COORDINATED, height=0.62)
    axes.invert_yaxis()

    # An empty bucket is a result, not a gap: "over 45: 0" is the claim that nobody
    # was pushed past three quarters of an hour.
    for label, count in zip(labels, counts, strict=True):
        axes.annotate(
            f"{count:,}",
            xy=(count, label),
            xytext=(5, 0),
            textcoords="offset points",
            va="center",
            fontsize=9,
            color=MUTED,
        )

    axes.set_title(
        f"How far travellers were asked to move, at {adoption:.0%} adoption"
    )
    axes.set_xlabel("Travellers")
    axes.set_ylabel("Minutes from their usual departure")
    axes.set_xlim(right=max(counts) * 1.18 if counts else 1)

    figure.tight_layout()
    figure.savefig(path)
    plt.close(figure)


def inflow_chart(data: dict, adoption: float, path: Path) -> None:
    level = next(
        entry for entry in data["levels"] if entry["adoption"] == adoption
    )
    before = data["baseline_inflow_at_busiest"]
    after = level["inflow_at_busiest"]
    capacity = data["busiest_capacity_per_window"]

    windows = sorted(set(before) | set(after))
    before_counts = [before.get(window, 0) for window in windows]
    after_counts = [after.get(window, 0) for window in windows]

    figure, axes = plt.subplots(figsize=(6.8, 3.8))
    style(axes)

    positions = range(len(windows))
    width = 0.4
    axes.bar([p - width / 2 for p in positions], before_counts, width * 0.94,
             color=NAIVE, label="before")
    axes.bar([p + width / 2 for p in positions], after_counts, width * 0.94,
             color=COORDINATED, label="after allocation")

    axes.axhline(capacity, color=MUTED, linewidth=1.5, linestyle=(0, (4, 4)))
    # The label rides the right end of the line because the early windows are the
    # tall ones; anchoring it left puts it inside the 08:00 bar.
    outlined(
        axes.annotate(
            f"capacity {capacity:.0f}",
            xy=(len(windows) - 0.55, capacity),
            xytext=(-2, 5),
            textcoords="offset points",
            ha="right",
            fontsize=9,
            color=MUTED,
        )
    )

    axes.set_xticks(list(positions))
    axes.set_xticklabels(windows, rotation=45, ha="right", fontsize=8)
    axes.set_title(
        f"Vehicles entering the most oversubscribed segment\n"
        f"{data['busiest_segment']} · {adoption:.0%} adoption"
    )
    axes.set_xlabel("Quarter hour")
    axes.set_ylabel("Vehicles entering")
    axes.legend(frameon=False, loc="upper right", fontsize=9)

    figure.tight_layout()
    figure.savefig(path)
    plt.close(figure)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--results", default=Path("../../docs/results"), type=Path)
    parser.add_argument("--images", default=Path("../../docs/images"), type=Path)
    parser.add_argument("--adoption", type=float, default=0.20)
    arguments = parser.parse_args()

    source = arguments.results / f"sweep-{arguments.city.lower()}.json"
    if not source.exists():
        print(f"no sweep results at {source}; run scripts/run_sweep.py", file=sys.stderr)
        return 2

    data = json.loads(source.read_text())
    arguments.images.mkdir(parents=True, exist_ok=True)

    adoption_chart(
        data,
        "excess_vehicles",
        "Vehicles over segment capacity, by adoption",
        "Vehicles above capacity",
        arguments.images / "adoption-excess.png",
    )
    adoption_chart(
        data,
        "overloaded_windows",
        "Oversubscribed segment-quarter-hours, by adoption",
        "Segment-windows over capacity",
        arguments.images / "adoption-windows.png",
    )
    shift_chart(data, arguments.adoption, arguments.images / "shift-distribution.png")
    inflow_chart(data, arguments.adoption, arguments.images / "inflow-busiest.png")

    print(f"wrote 4 charts to {arguments.images}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
