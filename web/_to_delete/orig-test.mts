import { parseIntent, type IntentContext } from "./orig-intent-parser";

const ctx: IntentContext = {
  usualDeparture: "09:00",
  currentDeparture: "09:00",
  requiredArrival: "10:00",
  typicalJourneyMinutes: 45,
  primaryMode: "CAR",
};

const result = parseIntent("I'm not leaving before 8", ctx);
console.log(JSON.stringify(result));
