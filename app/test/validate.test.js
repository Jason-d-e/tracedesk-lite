import { test } from "node:test";
import assert from "node:assert/strict";
import { loadKnowledge } from "../lib/knowledge.js";
import { checkResult, verifyCitation, deadlineSupported, ModelOutputError } from "../lib/validate.js";
import { buildOutputSchema, renderDocuments, PROMPTS, DEFAULT_PROMPT_ID } from "../lib/prompts.js";

const kb = loadKnowledge();

test("only active documents become answerable chunks", () => {
  assert.equal(kb.knowledgeVersion, "democlub-2026-11-03-v1");
  assert.equal(kb.activeChunks.length, 8);
  assert.ok(kb.chunkById.has("D01#event"));
  assert.ok(!kb.chunkById.has("D04#event"), "superseded D04 must not be answerable");
  assert.equal(kb.documents.length, 4, "catalogue still lists all documents");
});

test("rendered context excludes the superseded draft and reference answers", () => {
  const system = PROMPTS[DEFAULT_PROMPT_ID].system(kb);
  assert.ok(system.includes('id="D01#event"'));
  assert.ok(!system.includes("Outdated draft"));
  assert.ok(!system.includes("reference_answer"));
  assert.equal(renderDocuments(kb).match(/<chunk /g).length, 8);
});

test("output schema restricts source ids to active chunks, in citations and next steps", () => {
  const schema = buildOutputSchema(kb);
  const ids = kb.activeChunks.map((c) => c.id);
  assert.deepEqual(schema.properties.citations.items.properties.source_id.enum, ids);
  assert.deepEqual(schema.properties.next_steps.items.properties.source_id.enum, ids);
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes("key_point"));
});

test("an exact quote is verified and gets a highlight span", () => {
  const c = verifyCitation({ source_id: "D01#event", quote: "Participation is free." }, kb.chunkById);
  assert.equal(c.verified, true);
  const text = kb.chunkById.get("D01#event").text;
  assert.equal(text.slice(c.span.start, c.span.end), "Participation is free");
});

test("quotes match despite case, curly quotes and extra spaces", () => {
  const c = verifyCitation({ source_id: "D01#event", quote: "the  capacity is 24 PARTICIPANTS" }, kb.chunkById);
  assert.equal(c.verified, true);
});

test("a paraphrased or invented quote is not verified", () => {
  const c = verifyCitation({ source_id: "D01#event", quote: "The workshop costs nothing at all." }, kb.chunkById);
  assert.equal(c.verified, false);
  assert.equal(c.reason, "quote_not_in_source");
});

test("a quote from the wrong chunk is not verified", () => {
  const c = verifyCitation({ source_id: "D02#contact", quote: "Participation is free." }, kb.chunkById);
  assert.equal(c.verified, false);
});

test("unknown source ids are rejected", () => {
  const c = verifyCitation({ source_id: "D99#x", quote: "Participation is free." }, kb.chunkById);
  assert.equal(c.verified, false);
  assert.equal(c.reason, "unknown_source");
});

test("deadline check compares the numbers, across languages", () => {
  const quote = "reply to the confirmation email before 11 November 2026 at 18:00 MYT";
  assert.equal(deadlineSupported("11 November 2026, 18:00 MYT", quote), true);
  assert.equal(deadlineSupported("2026年11月11日 18:00 MYT", quote), true);
  assert.equal(deadlineSupported("10 November 2026, 18:00 MYT", quote), false, "shifted day must fail");
  assert.equal(deadlineSupported("11 November 2026, 12:00 MYT", quote), false, "shifted hour must fail");
  assert.equal(deadlineSupported("before the event", quote), null);
});

const base = { key_point: "", answer: "", next_steps: [], citations: [], missing_info: "", clarifying_question: "" };
const cancelStep = {
  action: "Reply to the confirmation email",
  deadline: "11 November 2026, 18:00 MYT",
  source_id: "D02#cancellation",
  quote: "reply to the confirmation email before 11 November 2026 at 18:00 MYT",
};

test("an answer with a verified quote stays answered", () => {
  const r = checkResult(
    { ...base, status: "answered", key_point: "It is free.", citations: [{ source_id: "D01#event", quote: "Participation is free." }] },
    kb.chunkById,
  );
  assert.equal(r.status, "answered");
  assert.equal(r.key_point, "It is free.");
  assert.equal(r.checks.citations_verified, 1);
});

test("next steps are verified like citations, including their deadline", () => {
  const r = checkResult({ ...base, status: "answered", key_point: "Reply to cancel.", next_steps: [cancelStep] }, kb.chunkById);
  assert.equal(r.status, "answered", "a verified step alone keeps the answer");
  assert.equal(r.next_steps[0].verified, true);
  assert.equal(r.next_steps[0].deadline_supported, true);
  assert.equal(r.checks.steps_verified, 1);
});

test("a step with an invented deadline is flagged", () => {
  const bad = { ...cancelStep, deadline: "9 November 2026, 12:00 MYT" };
  const r = checkResult({ ...base, status: "answered", next_steps: [bad] }, kb.chunkById);
  assert.equal(r.next_steps[0].deadline_supported, false);
  assert.equal(r.checks.deadlines_unsupported, 1);
});

test("a step whose quote is not in the source is unverified", () => {
  const bad = { ...cancelStep, quote: "Call the hotline to cancel." };
  const r = checkResult({ ...base, status: "answered", next_steps: [bad] }, kb.chunkById);
  assert.equal(r.next_steps[0].verified, false);
  assert.equal(r.next_steps[0].deadline_supported, false);
  assert.equal(r.status, "withheld");
});

test("an answer whose quotes cannot be verified is withheld", () => {
  const r = checkResult(
    { ...base, status: "answered", answer: "It costs RM 10.", citations: [{ source_id: "D01#event", quote: "The fee is RM 10." }] },
    kb.chunkById,
  );
  assert.equal(r.status, "withheld");
  assert.equal(r.model_status, "answered");
  assert.equal(r.checks.withheld, true);
});

test("an answer with no citations at all is withheld", () => {
  const r = checkResult({ ...base, status: "answered", answer: "It is free." }, kb.chunkById);
  assert.equal(r.status, "withheld");
});

test("insufficient evidence and clarification pass through without citations", () => {
  assert.equal(checkResult({ ...base, status: "insufficient_evidence", answer: "Not covered." }, kb.chunkById).status, "insufficient_evidence");
  assert.equal(checkResult({ ...base, status: "needs_clarification", clarifying_question: "Which link?" }, kb.chunkById).status, "needs_clarification");
});

test("duplicate citations are collapsed", () => {
  const cit = { source_id: "D01#event", quote: "Participation is free." };
  const r = checkResult({ ...base, status: "answered", answer: "Free.", citations: [cit, { ...cit }] }, kb.chunkById);
  assert.equal(r.checks.citations_total, 1);
});

test("malformed model output is rejected", () => {
  assert.throws(() => checkResult({ status: "maybe" }, kb.chunkById), ModelOutputError);
  assert.throws(() => checkResult(null, kb.chunkById), ModelOutputError);
  assert.throws(() => checkResult({ ...base, status: "answered", next_steps: [{ action: "x" }] }, kb.chunkById), ModelOutputError);
});
