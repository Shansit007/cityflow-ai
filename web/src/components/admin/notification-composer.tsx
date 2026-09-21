"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, TextareaField, TextField } from "@/components/ui/input";
import type { CityCode } from "@/lib/cities";
import { adminNotificationSchema, fieldErrorsFrom } from "@/lib/validation";

interface NotificationComposerProps {
  cityCode: CityCode;
}

const EMPTY = { title: "", message: "" };

/**
 * Send a notice to a city.
 *
 * WHY "DEMO DELIVERY"
 * This really does write a row that really does appear in the feed below.
 * What it does not do is reach anybody's phone — CityFlow AI has no push,
 * SMS or email sender wired up, and the badge says so rather than implying a
 * delivery channel that does not exist.
 */
export function NotificationComposer({ cityCode }: NotificationComposerProps) {
  const router = useRouter();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function update(patch: Partial<typeof EMPTY>) {
    setSent(false);
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSent(false);

    const payload = { cityCode, title: values.title, message: values.message };

    const parsed = adminNotificationSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      setFormError("Please check the highlighted fields.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Could not send that notice.");
        if (data.fieldErrors) setErrors(data.fieldErrors);
        return;
      }

      setValues(EMPTY);
      setSent(true);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Send a notice"
        description="Recorded here and shown in the feed below. Not pushed to a phone."
        action={<Badge tone="secondary">Demo delivery</Badge>}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Notice tone="error">{formError}</Notice>}
        {sent && <Notice tone="success">Notice sent. It appears in the list below.</Notice>}

        <TextField
          label="Title"
          required
          value={values.title}
          onChange={(event) => update({ title: event.target.value })}
          error={errors.title}
          placeholder="e.g. Planned resurfacing on MG Road this weekend"
          maxLength={120}
        />

        <TextareaField
          label="Message"
          required
          value={values.message}
          onChange={(event) => update({ message: event.target.value })}
          error={errors.message}
          placeholder="What commuters in this city need to know."
          maxLength={1000}
        />

        <Button type="submit" loading={sending} size="lg">
          Send notice
        </Button>
      </form>
    </Card>
  );
}
