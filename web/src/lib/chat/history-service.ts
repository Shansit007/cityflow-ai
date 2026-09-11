import type { ChatMessage } from "@prisma/client";

import type { AssistantReply, ProposalCard } from "@/lib/chat/assistant";
import { prisma } from "@/lib/db";

/**
 * Reading and writing the assistant's conversation history.
 *
 * The transcript is a RECORD, never an input. Nothing in the recommendation or
 * demand pipeline reads these rows; they exist so a person can scroll back and
 * see what they asked for and what was saved.
 */

/** How many messages to keep on screen. Older ones stay in the database. */
export const HISTORY_PAGE_SIZE = 100;

/** The shape the browser works with. */
export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
  proposal: ProposalCard | null;
  requiresConfirmation: boolean;
  resolved: boolean;
  outcome: string | null;
  /** An optional "take me there" link rendered under the message. */
  link: AssistantReply["link"] | null;
  createdAt: string;
}

/** Converts a database row into the browser-facing shape. */
export function toView(row: ChatMessage): ChatMessageView {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    // Prisma types a Json column as JsonValue, which TypeScript will not narrow
    // to our own shape directly — hence the two-step cast. What went in was a
    // ProposalCard, so what comes out is one.
    proposal: (row.proposal as unknown as ProposalCard | null) ?? null,
    requiresConfirmation: row.requiresConfirmation,
    resolved: row.resolved,
    outcome: row.outcome,
    link: (row.link as unknown as AssistantReply["link"] | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The most recent messages, oldest first (which is how a chat reads). */
export async function loadHistory(
  userId: string,
  take = HISTORY_PAGE_SIZE
): Promise<ChatMessageView[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.reverse().map(toView);
}

/** Stores what the person typed. */
export async function recordUserMessage(
  userId: string,
  text: string
): Promise<ChatMessageView> {
  const row = await prisma.chatMessage.create({
    data: { userId, role: "USER", text },
  });

  return toView(row);
}

/** Stores what the assistant answered, along with any proposal card. */
export async function recordAssistantMessage(args: {
  userId: string;
  text: string;
  proposal: ProposalCard | null;
  requiresConfirmation: boolean;
  link?: AssistantReply["link"];
}): Promise<ChatMessageView> {
  const row = await prisma.chatMessage.create({
    data: {
      userId: args.userId,
      role: "ASSISTANT",
      text: args.text,
      // Prisma's Json column rejects `undefined`; null is the empty value.
      proposal: args.proposal ? JSON.parse(JSON.stringify(args.proposal)) : undefined,
      link: args.link ? JSON.parse(JSON.stringify(args.link)) : undefined,
      requiresConfirmation: args.requiresConfirmation,
      // A message awaiting a Confirm press is not resolved yet.
      resolved: !args.requiresConfirmation,
    },
  });

  return toView(row);
}

/**
 * Marks a proposal as dealt with, and records what happened.
 * Scoped by userId so one person can never resolve another person's card.
 */
export async function resolveMessage(
  userId: string,
  messageId: string,
  outcome: string
): Promise<void> {
  await prisma.chatMessage.updateMany({
    where: { id: messageId, userId },
    data: { resolved: true, outcome },
  });
}

/** Deletes the whole conversation for one person. */
export async function clearHistory(userId: string): Promise<number> {
  const result = await prisma.chatMessage.deleteMany({ where: { userId } });
  return result.count;
}
