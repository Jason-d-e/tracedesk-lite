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

/**
 * A deadline is "supported" when every number in it (day, year, hour, minute)
 * also appears in the step's verified quote. This catches invented or shifted
 * dates even when the deadline is written in another language
 * ("2026年11月11日 18:00" vs "11 November 2026 at 18:00").
 */
export function deadlineSupported(deadline, quote) {
  const wanted = String(deadline).match(/\d+/g);
  if (!wanted) return null; // no numbers to check (e.g. "before the event")
  const have = new Set((String(quote).match(/\d+/g) ?? []).map((n) => String(Number(n))));
  return wanted.every((n) => have.has(String(Number(n))));
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
        deadline_supported: deadline ? (checked.verified ? deadlineSupported(deadline, s.quote) : false) : null,
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
