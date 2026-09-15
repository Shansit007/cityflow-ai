import type { Confirmation, Priority } from "@/lib/classify";

const CONFIRMATION_STYLES: Record<Confirmation, string> = {
  Confirmed: "bg-[#dff2e6] text-[#0f6b06]",
  "Under Review": "bg-[#e1edf9] text-[#1e5fa8]",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: "bg-[#fbe4e1] text-[#c62f1d]",
  High: "bg-[#fbebd6] text-[#b4690e]",
  Medium: "bg-[#f7f1d4] text-[#8a7a0a]",
  Review: "bg-[#e1edf9] text-[#1e5fa8]",
};

const BASE = "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold";

export function ConfirmationBadge({ value }: { value: Confirmation }) {
  return <span className={`${BASE} ${CONFIRMATION_STYLES[value]}`}>{value}</span>;
}

export function PriorityBadge({ value }: { value: Priority }) {
  return <span className={`${BASE} ${PRIORITY_STYLES[value]}`}>{value}</span>;
}
