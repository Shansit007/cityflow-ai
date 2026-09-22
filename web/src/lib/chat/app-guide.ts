import { ASSISTANT_NAME } from "@/lib/chat/branding";

/**
 * SAARTHI'S KNOWLEDGE OF CITYFLOW AI ITSELF.
 *
 * ============================== WHY THIS EXISTS =============================
 * A commuter's questions are not only "when should I leave?". They are also
 * "where do I report a pothole?", "what does this 0-100 number mean?", "who
 * actually sees my data?", "how do I change my office address?".
 *
 * Before this file, every one of those hit the parser's UNKNOWN branch and got
 * a polite list of travel sentences — which is a bad answer, because the person
 * asked something perfectly reasonable and the product does have an answer. An
 * assistant that only understands commands but cannot explain the thing it is
 * embedded in is not much of a guide, and "Saarthi" means guide.
 *
 * ============================ HOW IT IS BUILT ===============================
 * Still no language model — same reasons as the intent parser: free, offline,
 * deterministic and auditable. This is a hand-written knowledge base with a
 * keyword scorer. Every answer is written once, here, so the assistant can
 * never drift away from what the product actually does.
 *
 * THE HARD RULE FOR EVERY ANSWER BELOW: it must be true of the application as
 * it exists. No feature that is planned, no capability that is aspirational. If
 * something is not built, the answer says it is not built. An assistant that
 * confidently describes a screen the person then cannot find is worse than one
 * that says "I don't know" — it wastes their time and costs them their trust in
 * everything else it said.
 * ============================================================================
 */

export interface AppTopic {
  id: string;
  /** Short title, used when offering "did you mean…". */
  title: string;
  /**
   * Words and phrases that point at this topic. Multi-word entries score higher
   * than single words, because "road issue" is far more specific than "road".
   */
  keywords: string[];
  /**
   * Single words that identify this topic on their own.
   *
   * Most single words are weak evidence — "road" could mean five things. But a
   * few are unambiguous in this product: nothing except the rewards topic is
   * about "rewards", and nothing except the history topic is about "history".
   * Those score as much as a two-word phrase, so "do I get any rewards?" is
   * answered instead of falling through to a generic "I did not follow that".
   */
  strongKeywords?: string[];
  /** The answer. Plain text; "\n" becomes a line break in the chat bubble. */
  answer: string;
  /** Where in the app this lives, offered as a link under the answer. */
  where?: { label: string; href: string };
}

export const APP_TOPICS: AppTopic[] = [
  /* ---------------------------------------------------- the core idea ---- */
  {
    id: "what-is-cityflow",
    title: "What CityFlow AI is",
    keywords: [
      "what is cityflow",
      "what does cityflow do",
      "what is this app",
      "what is this website",
      "about cityflow",
      "purpose of this app",
      "what do you do",
      "explain the app",
    ],
    answer:
      "CityFlow AI tries to stop congestion forming, rather than routing you around it after it has.\n\n" +
      "Most traffic apps ask “which road should this vehicle take?”. CityFlow AI asks “how do we stop too many vehicles entering the road network at the same time?”\n\n" +
      "So instead of a route, you get a suggested departure time — one that keeps you inside the arrival you need, and spreads the morning rush across a wider window instead of squeezing everyone into the same fifteen minutes.",
    where: { label: "How it works", href: "/how-it-works" },
  },
  {
    id: "demand-smoothing",
    title: "Demand smoothing, and why the peak does not just move",
    keywords: [
      "demand smoothing",
      "smooth demand",
      "move the peak",
      "moving congestion",
      "shift the peak",
      "everyone leaves at the same time",
      "wont everyone",
      "will everyone get the same time",
      "peak",
    ],
    answer:
      "This is the fair question to ask about the whole idea: if CityFlow AI tells everybody to leave at 8:45, has it not just created a new rush at 8:45?\n\n" +
      "It cannot, and here is the mechanism. The demand figure the engine reads already includes everybody else's confirmed plans. The moment people start moving to 8:45, 8:45's number goes up — for the next person who asks, and for the recalculation that runs afterwards.\n\n" +
      "So people get spread across 8:30, 8:45 and 9:00 rather than stacked on one slot. That is the difference between smoothing demand and moving congestion, and it is the reason this project exists.",
    where: { label: "How it works", href: "/how-it-works#demand-smoothing" },
  },

  /* ------------------------------------------------ using the product ---- */
  {
    id: "change-departure",
    title: "Changing today's departure time",
    keywords: [
      "change my departure",
      "change departure time",
      "change my time",
      "update my time",
      "how do i change the time",
      "different time today",
      "change today",
      "leave at a different time",
    ],
    answer:
      "Just tell me, in your own words — “I want to leave at 6 PM today”, or “I can leave 30 minutes late today”.\n\n" +
      "I will show you exactly what would be saved before saving it, including what demand looks like at that time and whether you would still arrive by your deadline. If anything about your sentence is unclear, I ask first rather than guessing.\n\n" +
      "This changes TODAY only. Your regular routine stays as it is.",
  },
  {
    id: "change-routine",
    title: "Changing your regular routine",
    keywords: [
      "change my routine",
      "edit my routine",
      "change my usual time",
      "permanently",
      "every day",
      "change my address",
      "change my office",
      "change home area",
      "change destination",
      "new office",
      "change journey time",
      "change flexibility",
      "edit profile",
      "my profile",
    ],
    answer:
      "Your regular routine — home area, destination, usual departure, required arrival, journey time, how flexible you are, transport modes and privacy choices — all live on the My profile page. Change anything and today's recommendation is recalculated the moment you save.\n\n" +
      "That page is for a PERMANENT change — one that should be true every future day, such as a new office or a house move. For a one-off change to today only, tell me directly and I will update just today's plan — for example “I'm not going to the office today, I'm going to Church Street instead” or “I'm not going home tonight, I'm going out for dinner”.",
    where: { label: "My profile", href: "/profile" },
  },
  {
    id: "confirming-a-plan",
    title: "What confirming a plan actually does",
    keywords: [
      "confirm",
      "why confirm",
      "what happens when i confirm",
      "when i confirm",
      "does it save",
      "is it saved",
      "what does confirm do",
    ],
    answer:
      "Confirming does two things.\n\n" +
      "For you: it becomes your plan for today, and your dashboard updates.\n\n" +
      "For everyone else: your trip joins the city's demand figures for that fifteen-minute slot. That is what lets the next person's recommendation take you into account — and it is the only reason the spreading works at all. A plan nobody confirms is invisible to the system.\n\n" +
      "You can change it again any time, and nothing is ever saved from our conversation without you agreeing to it on screen first.",
  },
  {
    id: "recommendation-explained",
    title: "Why you were given that time",
    keywords: [
      "why this time",
      "why am i seeing",
      "how is the recommendation made",
      "how do you decide",
      "how does it work",
      "where does the time come from",
      "why that time",
      "explain the recommendation",
      "why was i given",
      "why was i",
      "why did you",
      "what happens when",
    ],
    answer:
      "Your dashboard has a “Why am I seeing this?” link under the recommendation that opens the actual numbers behind it.\n\n" +
      "The short version: I look only at times you agreed to consider — earlier, later, or neither — throw away any that would make you miss your required arrival, then pick the quietest one that is left. If nothing is meaningfully better than your usual time, I recommend keeping your usual time and say so.\n\n" +
      "A recommendation is a suggestion. Keeping your normal time is never the wrong answer.",
    where: { label: "My dashboard", href: "/dashboard" },
  },

  /* ------------------------------------------------------- the numbers --- */
  {
    id: "demand-index",
    title: "What the 0-100 demand number means",
    keywords: [
      "demand index",
      "0-100",
      "what does the number mean",
      "what is the number",
      "demand score",
      "what does 70 mean",
      "index",
      "low moderate high",
    ],
    answer:
      "It is a predicted demand index from 0 to 100 — how many trips are expected to start in that fifteen-minute slot, relative to what the network handles comfortably. Low, Moderate, High and Very high are just bands of that number.\n\n" +
      "Two honest points about it. It is a PREDICTION of travel demand, not a measurement of vehicles on the road — there are no road sensors behind it. And the baseline is a model of how city travel demand behaves through a day, adjusted by the plans people have actually confirmed. So treat it as a well-reasoned estimate, never as a fact.",
  },
  {
    id: "is-it-real-traffic",
    title: "Whether the figures are real measured traffic",
    keywords: [
      "is this real",
      "real traffic",
      "real data",
      "is it accurate",
      "how accurate",
      "live traffic",
      "actual traffic",
      "is it measured",
      "google maps",
    ],
    answer:
      "No, and I would rather tell you that plainly than let you assume otherwise.\n\n" +
      "CityFlow AI does not have road sensors or a live traffic feed. The demand curve is a model of how urban travel demand typically behaves across a day, adjusted by the travel plans real registered users have confirmed. Journey and arrival estimates are based on the journey time you entered in your own profile.\n\n" +
      "What that means for you: the RELATIVE picture — this slot is busier than that one — is the useful part. Any single number is an estimate.",
  },

  /* ---------------------------------------------------------- privacy ---- */
  {
    id: "cityflow-id",
    title: "Your CityFlow ID",
    keywords: [
      "cityflow id",
      "my id",
      "what is cf",
      "anonymous id",
      "where is my id",
      "what is that code",
    ],
    answer:
      "Your CityFlow ID is the anonymous identifier — something like CF-8X42K91 — that stands in for you everywhere except signing in.\n\n" +
      "Your email address is used for authentication, account recovery and service messages, and for nothing else. It never appears in traffic analysis or in any city-level report.\n\n" +
      "You can see your ID in the top bar, and on your profile page.",
    where: { label: "My profile", href: "/profile" },
  },
  {
    id: "privacy",
    title: "Who can see your data",
    keywords: [
      "privacy",
      "who can see",
      "is my data safe",
      "who sees my data",
      "data protection",
      "tracking me",
      "are you tracking",
      "personal data",
      "government see",
      "share my data",
      "delete my data",
    ],
    strongKeywords: ["privacy", "anonymous"],
    answer:
      "Nobody can look at you individually — not the CityFlow AI team, not an administrator.\n\n" +
      "City-level analysis works on counts and averages: “8 trips expected between 8:45 and 9:00”, never “this person is travelling at 8:45”. That is not a promise about how carefully people behave; the aggregated table has no user column in it, so an individual cannot be shown even by mistake.\n\n" +
      "You also control whether your trips count towards city figures at all — one switch on your profile. Switch it off and you are excluded from every figure and every export, while your own recommendations carry on working.\n\n" +
      "Our whole conversation can be deleted from the top of this page, and deleting it does not touch your saved travel plans.",
    where: { label: "My profile", href: "/profile" },
  },
  {
    id: "location-tracking",
    title: "Whether your location is tracked",
    keywords: [
      "location",
      "gps",
      "track my location",
      "do you track me",
      "where i am",
      "follow me",
    ],
    answer:
      "Your location is only used when you deliberately ask for it, and it is never a continuous track.\n\n" +
      "Two places use it. Reporting a road issue, if you press “Use my current location” — that attaches one point to that one report. And road sensing while you travel, which you start and stop yourself: it sends only the places where a jolt happened, never a trace of your journey, and “Stop and discard” sends nothing at all.\n\n" +
      "Everywhere else, CityFlow AI works from the AREA names you typed in your profile, not from where your phone is.",
  },

  /* ---------------------------------------------------------- roads ------ */
  {
    id: "report-road-issue",
    title: "Reporting a pothole or road problem",
    keywords: [
      "report a pothole",
      "report pothole",
      "pothole",
      "report a road",
      "road issue",
      "bad road",
      "broken road",
      "report damage",
      "waterlogging",
      "where do i report",
      "complaint",
      "report a problem",
    ],
    strongKeywords: ["pothole", "potholes"],
    answer:
      "The Road conditions page has a form — it takes about thirty seconds. Pick where, what kind of problem, and how bad it is; a photo and your exact location are optional but both help.\n\n" +
      "If you add a photo, your phone briefly analyses it for the kind of dark, irregular patches a broken surface tends to show, and tells you what it found. That runs entirely on your device, is never sent anywhere, and is only ever a hint — it never picks the problem type or severity for you.\n\n" +
      "Your report is merged with other reports about the same spot. A single report is always shown as a “possible” road issue; it takes several independent people agreeing before it is called likely. That is deliberate — one person's word is not proof, and a system that cried wolf would be ignored.",
    where: { label: "Road conditions", href: "/roads" },
  },
  {
    id: "road-sensing",
    title: "Road sensing with your phone",
    keywords: [
      "road sensing",
      "sensor",
      "accelerometer",
      "detect potholes",
      "automatic detection",
      "phone detect",
      "motion sensor",
    ],
    answer:
      "On the Road conditions page you can start road sensing before a trip. Your phone's motion sensors watch for sharp jolts and note where they happened.\n\n" +
      "What it honestly cannot do: tell a pothole from a speed breaker, a kerb or a railway crossing. They all feel the same to an accelerometer. So everything it records is a “possible” road impact and counts as half the evidence of a report a person filled in by hand.\n\n" +
      "Two practical notes: it needs a secure (https) connection, so it will not work if you are testing on localhost, and the page has to stay open — browsers pause sensors in a background tab.",
    where: { label: "Road conditions", href: "/roads" },
  },
  {
    id: "who-fixes-roads",
    title: "Who actually repairs the roads",
    keywords: [
      "who fixes",
      "when will it be fixed",
      "repair",
      "municipal",
      "corporation",
      "will it be repaired",
      "what happens to my report",
      "after i report",
      "status of my report",
    ],
    answer:
      "Not CityFlow AI, and I will not pretend otherwise.\n\n" +
      "What we do: collect reports, merge duplicates, work out how strong the evidence is, and rank them — including by how many trips actually pass through that area, which is something a normal complaints inbox has no way of knowing. A dangerous pothole on a road four hundred people cross every morning should not sit behind one on a quiet lane.\n\n" +
      "That ranked list is handed to the municipal road-maintenance system, which is a separate service. Inspection, repair and progress tracking all happen there.\n\n" +
      "So I can tell you a report was passed on. I cannot tell you when something will be fixed, because nobody tells us.",
    where: { label: "Road conditions", href: "/roads" },
  },

  /* ------------------------------------------------- participation ------- */
  {
    id: "participation",
    title: "My CityFlow participation",
    keywords: [
      "participation",
      "my contribution",
      "what have i done",
      "my stats",
      "my impact",
      "how much have i helped",
      "my participation",
    ],
    strongKeywords: ["participation", "contribution"],
    answer:
      "The My participation page shows what you have actually contributed: days you had a plan, plans you confirmed, how often you moved your departure and by how much, and the road issues you reported.\n\n" +
      "You will notice there is no “time saved” figure. CityFlow AI never measured your real journeys, so any such number would be made up — and a made-up number on a page designed to make you feel good about taking part would be the worst thing this product could do.",
    where: { label: "My participation", href: "/participation" },
  },
  {
    id: "rewards",
    title: "Rewards and benefits",
    keywords: [
      "rewards",
      "points",
      "benefits",
      "discount",
      "incentive",
      "do i get anything",
      "what do i get",
      "prize",
      "free pass",
      "get any rewards",
      "get anything for",
    ],
    strongKeywords: ["rewards", "reward", "points", "incentive"],
    answer:
      "Nothing, today. There are no points, no discounts, and nothing is being counted towards a future reward.\n\n" +
      "The My participation page lists some ideas that have been discussed — concessions for flexible travellers, recognition for road reporting — but every one of them would need a city or transport authority to agree to it, and none has. They are labelled as not existing, because quietly implying you are earning something would be a small lie that grew.",
    where: { label: "My participation", href: "/participation" },
  },

  /* --------------------------------------------------- getting around ---- */
  {
    id: "where-is-dashboard",
    title: "Finding your dashboard",
    keywords: [
      "dashboard",
      "where is my dashboard",
      "home page",
      "main page",
      "my recommendation",
      "where do i see my time",
    ],
    answer:
      "My dashboard, in the top menu. It answers one question first: when should you leave today. Everything under it — the demand strip, the map, your routine, road conditions, your history — is there to explain or support that answer.",
    where: { label: "My dashboard", href: "/dashboard" },
  },
  {
    id: "change-city",
    title: "Changing the city",
    keywords: [
      "change city",
      "switch city",
      "different city",
      "wrong city",
      "which cities",
      "my city",
      "city selector",
    ],
    answer:
      "There is a city selector in the top bar — on a narrow screen it is inside the ☰ menu.\n\n" +
      "Eight cities are supported: Delhi, Bengaluru, Mumbai, Hyderabad, Pune, Bhopal, Chennai and Kolkata. Demand figures, the map and road reports are all specific to the city you have chosen.",
  },
  {
    id: "history",
    title: "Your past recommendations",
    keywords: [
      "history",
      "past recommendations",
      "previous",
      "earlier",
      "what did i do last week",
      "my record",
      "see my history",
    ],
    strongKeywords: ["history"],
    answer:
      "Your dashboard has a history card near the bottom showing past recommendations and what you decided each time.\n\n" +
      "The demand numbers stored with each one are the numbers as they were on that day, not recalculated from today's — otherwise the history would quietly rewrite itself and you could never check what you were actually told.",
    where: { label: "My dashboard", href: "/dashboard" },
  },
  {
    id: "dark-mode",
    title: "Dark mode",
    keywords: ["dark mode", "light mode", "theme", "night mode", "too bright", "colour scheme"],
    answer:
      "The sun/moon button in the top bar switches between light and dark. It remembers your choice, and follows your device setting until you pick one.",
  },
  {
    id: "notifications",
    title: "Notifications",
    keywords: ["notification", "alert", "notify me", "email me", "bell", "remind me"],
    answer:
      "Notifications are in-app only — the bell in the top bar. There is no email or push delivery set up, so nothing will reach your phone when the app is closed.\n\n" +
      "What appears there: when the city-wide recalculation moves your recommended time because other people's confirmed plans changed the picture. You can switch this off in your profile.",
  },
  {
    id: "map",
    title: "The map",
    keywords: ["map", "where is the map", "search a place", "openstreetmap", "pin", "marker"],
    answer:
      "The map is on your dashboard. It uses OpenStreetMap, and you can search for a place in the box above it.\n\n" +
      "Road issues that were reported with exact coordinates appear as pins. Ones reported by area name only do not — dropping a pin in the middle of a neighbourhood would invent a precision the report never had.",
    where: { label: "My dashboard", href: "/dashboard" },
  },
  {
    id: "account",
    title: "Your account",
    keywords: [
      "sign out",
      "log out",
      "logout",
      "password",
      "change my email",
      "delete my account",
      "my email",
      "account",
    ],
    answer:
      "Sign out is in the top bar, and inside the ☰ menu on a narrow screen.\n\n" +
      "Changing your password or email address, and deleting your account, are not built yet. I would rather say that than send you looking for a button that is not there.\n\n" +
      "You can clear our whole conversation from the top of this page, and you can switch off city-level demand sharing on your profile at any time.",
    where: { label: "My profile", href: "/profile" },
  },
  {
    id: "cost",
    title: "Whether it costs anything",
    keywords: ["cost", "free", "pay", "price", "subscription", "charge", "money", "is it free"],
    strongKeywords: ["free", "subscription"],
    answer:
      "It is free, and there is nothing to pay for. This is an academic capstone project, built entirely on free and open tools — there is no paid tier, no advertising and nothing is sold.",
  },

  /* ------------------------------------------------------- the project --- */
  {
    id: "admin-portal",
    title: "The Admin Portal",
    keywords: [
      "admin",
      "admin portal",
      "who runs this",
      "government",
      "authority",
      "control this",
    ],
    answer:
      "There is an Admin Portal, and it belongs to the CityFlow AI project team. It shows city-level demand, how recommendations are being used, road-condition summaries and reports — all as counts and averages, never as individuals.\n\n" +
      "It is not a government service, and CityFlow AI is not an official one. If a public authority ever ran it, that would be a change worth announcing, not something to imply now.",
  },
  {
    id: "simulation",
    title: "How the idea is tested",
    keywords: ["simulation", "sumo", "test", "prove", "evidence", "does it actually work", "research"],
    strongKeywords: ["sumo", "simulation"],
    answer:
      "With SUMO, an open-source traffic simulator, on a road network taken from OpenStreetMap.\n\n" +
      "The experiment is deliberately narrow so the result means something: the same travellers, the same origins and destinations, the same number of trips, run twice — once with everyone leaving at their normal time, once at the times CityFlow AI recommended. The ONLY difference is departure time, so any difference in the result is attributable to the spreading and nothing else.\n\n" +
      "The simulation runs on a workstation, not inside this website. A web app that claimed to have run one would be fabricating the project's main piece of evidence.",
  },
  {
    id: "who-are-you",
    title: `Who ${ASSISTANT_NAME} is`,
    keywords: [
      "who are you",
      "what are you",
      "are you chatgpt",
      "are you ai",
      "are you a bot",
      "are you real",
      "your name",
      "why saarthi",
      "what does saarthi mean",
    ],
    answer:
      `I am ${ASSISTANT_NAME}, the travel guide inside CityFlow AI. Saarthi means charioteer — the one who handles the route so you can think about where you are going.\n\n` +
      "I should be straight with you about what I am. My core is a rule-based assistant — I recognise travel sentences and questions about this app by matching patterns. That is deliberate: it costs nothing to run, it works the same way every time, and you can always be shown exactly why I understood something the way I did. That part of me answers almost everything, on its own, for free.\n\n" +
      "When that part genuinely does not understand a sentence — not even a rough guess — and a hosted language model has been configured, I ask it for a second opinion on what you meant. It is never allowed to invent an answer to a question about the app, and it is never trusted to do arithmetic on a time itself — my own code does that, the same way it always has. And this changes nothing about how I save things: I still only ever store what you have seen on a card and pressed Confirm on.\n\n" +
      "The trade-off either way is that I am not much of a conversationalist. Ask me about your travel plan or about how CityFlow AI works and I am useful. Ask me about the weather and I will be honest that I cannot help.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Matching                                                                   */
/* -------------------------------------------------------------------------- */

export interface TopicMatch {
  topic: AppTopic;
  score: number;
}

/** A plain single-word hit scores 1; answering outright demands better. */
export const CONFIDENT_TOPIC_SCORE = 4;

/**
 * Scores every topic against a message and returns the best ones.
 *
 * SCORING
 * A multi-word keyword is worth far more than a single word, because "road
 * issue" identifies a topic and "road" barely narrows anything down. The score
 * is the length of the matched phrase in words, squared, summed — so one
 * three-word hit beats three unrelated one-word hits, which is the behaviour we
 * want when somebody writes a full sentence.
 */
export function matchTopics(rawText: string): TopicMatch[] {
  // Normalise punctuation and curly apostrophes so "what's" matches "whats".
  const text = ` ${rawText
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

  const matches: TopicMatch[] = [];

  for (const topic of APP_TOPICS) {
    let score = 0;

    for (const keyword of topic.keywords) {
      const needle = ` ${keyword.replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
      if (!text.includes(needle)) continue;

      const words = needle.trim().split(" ").length;
      score += words * words;
    }

    // A word that can only mean this topic is worth a two-word phrase.
    for (const keyword of topic.strongKeywords ?? []) {
      if (text.includes(` ${keyword} `)) score += CONFIDENT_TOPIC_SCORE;
    }

    if (score > 0) matches.push({ topic, score });
  }

  return matches.sort((a, b) => b.score - a.score);
}

/** Enough to offer as "did you mean", not enough to answer outright. */
export const WEAK_TOPIC_SCORE = 1;

export function findTopic(id: string): AppTopic | undefined {
  return APP_TOPICS.find((topic) => topic.id === id);
}

/**
 * Phrasings that mean "I am asking about the app", as opposed to instructing it.
 *
 * This matters for ordering. "What is traffic like at 6 PM" is a travel
 * question; "how does the traffic prediction work" is a question about the
 * product. Both mention traffic. The difference is the shape of the sentence —
 * and, as a second guard, whether it contains an actual clock time.
 */
export const APP_QUESTION_PATTERNS: RegExp[] = [
  /\bwhere (can|do|is|are|would|should) (i|it|they|my|the)\b/,
  /\bwhere('?s| is)\b/,
  /\bhow (do|can|would|should) i\b/,
  /\bhow does\b/,
  /\bhow is\b/,
  /\bwhat (is|are|does|do)\b/,
  /\bwhats\b/,
  /\bwhy (is|are|does|do|am|cant|can'?t)\b/,
  /\bwho (is|are|does|can|sees?|runs?|fixes)\b/,
  /\bcan i\b/,
  /\bcan you (tell|explain|show)\b/,
  /\btell me about\b/,
  /\bexplain\b/,
  /\bshow me where\b/,
  /\bi (cant|can'?t) find\b/,
  /\bhelp me (find|understand)\b/,
  // "is my data safe", "is it free", "is this real"
  /\bis (my|it|this|the|there)\b/,
  /\bare (you|my|the|there)\b/,
  /\bdoes (it|this|cityflow|the app)\b/,
  /\bdo you (track|store|save|share|know|have|use|see|collect)\b/,
  /\bdo i (get|need|have to)\b/,
  /\bam i\b/,
  /\bwill (it|i|this|my|everyone|people|that|you)\b/,
  /\bwhy (was|were|did|cant i)\b/,
  /\bwhat happens\b/,
  /\bwhat if\b/,
];

export function looksLikeAppQuestion(input: string): boolean {
  /*
    Phone keyboards produce a curly apostrophe (’) rather than a straight one,
    so "where’s" would miss every pattern written with '. Normalising here
    means the patterns only ever have to spell one of them.
  */
  const normalised = input.toLowerCase().replace(/[’`´]/g, "'");
  return APP_QUESTION_PATTERNS.some((pattern) => pattern.test(normalised));
}
