"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProposalCardView } from "@/components/chat/proposal-card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/input";
import { ASSISTANT_NAME } from "@/lib/chat/branding";
import type { ProposalCard } from "@/lib/chat/assistant";
import type { ChatMessageView } from "@/lib/chat/history-service";
import { cn } from "@/lib/utils";

/**
 * The assistant console — a full page, not a popup.
 *
 * The conversation is loaded from the server, so it is the same on every device
 * and survives closing the tab. The transcript is a record only: every travel
 * decision the system acts on is the structured plan the person confirmed, and
 * the whole conversation can be deleted from here without touching those plans.
 */

const SUGGESTIONS = [
  "I want to leave at 6 PM today",
  "I need to reach office by 9",
  "I can leave 30 minutes late today",
  "I don't want to leave before 8",
  "I want to take the metro",
  "When should I leave?",
];

interface AssistantConsoleProps {
  initialMessages: ChatMessageView[];
  displayName: string;
}

export function AssistantConsole({
  initialMessages,
  displayName,
}: AssistantConsoleProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view whenever the list grows.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || thinking) return;

    setError(null);
    setInput("");
    setThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "The assistant could not respond. Please try again.");
        return;
      }

      const userMessage = data.userMessage as ChatMessageView;
      const assistantMessage = data.assistantMessage as ChatMessageView;

      setMessages((current) => [...current, userMessage, assistantMessage]);

      // A clear, unhedged instruction is acted on straight away — the assistant
      // already said it was doing it. Anything hedged or ambiguous arrives with
      // requiresConfirmation set and waits for the button instead.
      if (assistantMessage.proposal && !assistantMessage.requiresConfirmation) {
        await confirmProposal(assistantMessage.proposal, assistantMessage.id);
      }
    } catch {
      setError("Could not reach the assistant. Please check your connection.");
    } finally {
      setThinking(false);
    }
  }

  async function confirmProposal(proposal: ProposalCard, messageId: string) {
    setSavingId(messageId);
    setError(null);

    try {
      const response = await fetch("/api/intent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          updatedDeparture: proposal.updatedDeparture,
          transportMode: proposal.transportMode,
          cancel: proposal.cancel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "We could not save that. Please try again.");
        return;
      }

      setMessages((current) => [
        ...current.map((message) =>
          message.id === messageId
            ? { ...message, resolved: true, outcome: data.confirmationText as string }
            : message
        ),
        data.followUp as ChatMessageView,
      ]);

      // The dashboard's server components need to pick up the new plan.
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function dismissProposal(messageId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, resolved: true, outcome: "No change saved." }
          : message
      )
    );
  }

  async function clearConversation() {
    setClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/history", { method: "DELETE" });
      if (!response.ok) {
        setError("Could not clear the conversation. Please try again.");
        return;
      }

      setMessages([]);
      setConfirmingClear(false);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col rounded-card border border-border-base bg-surface shadow-card">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-base p-4">
        <p className="text-sm text-muted">
          {messages.length === 0
            ? "No conversation yet"
            : `${messages.length} message${messages.length === 1 ? "" : "s"} in your history`}
        </p>

        {messages.length > 0 &&
          (confirmingClear ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">
                Delete the whole conversation? Your saved travel plans are not affected.
              </span>
              <Button size="sm" variant="danger" onClick={clearConversation} loading={clearing}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmingClear(true)}>
              Clear conversation
            </Button>
          ))}
      </div>

      {/* -------------------------------------------------------- messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-8 text-center">
            <h2 className="text-lg font-semibold text-fg">
              Hello {displayName}, I am {ASSISTANT_NAME}.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              Tell me about your travel plan for today and I will keep your recommendation up
              to date — and keep the city&apos;s demand picture honest at the same time.
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-subtle">
              I understand travel sentences rather than open conversation, and I always show
              you exactly what will be saved before saving it.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] sm:max-w-[70%]",
              message.role === "USER" ? "ml-auto" : "mr-auto"
            )}
          >
            <p
              className={cn(
                "mb-1 text-[0.65rem] uppercase tracking-wider",
                message.role === "USER" ? "text-right text-subtle" : "text-subtle"
              )}
            >
              {message.role === "USER" ? "You" : ASSISTANT_NAME}
            </p>

            <div
              className={cn(
                "whitespace-pre-line rounded-card px-4 py-3 text-sm leading-relaxed",
                message.role === "USER"
                  ? "bg-primary text-on-primary"
                  : "border border-border-base bg-surface-2 text-fg"
              )}
            >
              {message.text}
            </div>

            {message.role === "ASSISTANT" && message.proposal && (
              <ProposalCardView
                proposal={message.proposal}
                pending={!message.resolved && message.requiresConfirmation}
                saving={savingId === message.id}
                onConfirm={(proposal) => confirmProposal(proposal, message.id)}
                onDismiss={() => dismissProposal(message.id)}
                outcome={message.outcome}
              />
            )}
          </div>
        ))}

        {thinking && (
          <p className="text-xs text-subtle">{ASSISTANT_NAME} is reading that…</p>
        )}
      </div>

      {error && (
        <div className="px-4 pb-2 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* ------------------------------------------------------ suggestions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border-base px-4 py-3 sm:px-6">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-full border border-border-base px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------- composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="border-t border-border-base p-4 sm:p-5"
      >
        <div className="flex gap-2">
          <label htmlFor="assistant-input" className="sr-only-cf">
            Message {ASSISTANT_NAME}
          </label>
          <input
            ref={inputRef}
            id="assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Message ${ASSISTANT_NAME} — e.g. I want to leave at 6 PM today`}
            maxLength={400}
            autoComplete="off"
            className="h-12 flex-1 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm text-fg placeholder:text-subtle"
          />
          <Button type="submit" size="lg" disabled={thinking || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
