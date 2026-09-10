/**
 * Transport modes and destination types.
 *
 * Kept in one place so the onboarding form, the profile editor, the dashboard's
 * travel options and (later) the Admin Portal's mode-split chart all describe
 * the same things in the same words.
 *
 * The string values match the Prisma enums exactly.
 */

export type TransportMode =
  | "CAR"
  | "BIKE"
  | "BUS"
  | "METRO"
  | "WALK"
  | "CYCLE"
  | "OTHER";

export interface TransportModeInfo {
  code: TransportMode;
  label: string;
  /** Shown under the label in pickers. */
  hint: string;
  /** Roughly how much road space one traveller takes. Used for wording, not maths. */
  roadImpact: "high" | "medium" | "low" | "none";
}

export const TRANSPORT_MODES: TransportModeInfo[] = [
  { code: "CAR", label: "Car", hint: "Private four-wheeler", roadImpact: "high" },
  { code: "BIKE", label: "Bike / Scooter", hint: "Two-wheeler", roadImpact: "medium" },
  { code: "BUS", label: "Bus", hint: "Public road transport", roadImpact: "low" },
  { code: "METRO", label: "Metro / Train", hint: "Rail, off the road network", roadImpact: "none" },
  { code: "CYCLE", label: "Cycling", hint: "Bicycle", roadImpact: "none" },
  { code: "WALK", label: "Walking", hint: "On foot", roadImpact: "none" },
  { code: "OTHER", label: "Other", hint: "Auto, cab, shared vehicle", roadImpact: "medium" },
];

const MODE_BY_CODE = new Map(TRANSPORT_MODES.map((mode) => [mode.code, mode]));

export function getTransportMode(code: string): TransportModeInfo {
  return MODE_BY_CODE.get(code as TransportMode) ?? TRANSPORT_MODES[TRANSPORT_MODES.length - 1];
}

export function isTransportMode(value: string): value is TransportMode {
  return MODE_BY_CODE.has(value as TransportMode);
}

/* -------------------------------------------------------------------------- */

export type DestinationType = "WORK" | "COLLEGE" | "SCHOOL" | "OTHER";

export const DESTINATION_TYPES: Array<{ code: DestinationType; label: string }> = [
  { code: "WORK", label: "Office / workplace" },
  { code: "COLLEGE", label: "College / university" },
  { code: "SCHOOL", label: "School" },
  { code: "OTHER", label: "Somewhere else" },
];

export function isDestinationType(value: string): value is DestinationType {
  return DESTINATION_TYPES.some((type) => type.code === value);
}

/* -------------------------------------------------------------------------- */

/** The flexibility windows offered during onboarding, in minutes. */
export const FLEXIBILITY_OPTIONS = [
  { minutes: 15, label: "15 minutes", hint: "A small nudge either way" },
  { minutes: 30, label: "30 minutes", hint: "Some room to move" },
  { minutes: 60, label: "1 hour", hint: "Quite flexible" },
] as const;

/** Acceptable extra delay options, in minutes. */
export const MAX_DELAY_OPTIONS = [
  { minutes: 5, label: "Almost none (5 min)" },
  { minutes: 15, label: "Up to 15 minutes" },
  { minutes: 30, label: "Up to 30 minutes" },
] as const;
