"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@cityflow/ui";

import { detect, type Anomaly, type MotionSample } from "@/lib/motion";

/**
 * iOS Safari will not deliver devicemotion until the user has granted permission from
 * inside a gesture handler, and exposes that as a static method other browsers do not
 * have. Typed here rather than reached for through `any`.
 */
type MotionPermissionApi = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

interface Fix {
  t: number;
  lat: number;
  lon: number;
  speed: number | null;
}

interface Reading {
  lat: number;
  lon: number;
  magnitude: number;
  features: Anomaly["features"];
  recordedAt: string;
}

const ANALYSE_EVERY_MS = 5000;
const SEND_EVERY_MS = 30_000;

type State = "idle" | "asking" | "recording" | "unsupported" | "denied";

export function DefectReporter() {
  const [state, setState] = useState<State>("idle");
  const [rate, setRate] = useState(0);
  const [found, setFound] = useState(0);
  const [sent, setSent] = useState(0);
  const [defects, setDefects] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const samples = useRef<MotionSample[]>([]);
  const fixes = useRef<Fix[]>([]);
  const pending = useRef<Reading[]>([]);
  const started = useRef(0);
  const watch = useRef<number | null>(null);

  const send = useCallback(async () => {
    if (pending.current.length === 0) return;

    const batch = pending.current;
    pending.current = [];

    try {
      const response = await fetch("/api/anomalies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ readings: batch }),
      });

      if (!response.ok) {
        setError("Readings could not be sent. They have been discarded.");
        return;
      }

      const payload = (await response.json()) as { defectsCreated: number };
      setSent((count) => count + batch.length);
      setDefects((count) => count + payload.defectsCreated);
      setError(null);
    } catch {
      setError("No connection. Readings from the last stretch were discarded.");
    }
  }, []);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setState("idle");
    void send();
  }, [send]);

  useEffect(() => {
    if (state !== "recording") return;

    function onMotion(event: DeviceMotionEvent) {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const now = performance.now() - started.current;
      const fix = fixes.current[fixes.current.length - 1];

      samples.current.push({
        t: now,
        x: acceleration.x ?? 0,
        y: acceleration.y ?? 0,
        z: acceleration.z ?? 0,
        speed: fix?.speed ?? null,
      });
    }

    window.addEventListener("devicemotion", onMotion);

    const analyser = setInterval(() => {
      const batch = samples.current;
      samples.current = [];
      if (batch.length === 0) return;

      const seconds = (batch[batch.length - 1]!.t - batch[0]!.t) / 1000;
      setRate(seconds > 0 ? Math.round(batch.length / seconds) : 0);

      for (const anomaly of detect(batch)) {
        const where = nearestFix(fixes.current, anomaly.at);
        if (!where) continue;

        pending.current.push({
          lat: where.lat,
          lon: where.lon,
          magnitude: anomaly.magnitude,
          features: anomaly.features,
          recordedAt: new Date(
            Date.now() - (batch[batch.length - 1]!.t - anomaly.at),
          ).toISOString(),
        });
        setFound((count) => count + 1);
      }
    }, ANALYSE_EVERY_MS);

    const sender = setInterval(() => void send(), SEND_EVERY_MS);

    return () => {
      window.removeEventListener("devicemotion", onMotion);
      clearInterval(analyser);
      clearInterval(sender);
    };
  }, [state, send]);

  async function start() {
    setError(null);

    if (typeof DeviceMotionEvent === "undefined" || !("geolocation" in navigator)) {
      setState("unsupported");
      return;
    }

    const api = DeviceMotionEvent as MotionPermissionApi;
    if (typeof api.requestPermission === "function") {
      setState("asking");
      try {
        if ((await api.requestPermission()) !== "granted") {
          setState("denied");
          return;
        }
      } catch {
        setState("denied");
        return;
      }
    }

    started.current = performance.now();
    samples.current = [];
    fixes.current = [];

    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        fixes.current.push({
          t: performance.now() - started.current,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          speed: position.coords.speed,
        });
      },
      () => setError("Location stopped. Without it a jolt cannot be placed on a road."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );

    setState("recording");
  }

  return (
    <Card className="max-w-xl space-y-4">
      {state === "recording" ? (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sample rate" value={`${rate} Hz`} />
            <Stat label="Jolts found" value={String(found)} />
            <Stat label="Readings sent" value={String(sent)} />
            <Stat label="Defects opened" value={String(defects)} />
          </dl>
          <Button tone="secondary" onClick={stop}>
            Stop recording
          </Button>
        </>
      ) : (
        <>
          <Button onClick={start} disabled={state === "asking"}>
            {state === "asking" ? "Waiting for permission…" : "Start recording"}
          </Button>
          {state === "unsupported" ? (
            <p className="text-sm text-[var(--warn)]">
              This browser does not provide motion or location, so it cannot detect road
              defects. A phone in a vehicle is what this needs.
            </p>
          ) : null}
          {state === "denied" ? (
            <p className="text-sm text-[var(--warn)]">
              Motion access was declined. Nothing is recorded without it.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function nearestFix(fixes: Fix[], at: number): Fix | null {
  let best: Fix | null = null;
  let bestGap = Infinity;

  for (const fix of fixes) {
    const gap = Math.abs(fix.t - at);
    if (gap < bestGap) {
      bestGap = gap;
      best = fix;
    }
  }

  // A jolt more than five seconds from any position fix could be a hundred metres from
  // where it is claimed to be, and a defect report a crew cannot find is worse than no
  // report at all.
  return bestGap <= 5000 ? best : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
