"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { analyzeSurface, type SurfaceReading } from "@/lib/roads/photo-analysis";
import { MAX_PHOTO_DATA_URL_LENGTH } from "@/lib/validation";

/**
 * Photo picker that shrinks the image in the browser before it is ever sent.
 *
 * WHY THE RESIZING HAPPENS HERE AND NOT ON THE SERVER
 * A photo straight from a modern phone camera is 3-8 MB. Uploading that to
 * shrink it afterwards would waste the person's mobile data, take ten seconds
 * on a weak connection, and — because these images are stored in a Postgres
 * column on a free plan — risk filling the database. Doing it on the device
 * costs nothing, takes a moment, and means the network only ever carries the
 * small version.
 *
 * WHAT IT DOES
 * Draws the picture into a canvas at no more than MAX_EDGE pixels on its long
 * side and re-encodes it as JPEG, stepping the quality down until the result
 * fits the size ceiling. If it still will not fit — an unusual, very detailed
 * image — it says so plainly instead of silently sending something the server
 * will reject.
 *
 * PRIVACY SIDE-EFFECT WORTH KNOWING ABOUT: re-encoding through a canvas drops
 * the original file's EXIF metadata, including any GPS coordinates the camera
 * embedded. Location is only ever attached when the person explicitly asks for
 * it, so this is the behaviour we want.
 */

const MAX_EDGE = 1000;
const QUALITY_STEPS = [0.72, 0.6, 0.48, 0.38];

interface PhotoInputProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /**
   * Fired once per photo with the on-device surface-analysis result, or with
   * `null` when the photo is removed. Purely informational — see
   * lib/roads/photo-analysis.ts for exactly what it can and cannot tell.
   */
  onAnalysis?: (reading: SurfaceReading | null) => void;
  disabled?: boolean;
}

export function PhotoInput({ value, onChange, onAnalysis, disabled = false }: PhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setBusy(true);
    try {
      const shrunk = await shrinkImage(file);
      if (!shrunk) {
        setError(
          "That photo could not be made small enough. Please try a different one."
        );
        return;
      }
      onChange(shrunk.dataUrl);
      // Analysis runs on the same canvas already used to shrink the photo, so
      // this costs nothing beyond the pixel scan itself — no second decode.
      onAnalysis?.(analyzeSurface(shrunk.canvas));
    } catch {
      setError("That photo could not be read. Please try a different one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 block text-sm font-medium text-fg">Photo (optional)</p>
      <p className="mb-3 text-xs leading-relaxed text-subtle">
        A photo helps the municipal team recognise the place. It is resized on your phone
        before being sent, and the camera&apos;s hidden location data is removed in the
        process.
      </p>

      {value ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL cannot go through next/image */}
          <img
            src={value}
            alt="The photo you attached to this report"
            className="max-h-56 w-full rounded-lg border border-border-base object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              onAnalysis?.(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove photo
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full cursor-pointer rounded-lg border border-dashed border-border-strong bg-surface-2 p-3 text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-on-primary"
          />
          {busy && (
            <p role="status" className="mt-2 text-xs text-muted">
              Resizing your photo…
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Returns a data URL under the size ceiling plus the canvas it was drawn on
 * (reused by the caller for on-device analysis), or null if it cannot get there.
 */
async function shrinkImage(
  file: File
): Promise<{ dataUrl: string; canvas: HTMLCanvasElement } | null> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  // A white base matters for transparent PNGs — JPEG has no alpha channel, and
  // without this they encode with a black background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_PHOTO_DATA_URL_LENGTH) return { dataUrl, canvas };
  }

  return null;
}

/**
 * Decodes the file.
 *
 * `createImageBitmap` is the fast path and handles orientation correctly on
 * modern browsers. The <img> fallback exists for older Safari, which is common
 * enough on Indian phones to be worth the extra dozen lines.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode failed"));
      image.src = url;
    });
  } finally {
    // Revoking immediately is safe: the image has already been decoded.
    URL.revokeObjectURL(url);
  }
}
