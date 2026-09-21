import { prisma } from "@/lib/db";
import type { CityCode } from "@/lib/cities";

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
  ]);

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
 *               verification status, privacy choice, sign-up date.
 *   Never shown here: email, display name, phone number, profile picture, or
 *               anything from their travel profile, journeys or chat history.
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
    })),
    totalCount,
    truncated: totalCount > ACCOUNT_ROW_LIMIT,
  };
}
