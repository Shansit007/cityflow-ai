"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/input";
import { isPlausibleCoordinate } from "@/lib/roads/cell";

/**
 * Road-impact detection using the phone's motion sensors.
 *
 * ============================ HOW THIS WORKS ================================
 * The browser fires a `devicemotion` event many times a second with the
 * acceleration the phone is feeling, gravity included. When a vehicle drops
 * into a pothole the total acceleration spikes well above the steady ~9.81 m/s²
 * of gravity. This component watches for those spikes and, when one happens
 * while the phone is genuinely moving, records the place.
 *
 * ========================= WHAT IT CANNOT DO ================================
 * An accelerometer does not know what it hit. A speed breaker, a kerb, a
 * railway crossing, a pothole and the phone sliding off a seat all look alike
 * to it. So nothing here is ever called a pothole: every recording is a
 * "possible road impact", it is stored as weak evidence (half the weight of a
 * person who filled in a form), and it takes several independent detections at
 * the same place before the system will even call it likely.
 *
 * The magnitude of the jolt is recorded but is NOT turned into a severity.
 * How hard a bump feels depends on the vehicle's suspension, the phone's
 * mounting and the speed as much as on the road, so converting it into
 * "dangerous" would be inventing a measurement.
 *
 * ============================ REQUIREMENTS ==================================
 *  - HTTPS. Motion and location sensors are unavailable on plain HTTP, which
 *    is why this cannot be tested on http://localhost from a phone.
 *  - iOS 13+ requires an explicit permission prompt triggered by a real tap.
 *    That is why there is a button rather than automatic start.
 *  - The screen must stay on; browsers throttle sensors in a background tab.
 *    A native app would not have this limit. This is a real weakness of doing
 *    it in a web page and it is stated on screen rather than hidden.
 * ============================================================================
 */

/** Total acceleration above gravity, in m/s², that counts as an impact. */
const IMPACT_THRESHOLD = 4.5;

/** Ignore further spikes for this long, so one pothole is one detection. */
const DEBOUNCE_MS = 2_000;

/** Below this speed the phone is probably not in a moving vehicle. */
const MIN_SPEED_MPS = 2;

/** Never collect more than this in one trip — beyond it, something is wrong. */
const MAX_DETECTIONS = 30;

interface Detection {
  lat: number;
  lng: number;
  magnitude: number;
  areaLabel: string;
}

type State = "idle" | "unsupported" | "running" | "sending" | "sent" | "error";

export function RoadImpactDetector({ areaLabel }: { areaLabel: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [peak, setPeak] = useState(0);
  const [moving, setMoving] = useState<boolean | null>(null);

  // Refs, not state: these change many times a second and must never re-render.
  const lastImpactAt = useRef(0);
  const position = useRef<{ lat: number; lng: number; speed: number | null } | null>(null);
  const watchId = useRef<number | null>(null);
  const detectionsRef = useRef<Detection[]>([]);
  const areaRef = useRef(areaLabel);
  areaRef.current = areaLabel;

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    const { x = 0, y = 0, z = 0 } = acceleration;
    const total = Math.sqrt((x ?? 0) ** 2 + (y ?? 0) ** 2 + (z ?? 0) ** 2);

    // Gravity is always present, so what matters is the departure from it.
    const jolt = Math.abs(total - 9.81);

    setPeak((current) => Math.max(current, Math.round(jolt * 10) / 10));

    if (jolt < IMPACT_THRESHOLD) return;

    const now = Date.now();
    if (now - lastImpactAt.current < DEBOUNCE_MS) return;

    const fix = position.current;
    if (!fix || !isPlausibleCoordinate(fix.lat, fix.lng)) return;

    /*
      Only count a jolt while the phone is actually travelling. Without this,
      putting the phone down on a table registers as a pothole — and a false
      road issue in a citizen-facing system is worse than a missed one.
      A browser that does not report speed (many do not) gets the benefit of the
      doubt, because refusing every detection there would switch the feature off
      for a large share of phones.
    */
    if (fix.speed !== null && fix.speed < MIN_SPEED_MPS) return;

    if (detectionsRef.current.length >= MAX_DETECTIONS) return;

    lastImpactAt.current = now;

    const detection: Detection = {
      lat: fix.lat,
      lng: fix.lng,
      magnitude: Math.round(jolt * 100) / 100,
      areaLabel: areaRef.current,
    };

    detectionsRef.current = [...detectionsRef.current, detection];
    setDetections(detectionsRef.current);
  }, []);

  /** Always leave the phone's sensors switched off when this unmounts. */
  const stopSensors = useCallback(() => {
    window.removeEventListener("devicemotion", handleMotion);
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, [handleMotion]);

  useEffect(() => stopSensors, [stopSensors]);

  async function start() {
    setMessage(null);

    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      setState("unsupported");
      setMessage(
        "This device or browser does not provide motion sensors. Road sensing needs a phone, and the page must be served over HTTPS."
      );
      return;
    }

    if (!navigator.geolocation) {
      setState("unsupported");
      setMessage("This browser cannot provide a location, so a detection could not be placed on a map.");
      return;
    }

    /*
      iOS 13+ gates motion sensors behind a permission prompt that only appears
      when requested directly from a user gesture — which is why this lives in
      the button handler and not in an effect.
    */
    const requestPermission = (
      DeviceMotionEvent as unknown as { requestPermission?: () => Promise<PermissionState> }
    ).requestPermission;

    if (typeof requestPermission === "function") {
      try {
        const outcome = await requestPermission();
        if (outcome !== "granted") {
          setState("error");
          setMessage(
            "Motion access was not granted. You can still report road issues using the form below."
          );
          return;
        }
      } catch {
        setState("error");
        setMessage(
          "Motion access could not be requested. This usually means the page is not on HTTPS."
        );
        return;
      }
    }

    detectionsRef.current = [];
    setDetections([]);
    setPeak(0);
    setMoving(null);
    lastImpactAt.current = 0;

    watchId.current = navigator.geolocation.watchPosition(
      (fix) => {
        position.current = {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          speed: typeof fix.coords.speed === "number" ? fix.coords.speed : null,
        };
        setMoving(fix.coords.speed === null ? null : fix.coords.speed >= MIN_SPEED_MPS);
      },
      () => {
        setMessage(
          "Location is not available, so detections cannot be placed. Road sensing has stopped."
        );
        stop(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );

    window.addEventListener("devicemotion", handleMotion);
    setState("running");
  }

  async function stop(send: boolean) {
    stopSensors();

    const collected = detectionsRef.current;

    if (!send || collected.length === 0) {
      setState("idle");
      setMessage(
        collected.length === 0 && send
          ? "No road impacts were detected on that trip. That is good news."
          : null
      );
      detectionsRef.current = [];
      setDetections([]);
      return;
    }

    setState("sending");

    try {
      const response = await fetch("/api/roads/detections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detections: collected }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Those detections could not be sent.");
        return;
      }

      setState("sent");
      setMessage(data.message);
      detectionsRef.current = [];
      setDetections([]);
    } catch {
      setState("error");
      setMessage("We could not reach CityFlow AI. Your detections were not saved.");
    }
  }

  const running = state === "running";
  const sending = state === "sending";

  /*
    While the batch is uploading the trip is not over yet, so the pair of
    "Finish"/"Discard" buttons stays on screen with a spinner rather than
    flipping back to "Start road sensing" — which would look as though the trip
    had been abandoned at the exact moment it was being saved.
  */
  const tripActive = running || sending;

  return (
    <Card>
      <CardHeader
        title="Road sensing while you travel"
        description="Uses your phone's motion sensors to notice sharp jolts, so a rough stretch of road can be found without anybody having to stop and report it."
      />

      <div className="rounded-lg border border-border-base bg-surface-2 p-4">
        <p className="text-sm font-medium text-fg">What this can and cannot tell</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            A jolt is a <span className="font-medium text-fg">hint</span>. A speed breaker, a
            kerb and a pothole feel the same to a phone.
          </li>
          <li>
            Everything recorded is filed as a{" "}
            <span className="font-medium text-fg">possible</span> road issue and counts as half
            the evidence of a report a person filled in themselves.
          </li>
          <li>
            Nothing is recorded unless your phone knows where it is and can tell it is moving.
          </li>
          <li>
            Keep this page open and the screen on — browsers pause sensors in a background tab.
          </li>
        </ul>
      </div>

      {tripActive && (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-3"
          role="status"
          aria-live="polite"
        >
          <LiveTile label="Possible impacts" value={String(detections.length)} />
          <LiveTile label="Strongest jolt" value={`${peak.toFixed(1)} m/s²`} />
          <LiveTile
            label="Movement"
            value={moving === null ? "Unknown" : moving ? "Travelling" : "Stationary"}
          />
        </div>
      )}

      {message && (
        <div className="mt-4">
          <Notice tone={state === "error" ? "error" : state === "sent" ? "success" : "info"}>
            {message}
          </Notice>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {tripActive ? (
          <>
            <Button onClick={() => void stop(true)} loading={sending}>
              Finish trip and send {detections.length > 0 ? `(${detections.length})` : ""}
            </Button>
            <Button variant="outline" onClick={() => void stop(false)} disabled={sending}>
              Stop and discard
            </Button>
          </>
        ) : (
          <Button onClick={() => void start()}>Start road sensing</Button>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-subtle">
        Your location is used only while sensing is running, and only the places where a jolt
        happened are sent — never a track of your journey. You can stop at any time, and
        &ldquo;Stop and discard&rdquo; sends nothing at all.
      </p>
    </Card>
  );
}

function LiveTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-base bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
