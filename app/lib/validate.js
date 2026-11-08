import { STATUSES } from "./prompts.js";

export class ModelOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModelOutputError";
  }
}

/** Lenient comparison form: unify quotes/dashes/width, collapse spaces, lowercase. */
export function normalizeForMatch(text) {
  return String(text)
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Exact (case-insensitive) position of the quote in the original text, for highlighting. */
function findSpan(text, quote) {
  const q = quote.trim().replace(/[.\s]+$/, "");
  if (!q) return null;
  const start = text.toLowerCase().indexOf(q.toLowerCase());
  return start === -1 ? null : { start, end: start + q.length };
}

export function verifyCitation(citation, chunkById) {
  const chunk = chunkById.get(citation.source_id);
  const base = { source_id: citation.source_id, quote: citation.quote };
  if (!chunk) return { ...base, verified: false, reason: "unknown_source" };

  const details = {
    title: chunk.title,
    version: chunk.version,
    effective_date: chunk.effective_date,
    source_text: chunk.text,
  };
  const quote = normalizeForMatch(citation.quote).replace(/[.\s]+$/, "");
  if (quote.length < 3) return { ...base, ...details, verified: false, reason: "empty_quote", span: null };
  if (!normalizeForMatch(chunk.text).includes(quote)) {
    return { ...base, ...details, verified: false, reason: "quote_not_in_source", span: null };
  }
  return { ...base, ...details, verified: true, reason: null, span: findSpan(chunk.text, citation.quote) };
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};
const MONTH_RE = Object.keys(MONTHS).join("|");

/** Every number a sentence states: digits, number words ("three"), and month names next to a day ("12 November"). */
export function numbersIn(text) {
  const t = String(text).toLowerCase();
  const found = new Set((t.match(/\d+/g) ?? []).map((n) => String(Number(n))));
  for (const w of t.match(/[a-z]+/g) ?? []) if (w in NUMBER_WORDS) found.add(String(NUMBER_WORDS[w]));
  // Month names count only beside a day number, so the verb "may" is never read as May.
  for (const m of t.matchAll(new RegExp(`\\b\\d{1,2}\\s+(${MONTH_RE})\\b|\\b(${MONTH_RE})\\s+\\d{1,2}\\b`, "g"))) {
    found.add(String(MONTHS[m[1] ?? m[2]]));
  }
  return found;
}

/**
 * A deadline is "supported" when every number in it (day, month, year, hour, minute)
 * is stated in the step's verified quote. This catches invented or shifted dates even
 * when the deadline is written in another language ("2026年11月12日 19:00" vs
 * "12 November 2026 ... 19:00"). A 4-digit year may also come from the same source
 * section, because documents often state the year once.
 */
export function deadlineSupported(deadline, quote, sourceText = "") {
  const wanted = String(deadline).match(/\d+/g);
  if (!wanted) return null; // no numbers to check (e.g. "before the event")
  const have = numbersIn(quote);
  const years = new Set(String(sourceText).match(/\b20\d\d\b/g) ?? []);
  return wanted.every((n) => have.has(String(Number(n))) || (n.length === 4 && years.has(n)));
}

function assertShape(parsed) {
  const problems = [];
  if (!parsed || typeof parsed !== "object") problems.push("not an object");
  else {
    if (!STATUSES.includes(parsed.status)) problems.push("bad status");
    for (const key of ["key_point", "answer", "missing_info", "clarifying_question"]) {
      if (typeof parsed[key] !== "string") problems.push(`${key} not a string`);
    }
    if (!Array.isArray(parsed.citations)) problems.push("citations not a list");
    else if (parsed.citations.some((c) => !c || typeof c.source_id !== "string" || typeof c.quote !== "string")) {
      problems.push("malformed citation");
    }
    if (!Array.isArray(parsed.next_steps)) problems.push("next_steps not a list");
    else if (
      parsed.next_steps.some(
        (s) => !s || ["action", "deadline", "source_id", "quote"].some((k) => typeof s[k] !== "string"),
      )
    ) {
      problems.push("malformed next step");
    }
  }
  if (problems.length) throw new ModelOutputError(`Model output failed validation: ${problems.join(", ")}`);
}

/**
 * Check the model's structured answer against the knowledge base.
 * The server never trusts model citations: every quote (in citations and in
 * next steps) must appear in the cited chunk. An "answered" result with no
 * verifiable quote at all is withheld from the user.
 */
export function checkResult(parsed, chunkById) {
  assertShape(parsed);

  const seen = new Set();
  const citations = [];
  for (const c of parsed.citations) {
    const key = `${c.source_id}|${normalizeForMatch(c.quote)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push(verifyCitation(c, chunkById));
  }

  const nextSteps = parsed.next_steps
    .filter((s) => s.action.trim())
    .map((s) => {
      const checked = verifyCitation({ source_id: s.source_id, quote: s.quote }, chunkById);
      const deadline = s.deadline.trim();
      return {
        action: s.action.trim(),
        deadline,
        deadline_supported: deadline ? (checked.verified ? deadlineSupported(deadline, s.quote, checked.source_text) : false) : null,
        ...checked,
      };
    });

  const citationsVerified = citations.filter((c) => c.verified).length;
  const stepsVerified = nextSteps.filter((s) => s.verified).length;
  let status = parsed.status;
  if (status === "answered" && citationsVerified + stepsVerified === 0) status = "withheld";

  return {
    status,
    model_status: parsed.status,
    key_point: parsed.key_point.trim(),
    answer: parsed.answer.trim(),
    next_steps: nextSteps,
    missing_info: parsed.missing_info.trim(),
    clarifying_question: parsed.clarifying_question.trim(),
    citations,
    checks: {
      citations_total: citations.length,
      citations_verified: citationsVerified,
      steps_total: nextSteps.length,
      steps_verified: stepsVerified,
      deadlines_unsupported: nextSteps.filter((s) => s.deadline_supported === false).length,
      withheld: status === "withheld",
    },
  };
}
