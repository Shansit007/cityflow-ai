"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@cityflow/ui";

export interface SavedRoutine {
  id: string;
  label: string;
  origin_cell: string;
  destination_cell: string;
  days_of_week: number[];
  arrive_by: string;
  mode: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeDays(days: number[]): string {
  const weekdays = [1, 2, 3, 4, 5];
  const sorted = [...days].sort();
  if (sorted.join() === weekdays.join()) return "Weekdays";
  if (sorted.length === 7) return "Every day";
  return sorted.map((day) => DAY_NAMES[day]).join(", ");
}

export function RoutineList({ routines }: { routines: SavedRoutine[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(id: string) {
    setRemoving(id);
    try {
      const response = await fetch(`/api/routines?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (response.ok) router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <ul className="space-y-3">
      {routines.map((routine) => (
        <li key={routine.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium">{routine.label}</h3>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {describeDays(routine.days_of_week)}, arrive by{" "}
                  {routine.arrive_by.slice(0, 5)}
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--ink-faint)]">
                  {routine.origin_cell} &rarr; {routine.destination_cell}
                </p>
              </div>
              <Button
                tone="quiet"
                onClick={() => remove(routine.id)}
                disabled={removing === routine.id}
              >
                {removing === routine.id ? "Removing…" : "Remove"}
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
