import { parseIntent, type IntentContext } from "./src/lib/chat/intent-parser";

const ctx: IntentContext = {
  usualDeparture: "09:00",
  currentDeparture: "09:00",
  requiredArrival: "10:00",
  typicalJourneyMinutes: 45,
  primaryMode: "CAR",
};

const cases = [
  "I am not going to the office today, but I am going to the cinema at 10 AM",
  "I am not going to Whitefield. I am going to Church Street.",
  "I am not going home tonight. I am going out for dinner with my friends.",
  "I am not travelling today",
  "I'm not leaving before 8",
  "I don't want to drive today, I'll take the metro instead",
  "My office moved, I need to work from a different location now",
  "I want to leave at 6 PM today",
  "I need to reach office by 9",
];

for (const text of cases) {
  const result = parseIntent(text, ctx);
  console.log("---");
  console.log("IN :", text);
  console.log("OUT:", JSON.stringify({ kind: result.kind, proposal: result.proposal, dayPart: result.dayPart, requiresConfirmation: result.requiresConfirmation }));
}
