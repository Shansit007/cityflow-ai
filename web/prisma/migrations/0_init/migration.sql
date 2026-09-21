-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('WORK', 'COLLEGE', 'SCHOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('FIELD_WORKER', 'INSPECTOR', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "IntentionSource" AS ENUM ('CHAT', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "IntentionStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NetworkEventKind" AS ENUM ('ACCIDENT', 'ROAD_CLOSURE', 'WEATHER', 'PUBLIC_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganisationKind" AS ENUM ('COMPANY', 'CAMPUS', 'HOSPITAL', 'GOVERNMENT', 'SCHOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "PrivacyLevel" AS ENUM ('ANONYMOUS', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'KEPT_USUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('PARKING', 'FUEL', 'TRANSIT', 'FOOD', 'SHOPPING', 'CIVIC', 'OTHER');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('FOLLOWED_RECOMMENDATION', 'CARPOOL', 'MODE_SWITCH', 'ROAD_REPORT', 'ADJUSTMENT', 'REDEMPTION');

-- CreateEnum
CREATE TYPE "RoadIssueConfidence" AS ENUM ('POSSIBLE', 'LIKELY', 'CONFIRMED_BY_REPORTS');

-- CreateEnum
CREATE TYPE "RoadIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RoadIssueSource" AS ENUM ('CITIZEN_REPORT', 'SENSOR_DETECTION');

-- CreateEnum
CREATE TYPE "RoadIssueStatus" AS ENUM ('NEW', 'VERIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RoadIssueType" AS ENUM ('POTHOLE', 'BROKEN_SURFACE', 'WATERLOGGING', 'UNMARKED_SPEED_BREAKER', 'DEBRIS_OR_OBSTRUCTION', 'OPEN_MANHOLE', 'POOR_STREET_LIGHTING', 'OTHER');

-- CreateEnum
CREATE TYPE "SavedLocationKind" AS ENUM ('HOME', 'WORK', 'EDUCATION', 'GYM', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "SimulationScenario" AS ENUM ('BASELINE', 'CITYFLOW');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('CAR', 'BIKE', 'BUS', 'METRO', 'WALK', 'CYCLE', 'OTHER');

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('MEETING', 'FLIGHT', 'TRAIN', 'MOVIE', 'APPOINTMENT', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MUNICIPAL');

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "text" TEXT NOT NULL,
    "proposal" JSONB,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT true,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link" JSONB,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_configs" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "highPriorityThreshold" INTEGER NOT NULL DEFAULT 75,
    "confirmationReportCount" INTEGER NOT NULL DEFAULT 3,
    "sensorImpactThreshold" DOUBLE PRECISION NOT NULL DEFAULT 14.0,
    "pointsForFollowingRecommendation" INTEGER NOT NULL DEFAULT 50,
    "pointsForCarpool" INTEGER NOT NULL DEFAULT 80,
    "pointsForModeSwitch" INTEGER NOT NULL DEFAULT 100,
    "pointsForCorroboratedRoadReport" INTEGER NOT NULL DEFAULT 30,
    "voucherValidityDays" INTEGER NOT NULL DEFAULT 90,
    "defaultFlexibilityMinutes" INTEGER NOT NULL DEFAULT 15,
    "peakDemandThreshold" INTEGER NOT NULL DEFAULT 62,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_slot_aggregates" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "confirmedTrips" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_slot_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "staffCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "assignedArea" TEXT,
    "role" "EmployeeRole" NOT NULL DEFAULT 'FIELD_WORKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "originArea" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION,
    "originLng" DOUBLE PRECISION,
    "destinationArea" TEXT NOT NULL,
    "destinationLat" DOUBLE PRECISION,
    "destinationLng" DOUBLE PRECISION,
    "destinationType" "DestinationType" NOT NULL DEFAULT 'WORK',
    "usualDeparture" TEXT NOT NULL,
    "requiredArrival" TEXT NOT NULL,
    "typicalJourneyMinutes" INTEGER NOT NULL DEFAULT 20,
    "travelDays" TEXT[],
    "isFlexible" BOOLEAN NOT NULL DEFAULT true,
    "flexibilityMinutes" INTEGER NOT NULL DEFAULT 15,
    "willingToLeaveEarlier" BOOLEAN NOT NULL DEFAULT true,
    "willingToLeaveLater" BOOLEAN NOT NULL DEFAULT false,
    "mode" "TransportMode" NOT NULL DEFAULT 'CAR',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_events" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "kind" "NetworkEventKind" NOT NULL,
    "affectedZone" TEXT,
    "eventDate" DATE NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "demandImpact" INTEGER NOT NULL DEFAULT 15,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_members" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrganisationKind" NOT NULL DEFAULT 'COMPANY',
    "emailDomain" TEXT,
    "areaLabel" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "incentiveNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "cityCode" TEXT NOT NULL,
    "usualDeparture" TEXT NOT NULL,
    "recommendedDeparture" TEXT NOT NULL,
    "demandAtUsual" INTEGER NOT NULL,
    "demandAtRecommended" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "chosenDeparture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updateAcknowledged" BOOLEAN NOT NULL DEFAULT true,
    "updateReason" TEXT,
    "updatedByOptimiser" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutesSaved" INTEGER NOT NULL DEFAULT 0,
    "journeyId" TEXT,
    "pointsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "pointsOffered" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_catalog_items" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RewardCategory" NOT NULL DEFAULT 'OTHER',
    "pointsCost" INTEGER NOT NULL,
    "partnerName" TEXT,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "recommendationId" TEXT,
    "balanceAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_issue_events" (
    "id" TEXT NOT NULL,
    "roadIssueId" TEXT NOT NULL,
    "fromStatus" "RoadIssueStatus",
    "toStatus" "RoadIssueStatus" NOT NULL,
    "employeeId" TEXT,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_issue_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_issue_reports" (
    "id" TEXT NOT NULL,
    "roadIssueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RoadIssueSource" NOT NULL,
    "description" TEXT,
    "photo" TEXT,
    "impactMagnitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_issue_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_issues" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "zoneKey" TEXT NOT NULL,
    "areaLabel" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "cellKey" TEXT NOT NULL,
    "issueType" "RoadIssueType" NOT NULL,
    "severity" "RoadIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "confidence" "RoadIssueConfidence" NOT NULL DEFAULT 'POSSIBLE',
    "reportCount" INTEGER NOT NULL DEFAULT 1,
    "sensorReportCount" INTEGER NOT NULL DEFAULT 0,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "handedOverAt" TIMESTAMP(3),
    "firstReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "assignedEmployeeId" TEXT,
    "completedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "status" "RoadIssueStatus" NOT NULL DEFAULT 'NEW',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByEmployeeId" TEXT,

    CONSTRAINT "road_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "SavedLocationKind" NOT NULL DEFAULT 'OTHER',
    "area" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "scenario" "SimulationScenario" NOT NULL,
    "networkSource" TEXT NOT NULL,
    "vehiclesDeparted" INTEGER NOT NULL,
    "meanTravelTimeSeconds" INTEGER NOT NULL,
    "totalDelaySeconds" INTEGER NOT NULL,
    "peakSlotVehicles" INTEGER NOT NULL,
    "meanWaitingSeconds" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_intentions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "cityCode" TEXT NOT NULL,
    "originZone" TEXT NOT NULL,
    "destinationZone" TEXT NOT NULL,
    "plannedDeparture" TEXT NOT NULL,
    "updatedDeparture" TEXT NOT NULL,
    "transportMode" "TransportMode" NOT NULL,
    "status" "IntentionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "IntentionSource" NOT NULL DEFAULT 'CHAT',
    "countedInDemand" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journeyId" TEXT,

    CONSTRAINT "travel_intentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "homeArea" TEXT NOT NULL,
    "destinationArea" TEXT NOT NULL,
    "destinationType" "DestinationType" NOT NULL DEFAULT 'WORK',
    "primaryMode" "TransportMode" NOT NULL,
    "usualDeparture" TEXT NOT NULL,
    "requiredArrival" TEXT NOT NULL,
    "typicalJourneyMinutes" INTEGER NOT NULL DEFAULT 20,
    "travelDays" TEXT[],
    "isFlexible" BOOLEAN NOT NULL DEFAULT true,
    "flexibilityMinutes" INTEGER NOT NULL DEFAULT 15,
    "preferredModes" "TransportMode"[],
    "maxAcceptableDelayMinutes" INTEGER NOT NULL DEFAULT 15,
    "willingToLeaveEarlier" BOOLEAN NOT NULL DEFAULT true,
    "willingToLeaveLater" BOOLEAN NOT NULL DEFAULT false,
    "carpoolInterest" BOOLEAN NOT NULL DEFAULT false,
    "publicTransportInterest" BOOLEAN NOT NULL DEFAULT false,
    "shareAggregatedDemand" BOOLEAN NOT NULL DEFAULT true,
    "allowNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationHistoryRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "notifyDailyRecommendation" BOOLEAN NOT NULL DEFAULT true,
    "notifyRewards" BOOLEAN NOT NULL DEFAULT true,
    "notifyRoadDetections" BOOLEAN NOT NULL DEFAULT false,
    "notifyTrafficAlerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "travel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "originArea" TEXT NOT NULL,
    "destinationArea" TEXT NOT NULL,
    "travelDate" DATE NOT NULL,
    "requiredArrival" TEXT NOT NULL,
    "typicalJourneyMinutes" INTEGER NOT NULL DEFAULT 20,
    "mode" "TransportMode" NOT NULL DEFAULT 'CAR',
    "tripType" "TripType" NOT NULL DEFAULT 'OTHER',
    "recommendedDeparture" TEXT NOT NULL,
    "estimatedArrival" TEXT NOT NULL,
    "demandAtRecommended" INTEGER NOT NULL,
    "estimatedJourneyMinutes" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 60,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "cityflowId" TEXT NOT NULL,
    "cityCode" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "privacyLevel" "PrivacyLevel" NOT NULL DEFAULT 'PARTIAL',
    "profilePictureUrl" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "auth_tokens_userId_kind_idx" ON "auth_tokens"("userId" ASC, "kind" ASC);

-- CreateIndex
CREATE INDEX "chat_messages_userId_createdAt_idx" ON "chat_messages"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "city_configs_cityCode_key" ON "city_configs"("cityCode" ASC);

-- CreateIndex
CREATE INDEX "demand_slot_aggregates_cityCode_travelDate_idx" ON "demand_slot_aggregates"("cityCode" ASC, "travelDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "demand_slot_aggregates_cityCode_travelDate_slotMinutes_key" ON "demand_slot_aggregates"("cityCode" ASC, "travelDate" ASC, "slotMinutes" ASC);

-- CreateIndex
CREATE INDEX "employees_cityCode_isActive_idx" ON "employees"("cityCode" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_cityCode_staffCode_key" ON "employees"("cityCode" ASC, "staffCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId" ASC);

-- CreateIndex
CREATE INDEX "journeys_userId_isActive_idx" ON "journeys"("userId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "journeys_userId_sortOrder_idx" ON "journeys"("userId" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE INDEX "network_events_cityCode_eventDate_active_idx" ON "network_events"("cityCode" ASC, "eventDate" ASC, "active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_organisationId_userId_key" ON "organisation_members"("organisationId" ASC, "userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_userId_key" ON "organisation_members"("userId" ASC);

-- CreateIndex
CREATE INDEX "organisations_cityCode_isVerified_idx" ON "organisations"("cityCode" ASC, "isVerified" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_emailDomain_key" ON "organisations"("emailDomain" ASC);

-- CreateIndex
CREATE INDEX "recommendations_cityCode_travelDate_idx" ON "recommendations"("cityCode" ASC, "travelDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_journeyId_travelDate_key" ON "recommendations"("journeyId" ASC, "travelDate" ASC);

-- CreateIndex
CREATE INDEX "recommendations_userId_travelDate_idx" ON "recommendations"("userId" ASC, "travelDate" ASC);

-- CreateIndex
CREATE INDEX "reward_catalog_items_cityCode_isActive_idx" ON "reward_catalog_items"("cityCode" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "reward_redemptions_userId_createdAt_idx" ON "reward_redemptions"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_voucherCode_key" ON "reward_redemptions"("voucherCode" ASC);

-- CreateIndex
CREATE INDEX "reward_transactions_userId_createdAt_idx" ON "reward_transactions"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "road_issue_events_roadIssueId_createdAt_idx" ON "road_issue_events"("roadIssueId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "road_issue_reports_roadIssueId_userId_key" ON "road_issue_reports"("roadIssueId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "road_issue_reports_userId_createdAt_idx" ON "road_issue_reports"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "road_issues_assignedEmployeeId_status_idx" ON "road_issues"("assignedEmployeeId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "road_issues_cellKey_issueType_key" ON "road_issues"("cellKey" ASC, "issueType" ASC);

-- CreateIndex
CREATE INDEX "road_issues_cityCode_confidence_idx" ON "road_issues"("cityCode" ASC, "confidence" ASC);

-- CreateIndex
CREATE INDEX "road_issues_cityCode_priorityScore_idx" ON "road_issues"("cityCode" ASC, "priorityScore" ASC);

-- CreateIndex
CREATE INDEX "road_issues_cityCode_status_idx" ON "road_issues"("cityCode" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "road_issues_zoneKey_idx" ON "road_issues"("zoneKey" ASC);

-- CreateIndex
CREATE INDEX "saved_locations_userId_idx" ON "saved_locations"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_locations_userId_label_key" ON "saved_locations"("userId" ASC, "label" ASC);

-- CreateIndex
CREATE INDEX "simulation_runs_cityCode_travelDate_scenario_idx" ON "simulation_runs"("cityCode" ASC, "travelDate" ASC, "scenario" ASC);

-- CreateIndex
CREATE INDEX "travel_intentions_cityCode_travelDate_updatedDeparture_idx" ON "travel_intentions"("cityCode" ASC, "travelDate" ASC, "updatedDeparture" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "travel_intentions_journeyId_travelDate_key" ON "travel_intentions"("journeyId" ASC, "travelDate" ASC);

-- CreateIndex
CREATE INDEX "travel_intentions_userId_travelDate_idx" ON "travel_intentions"("userId" ASC, "travelDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "travel_profiles_userId_key" ON "travel_profiles"("userId" ASC);

-- CreateIndex
CREATE INDEX "trip_plans_cityCode_travelDate_idx" ON "trip_plans"("cityCode" ASC, "travelDate" ASC);

-- CreateIndex
CREATE INDEX "trip_plans_userId_travelDate_idx" ON "trip_plans"("userId" ASC, "travelDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_rewards_userId_key" ON "user_rewards"("userId" ASC);

-- CreateIndex
CREATE INDEX "users_cityCode_idx" ON "users"("cityCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_cityflowId_key" ON "users"("cityflowId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "reward_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issue_events" ADD CONSTRAINT "road_issue_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issue_events" ADD CONSTRAINT "road_issue_events_roadIssueId_fkey" FOREIGN KEY ("roadIssueId") REFERENCES "road_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issue_reports" ADD CONSTRAINT "road_issue_reports_roadIssueId_fkey" FOREIGN KEY ("roadIssueId") REFERENCES "road_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issue_reports" ADD CONSTRAINT "road_issue_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issues" ADD CONSTRAINT "road_issues_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_issues" ADD CONSTRAINT "road_issues_verifiedByEmployeeId_fkey" FOREIGN KEY ("verifiedByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_intentions" ADD CONSTRAINT "travel_intentions_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_intentions" ADD CONSTRAINT "travel_intentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_profiles" ADD CONSTRAINT "travel_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_plans" ADD CONSTRAINT "trip_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

