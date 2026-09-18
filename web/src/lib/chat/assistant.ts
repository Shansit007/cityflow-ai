import type { IntentContext, ParsedIntent } from "@/lib/chat/intent-parser";
import {
  DEMAND_LEVEL_LABEL,
  estimateJourneyMinutes,
  levelForIndex,
  type DemandLevel,
} from "@/lib/demand/demand-model";
import {
  SLOT_MINUTES,
  formatSlotLabel,
  formatTime,
  roundToSlot,
  toMinutes,
  toTimeString,
} from "@/lib/demand/time-slots";
import { ASSISTANT_NAME } from "@/lib/chat/branding";
import { findTopic } from "@/lib/chat/app-guide";
import { getTransportMode, type TransportMode } from "@/lib/travel";

/**
 * Turns a parsed intent into what the assistant actually says, plus the
 * confirmation card that goes with it.
 *
 * THE RULE THIS FILE ENFORCES
 * A proposal is never presented as a done deal. Before offering to save a new
 * departure time, the assistant checks the SAME two things the recommendation
 * engine checks:
 *
 *   1. Will you still arrive on time?
 *   2. Is the time you asked for actually any good?
 *
 * If the answer to (2) is "that slot is already predicted to be very busy", it
 * says so and offers a quieter nearby alternative — while still letting the
 * person go ahead with what they asked for. This is the conversational form of
 * the product's core rule: do not simply move people into a new peak.
 */

export interface AssistantContext extends IntentContext {
  cityName: string;
  /** Adjusted demand (baseline + everyone's confirmed trips + events). */
  demandAt: (slotMinutes: number) => number;
  /** What CityFlow AI currently recommends for today. */
  recommendedDeparture: string;
}

/** The card shown under an assistant message when it proposes a change. */
export interface ProposalCard {
  updatedDeparture?: string;
  transportMode?: TransportMode;
  cancel?: boolean;

  /** Predicted demand at the proposed time. */
  demandIndex?: number;
  demandLevel?: DemandLevel;
  demandLabel?: string;

  estimatedArrival?: string;
  arrivesInTime?: boolean;

  /** Set when the proposed slot is itself busy, with a quieter option nearby. */
  quieterAlternative?: { time: string; demandLabel: string } | null;
}

export interface AssistantReply {
  /** What the assistant says. Plain text; the UI renders it as a bubble. */
  text: string;
  /** Null when the message needs no action. */
  proposal: ProposalCard | null;
  /** True when the person must press Confirm before anything is stored. */
  requiresConfirmation: boolean;
  /**
   * An optional "take me there" link shown under the message.
   *
   * Telling somebody a feature exists and leaving them to hunt for it is only
   * half an answer, so when a topic knows where it lives, the answer carries
   * the way there.
   */
  link?: { label: string; href: string };
}

/** How far either side of a busy slot to look for something quieter. */
const ALTERNATIVE_SEARCH_SLOTS = 4;

/**
 * Looks for a nearby slot that is meaningfully quieter and still arrives in time.
 * Returns null when the requested time is already a reasonable choice.
 */
function findQuieterAlternative(
  context: AssistantContext,
  slotMinutes: number
): { time: string; demandLabel: string } | null {
  const requestedIndex = context.demandAt(slotMinutes);

  // Not busy enough to be worth mentioning an alternative.
  if (levelForIndex(requestedIndex) === "LOW" || levelForIndex(requestedIndex) === "MODERATE") {
    return null;
  }

  const arrivalDeadline = toMinutes(context.requiredArrival) ?? 24 * 60;

  let best: { minutes: number; index: number } | null = null;

  for (let step = -ALTERNATIVE_SEARCH_SLOTS; step <= ALTERNATIVE_SEARCH_SLOTS; step += 1) {
    if (step === 0) continue;

    const candidate = slotMinutes + step * SLOT_MINUTES;
    if (candidate < 0 || candidate >= 24 * 60) continue;

    const index = context.demandAt(candidate);
    const journey = estimateJourneyMinutes(context.typicalJourneyMinutes, index);

    // Never offer something that would make them late.
    if (candidate + journey > arrivalDeadline) continue;

    // Only worth mentioning if it is clearly better.
    if (index >= requestedIndex - 8) continue;

    if (!best || index < best.index) best = { minutes: candidate, index };
  }

  if (!best) return null;

  return {
    time: toTimeString(best.minutes),
    demandLabel: DEMAND_LEVEL_LABEL[levelForIndex(best.index)],
  };
}

/** Builds the card for a proposed departure time, with all the checks applied. */
function buildDepartureCard(
  context: AssistantContext,
  departure: string
): ProposalCard {
  const slot = roundToSlot(toMinutes(departure) ?? 0);
  const index = context.demandAt(slot);
  const level = levelForIndex(index);

  const journey = estimateJourneyMinutes(context.typicalJourneyMinutes, index);
  const arrival = slot + journey;
  const deadline = toMinutes(context.requiredArrival) ?? 24 * 60;

  return {
    updatedDeparture: toTimeString(slot),
    demandIndex: index,
    demandLevel: level,
    demandLabel: DEMAND_LEVEL_LABEL[level],
    estimatedArrival: toTimeString(arrival),
    arrivesInTime: arrival <= deadline,
    quieterAlternative: findQuieterAlternative(context, slot),
  };
}

/** Sentences appended when a proposed time has a problem worth flagging. */
function departureNotes(card: ProposalCard, context: AssistantContext): string {
  const notes: string[] = [];

  if (card.arrivesInTime === false) {
    notes.push(
      `Be aware: at that time the journey is estimated at around ${estimateJourneyMinutes(
        context.typicalJourneyMinutes,
        card.demandIndex ?? 0
      )} minutes, which would put you past your ${formatTime(
        context.requiredArrival
      )} arrival.`
    );
  } else if (card.estimatedArrival) {
    notes.push(`That puts your estimated arrival around ${formatTime(card.estimatedArrival)}.`);
  }

  if (card.quieterAlternative) {
    notes.push(
      `Demand around that time is predicted to be ${card.demandLabel?.toLowerCase()}. ` +
        `${formatTime(card.quieterAlternative.time)} is predicted to be ` +
        `${card.quieterAlternative.demandLabel.toLowerCase()} if you would prefer that — ` +
        `but I will save whichever you choose.`
    );
  }

  return notes.join(" ");
}

/* -------------------------------------------------------------------------- */

export function buildAssistantReply(
  intent: ParsedIntent,
  context: AssistantContext
): AssistantReply {
  switch (intent.kind) {
    case "GREETING":
      return {
        text:
          `Hello — I am ${ASSISTANT_NAME}, your travel guide for ${context.cityName}.\n\n` +
          `Right now you are set to leave at ${formatTime(context.currentDeparture)}. Tell me if that changes and I will keep everything up to date.\n\n` +
          "You can also just ask me about CityFlow AI — where to report a pothole, what the demand number means, who can see your data. I will tell you where to find things.",
        proposal: null,
        requiresConfirmation: false,
      };

    case "SMALL_TALK": {
      if (intent.smallTalk === "farewell") {
        return {
          text: "Safe journey. I will be here whenever your plan changes.",
          proposal: null,
          requiresConfirmation: false,
        };
      }

      if (intent.smallTalk === "thanks") {
        return {
          text: "Happy to help. Anything else about today's travel, or about how CityFlow AI works?",
          proposal: null,
          requiresConfirmation: false,
        };
      }

      /*
        "yes" / "ok" on its own. If they meant to accept a proposal, the Confirm
        button is what actually saves it — nothing is ever stored from a typed
        "yes", because the card is the record of exactly what was agreed to.
      */
      return {
        text:
          "Noted. If you were agreeing to a change I suggested, press Confirm on the card — I only save what you have actually seen and agreed to on screen.",
        proposal: null,
        requiresConfirmation: false,
      };
    }

    case "ASK_APP_HELP": {
      const topic = findTopic(intent.topicId ?? "");

      if (!topic) break;

      return {
        text: topic.answer,
        proposal: null,
        requiresConfirmation: false,
        link: topic.where,
      };
    }

    case "HELP":
      return {
        text:
          "Two kinds of thing.\n\n" +
          "CHANGE TODAY'S TRAVEL — just tell me:\n" +
          "• “I want to leave at 6 PM today”\n" +
          "• “I need to reach office by 9”\n" +
          "• “I can leave 30 minutes late today”\n" +
          "• “I don't want to leave before 8”\n" +
          "• “I want to take the metro”\n" +
          "• “I'm not travelling today”\n\n" +
          "ASK ME ABOUT CITYFLOW AI — I will answer and point you to the page:\n" +
          "• “Where do I report a pothole?”\n" +
          "• “How do I change my usual departure time?”\n" +
          "• “What does the 0-100 number mean?”\n" +
          "• “Who can see my data?”\n" +
          "• “Why was I given this time?”\n" +
          "• “Do I get any rewards?”\n\n" +
          "I also answer questions about today — “when should I leave?”, “what is traffic like at 6?”.\n\n" +
          "What I am not: a general chatbot. I match patterns rather than think, so I will not manage your calendar or discuss the weather. And I never save anything you have not seen and agreed to on screen first.",
        proposal: null,
        requiresConfirmation: false,
      };

    case "ASK_RECOMMENDATION": {
      const slot = roundToSlot(toMinutes(context.recommendedDeparture) ?? 0);
      const index = context.demandAt(slot);
      const label = DEMAND_LEVEL_LABEL[levelForIndex(index)];

      return {
        text: `For today I would suggest leaving around ${formatSlotLabel(
          slot
        )}. Predicted demand then is ${label.toLowerCase()}, and it keeps you within your ${formatTime(
          context.requiredArrival
        )} arrival. Your usual time is ${formatTime(context.usualDeparture)}.`,
        proposal: null,
        requiresConfirmation: false,
      };
    }

    case "ASK_TRAFFIC": {
      const slot = roundToSlot(
        toMinutes(intent.referencedTime ?? context.currentDeparture) ?? 0
      );
      const index = context.demandAt(slot);
      const label = DEMAND_LEVEL_LABEL[levelForIndex(index)];

      return {
        text: `Around ${formatSlotLabel(
          slot
        )} in ${context.cityName}, predicted travel demand is ${label.toLowerCase()} (${index} on a 0–100 index). That is a model prediction of how many trips are expected, not a live measurement of traffic on the road.`,
        proposal: null,
        requiresConfirmation: false,
      };
    }

    case "CANCEL_TRIP":
      return {
        text: intent.requiresConfirmation
          ? "It sounds like you may not be travelling today. Shall I remove your trip from today's plan?"
          : "Understood — I will mark you as not travelling today, and remove your trip from today's demand figures.",
        proposal: { cancel: true },
        requiresConfirmation: intent.requiresConfirmation,
      };

    case "REVERT_TO_USUAL": {
      const card = buildDepartureCard(context, context.usualDeparture);
      return {
        text: `Back to your usual ${formatTime(context.usualDeparture)} departure. ${departureNotes(
          card,
          context
        )}`.trim(),
        proposal: card,
        requiresConfirmation: false,
      };
    }

    case "CHANGE_ROUTE":
      return {
        text:
          "Changing where you travel to or from is a change to your routine rather than to today's timing, so I do not do it from here — putting your trip in the wrong area would quietly distort the demand figures.\n\n" +
          "You can update your home area or destination on the My profile page, and today's recommendation is recalculated the moment you save it.\n\n" +
          "If it is only today's TIMING that has changed, tell me the time instead — for example “I want to leave at 6 PM today”.",
        proposal: null,
        requiresConfirmation: false,
      };

    case "SET_MODE": {
      if (!intent.proposal?.transportMode) {
        // A negative sentence ("I don't want to drive") tells us what NOT to do,
        // which is not enough to store. Ask rather than guess.
        return {
          text: "Which way would you like to travel today instead — bus, metro, bike, cycling, walking, or something else?",
          proposal: null,
          requiresConfirmation: false,
        };
      }

      const mode = getTransportMode(intent.proposal.transportMode);
      const roadNote =
        mode.roadImpact === "none"
          ? " That trip does not use road capacity at all, which helps the network as well as you."
          : "";

      return {
        text: intent.requiresConfirmation
          ? `Shall I record that you are travelling by ${mode.label.toLowerCase()} today?`
          : `Noted — travelling by ${mode.label.toLowerCase()} today.${roadNote}`,
        proposal: { transportMode: intent.proposal.transportMode },
        requiresConfirmation: intent.requiresConfirmation,
      };
    }

    case "NOT_BEFORE": {
      if (!intent.proposal?.updatedDeparture) {
        return {
          text: `Understood — nothing before ${formatTime(
            intent.referencedTime ?? context.currentDeparture
          )}. Your current plan of ${formatTime(
            context.currentDeparture
          )} already respects that, so nothing needs to change.`,
          proposal: null,
          requiresConfirmation: false,
        };
      }

      const card = buildDepartureCard(context, intent.proposal.updatedDeparture);
      return {
        text: `Understood — nothing before ${formatTime(
          intent.referencedTime ?? ""
        )}. Your current plan is earlier than that, so shall I move you to ${formatTime(
          intent.proposal.updatedDeparture
        )}? ${departureNotes(card, context)}`.trim(),
        proposal: card,
        requiresConfirmation: true,
      };
    }

    case "SET_ARRIVAL": {
      const card = buildDepartureCard(context, intent.proposal!.updatedDeparture!);

      return {
        text: `To arrive by ${formatTime(
          intent.referencedTime ?? ""
        )}, leaving around ${formatTime(
          card.updatedDeparture!
        )} would work, based on the ${context.typicalJourneyMinutes}-minute journey time in your profile. ${departureNotes(
          card,
          context
        )} Shall I save that?`.trim(),
        proposal: card,
        requiresConfirmation: true,
      };
    }

    case "SHIFT_DEPARTURE":
    case "SET_DEPARTURE": {
      const proposed = intent.proposal?.updatedDeparture;
      if (!proposed) break;

      const card = buildDepartureCard(context, proposed);
      const timeLabel = formatTime(card.updatedDeparture!);

      if (intent.requiresConfirmation) {
        const because =
          intent.confirmationReason === "ambiguous-time"
            ? ` I have read that as ${timeLabel} — tell me if you meant the other one.`
            : "";

        return {
          text: `Would you like me to update your travel plan to ${timeLabel}?${because} ${departureNotes(
            card,
            context
          )}`.trim(),
          proposal: card,
          requiresConfirmation: true,
        };
      }

      return {
        text: `Updating your plan to ${timeLabel}. ${departureNotes(card, context)}`.trim(),
        proposal: card,
        requiresConfirmation: false,
      };
    }

    default:
      break;
  }

  /*
    Nothing matched. Two different failures, and they deserve different replies.

    If a topic ALMOST matched — somebody typed "pothole" on its own — offer it
    as a question. Answering outright would be pretending to a confidence the
    match does not have, and being wrong about what someone asked is worse than
    admitting the guess.
  */
  const suggested = findTopic(intent.suggestedTopicId ?? "");

  if (suggested) {
    return {
      text:
        `I am not certain I followed that. Did you want to know about ${suggested.title.toLowerCase()}?\n\n` +
        `${suggested.answer}\n\n` +
        "If that was not it, try asking in a few more words — or say “help” to see everything I can do.",
      proposal: null,
      requiresConfirmation: false,
      link: suggested.where,
    };
  }

  return {
    text:
      "I did not follow that one, and I would rather say so than guess.\n\n" +
      "I am good at two things — changing today's travel, and explaining how CityFlow AI works:\n" +
      "• “I want to leave at 6 PM today”\n" +
      "• “I need to reach office by 9”\n" +
      "• “I'm not travelling today”\n" +
      "• “When should I leave?”\n" +
      "• “Where do I report a pothole?”\n" +
      "• “Who can see my data?”\n\n" +
      "Say “help” for the full list. To change WHERE you travel, edit your home area or destination on the My profile page.",
    proposal: null,
    requiresConfirmation: false,
  };
}
