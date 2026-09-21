import { prisma } from "@/lib/db";
import { modeLabel } from "@/lib/admin/analytics";
import type { CityCode } from "@/lib/cities";
import { toMinutes } from "@/lib/demand/time-slots";

/**
 * User Analytics — account-level figures for one city.
 *
 * WHY THIS IS SEPARATE FROM THE CITY OVERVIEW
 * `loadCityOverview` (analytics.ts) answers "how much demand is there and is it
 * smoothing" using confirmed trips and recommendations. This file answers a
 * different question — "who has an account, and where are they in the
 * lifecycle from sign-up to an active, counted commuter" — using the User
 * table itself. Keeping them apart means neither file has to know about the
 * other's concerns.
 *
 * THE SAME PRIVACY RULE AS analytics.ts
 * Every query here is a count or a group-by. Nothing selects an email, a
 * cityflowId, a name or any other column that identifies a specific account.
 * `loadUserAccounts` below is the one exception, and it says why.
 */

export interface PrivacyBreakdown {
  anonymous: number;
  partial: number;
  full: number;
}

export interface ModeCount {
  mode: string;
  label: string;
  count: number;
}

export interface DepartureWindowCount {
  label: string;
  count: number;
}

export interface OrganisationCount {
  name: string;
  count: number;
}

export interface FlexibilityBreakdown {
  /** Can move at all (`isFlexible`). */
  flexible: number;
  /** Cannot move — CityFlow AI will still show demand, never suggest a shift. */
  fixed: number;
  /** Of the flexible accounts, how far they said they can move, in minutes. */
  byMinutes: Array<{ minutes: number; count: number }>;
}

export interface UserAnalytics {
  totalUsers: number;
  onboarded: number;
  /** 0-100, or null when there are no accounts yet to take a percentage of. */
  onboardingRate: number | null;
  emailVerified: number;
  privacy: PrivacyBreakdown;
  /** Switched OFF being counted in city-level demand totals. */
  optedOutOfDemand: number;
  linkedToOrganisation: number;
  newThisWeek: number;
  newPreviousWeek: number;
  /** Journeys (recurring routines) per onboarded account, rounded to 1dp. */
  avgJourneysPerOnboarded: number | null;
  /** How onboarded accounts said they usually travel. */
  byTransportMode: ModeCount[];
  /** Whether an onboarded account's departure can move at all, and by how much. */
  flexibility: FlexibilityBreakdown;
  /** When onboarded accounts said they usually leave, bucketed into windows. */
  byDepartureWindow: DepartureWindowCount[];
  /** The organisations with the most linked accounts in this city. */
  byOrganisation: OrganisationCount[];
}

export async function loadUserAnalytics(cityCode: CityCode): Promise<UserAnalytics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const scope = { role: "USER" as const, cityCode };

  const [
    totalUsers,
    onboarded,
    emailVerified,
    anonymous,
    partial,
    full,
    optedOutOfDemand,
    linkedToOrganisation,
    newThisWeek,
    newPreviousWeek,
    journeyCount,
    modeGroups,
    flexibleCount,
    fixedCount,
    flexibilityMinuteGroups,
    departureTimes,
    organisationGroups,
  ] = await Promise.all([
    prisma.user.count({ where: scope }),
    prisma.user.count({ where: { ...scope, onboardingCompleted: true } }),
    prisma.user.count({ where: { ...scope, emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { ...scope, privacyLevel: "ANONYMOUS" } }),
    prisma.user.count({ where: { ...scope, privacyLevel: "PARTIAL" } }),
    prisma.user.count({ where: { ...scope, privacyLevel: "FULL" } }),
    prisma.travelProfile.count({
      where: { user: scope, shareAggregatedDemand: false },
    }),
    prisma.organisationMember.count({ where: { user: scope } }),
    prisma.user.count({ where: { ...scope, createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({
      where: { ...scope, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.journey.count({ where: { user: scope } }),
    prisma.travelProfile.groupBy({
      by: ["primaryMode"],
      where: { user: scope },
      _count: { _all: true },
    }),
    prisma.travelProfile.count({ where: { user: scope, isFlexible: true } }),
    prisma.travelProfile.count({ where: { user: scope, isFlexible: false } }),
    prisma.travelProfile.groupBy({
      by: ["flexibilityMinutes"],
      where: { user: scope, isFlexible: true },
      _count: { _all: true },
    }),
    prisma.travelProfile.findMany({
      where: { user: scope },
      select: { usualDeparture: true },
    }),
    prisma.organisationMember.groupBy({
      by: ["organisationId"],
      where: { user: scope },
      _count: { _all: true },
      orderBy: { _count: { organisationId: "desc" } },
      take: 8,
    }),
  ]);

  // Organisation names are a second, small lookup rather than a join, because
  // groupBy cannot select related fields directly.
  const organisationNames =
    organisationGroups.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await prisma.organisation.findMany({
              where: { id: { in: organisationGroups.map((row) => row.organisationId) } },
              select: { id: true, name: true },
            })
          ).map((org) => [org.id, org.name])
        );

  /*
    Departure times are stored as "HH:MM" wall-clock strings, not something
    the database can group by meaningfully, so the bucketing happens here —
    the same five windows a commuter would recognise, not an arbitrary count.
  */
  const DEPARTURE_WINDOWS: Array<{ label: string; startMinutes: number; endMinutes: number }> = [
    { label: "Early (before 7am)", startMinutes: 0, endMinutes: 7 * 60 },
    { label: "Morning peak (7–10am)", startMinutes: 7 * 60, endMinutes: 10 * 60 },
    { label: "Midday (10am–4pm)", startMinutes: 10 * 60, endMinutes: 16 * 60 },
    { label: "Evening peak (4–7pm)", startMinutes: 16 * 60, endMinutes: 19 * 60 },
    { label: "Night (after 7pm)", startMinutes: 19 * 60, endMinutes: 24 * 60 },
  ];

  const byDepartureWindow = DEPARTURE_WINDOWS.map((window) => ({
    label: window.label,
    count: departureTimes.filter((row) => {
      const minutes = toMinutes(row.usualDeparture);
      return minutes !== null && minutes >= window.startMinutes && minutes < window.endMinutes;
    }).length,
  }));

  return {
    totalUsers,
    onboarded,
    onboardingRate: totalUsers > 0 ? Math.round((onboarded / totalUsers) * 100) : null,
    emailVerified,
    privacy: { anonymous, partial, full },
    optedOutOfDemand,
    linkedToOrganisation,
    newThisWeek,
    newPreviousWeek,
    avgJourneysPerOnboarded:
      onboarded > 0 ? Math.round((journeyCount / onboarded) * 10) / 10 : null,
    byTransportMode: modeGroups
      .map((row) => ({ mode: row.primaryMode, label: modeLabel(row.primaryMode), count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    flexibility: {
      flexible: flexibleCount,
      fixed: fixedCount,
      byMinutes: flexibilityMinuteGroups
        .map((row) => ({ minutes: row.flexibilityMinutes, count: row._count._all }))
        .sort((a, b) => a.minutes - b.minutes),
    },
    byDepartureWindow,
    byOrganisation: organisationGroups
      .map((row) => ({
        name: organisationNames.get(row.organisationId) ?? "Unknown organisation",
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * One row per account, for the User Management view.
 *
 * WHY THIS ONE FUNCTION SELECTS MORE THAN A COUNT
 * "User Management" cannot function as a pure aggregate the way the rest of
 * this portal does — managing an account means being able to see that it
 * exists. The privacy line is drawn at what gets selected, not at whether
 * individual rows appear at all:
 *
 *   Shown:      cityflowId (already the public, anonymous identifier used
 *               everywhere else in the product), role, city, onboarding and
 *               verification status, privacy choice, sign-up date, and the
 *               three travel-pattern fields an operator needs to make sense
 *               of demand at a glance — transport mode, regular departure
 *               and flexibility. None of these identify a person; they
 *               describe a travel pattern, the same kind of thing already
 *               shown in aggregate on User Analytics, just per row here.
 *   Never shown here: email, display name, phone number, profile picture, or
 *               anything else from a travel profile, journeys or chat
 *               history — no home area, no destination, no journey time.
 *
 * An operator who genuinely needs to contact someone (a password reset, an
 * abuse report) still has the database — this view exists for understanding
 * the accounts in a city at a glance, not for looking someone up by name.
 */
export interface UserAccountRow {
  id: string;
  cityflowId: string;
  role: "USER" | "ADMIN" | "MUNICIPAL";
  onboardingCompleted: boolean;
  emailVerified: boolean;
  privacyLevel: "ANONYMOUS" | "PARTIAL" | "FULL";
  organisationLinked: boolean;
  createdAt: Date;
  /** From the travel profile, if one has been completed. Never null-vs-missing ambiguity: no profile is simply null. */
  transportMode: string | null;
  transportModeLabel: string | null;
  regularDeparture: string | null;
  flexibility: "Flexible" | "Fixed" | null;
}

const ACCOUNT_ROW_LIMIT = 100;

export async function loadUserAccounts(cityCode: CityCode): Promise<{
  rows: UserAccountRow[];
  totalCount: number;
  truncated: boolean;
}> {
  const where = { role: "USER" as const, cityCode };

  const [rows, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: ACCOUNT_ROW_LIMIT,
      select: {
        id: true,
        cityflowId: true,
        role: true,
        onboardingCompleted: true,
        emailVerifiedAt: true,
        privacyLevel: true,
        createdAt: true,
        organisationMember: { select: { id: true } },
        travelProfile: {
          select: { primaryMode: true, usualDeparture: true, isFlexible: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      cityflowId: row.cityflowId,
      role: row.role,
      onboardingCompleted: row.onboardingCompleted,
      emailVerified: row.emailVerifiedAt !== null,
      privacyLevel: row.privacyLevel,
      organisationLinked: row.organisationMember !== null,
      createdAt: row.createdAt,
      transportMode: row.travelProfile?.primaryMode ?? null,
      transportModeLabel: row.travelProfile ? modeLabel(row.travelProfile.primaryMode) : null,
      regularDeparture: row.travelProfile?.usualDeparture ?? null,
      flexibility: row.travelProfile
        ? row.travelProfile.isFlexible
          ? ("Flexible" as const)
          : ("Fixed" as const)
        : null,
    })),
    totalCount,
    truncated: totalCount > ACCOUNT_ROW_LIMIT,
  };
}
