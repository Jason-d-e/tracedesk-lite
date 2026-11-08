import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, questionKey } from "../lib/insights.js";

const run = (over) => ({ source: "web", status: "answered", question: "When is it?", run_at: "2026-11-09T00:00:00Z", ...over });

test("questions differing only in case, spacing or closing punctuation are grouped", () => {
  assert.equal(questionKey("Who is the instructor?"), questionKey("  who is the  INSTRUCTOR？ "));
  assert.notEqual(questionKey("Who is the instructor?"), questionKey("Who is the host?"));
});

test("only real reader questions count; smoke and eval runs are excluded", () => {
  const runs = [
    run({}),
    run({ status: "insufficient_evidence", question: "Who is the instructor?", missing_info: "No instructor named." }),
    run({ status: "insufficient_evidence", question: "who is the instructor", run_at: "2026-11-09T02:00:00Z" }),
    run({ source: "eval", status: "insufficient_evidence", question: "Is there a recording?" }),
    run({ source: "smoke", status: "insufficient_evidence", question: "Is there a recording?" }),
    run({ status: undefined, error: { code: "network" } }),
  ];
  const i = buildInsights(runs, []);
  assert.equal(i.questions_answered_by_app, 3);
  assert.deepEqual(i.by_status, { answered: 1, insufficient_evidence: 2 });
  assert.equal(i.top_gaps.length, 1);
  assert.equal(i.top_gaps[0].asked, 2);
  assert.equal(i.top_gaps[0].missing_info, "No instructor named.");
  assert.equal(i.top_gaps[0].last_seen, "2026-11-09T02:00:00Z");
});

test("open 'please add this' reports rank first; reviewed ones drop out", () => {
  const runs = [run({ status: "insufficient_evidence", question: "Is there a recording?" }), run({ status: "insufficient_evidence", question: "Is there a recording?" })];
  const reviews = [
    { question: "Who is the instructor?", review_reason: "missing_information", review_status: "pending", created_at: "2026-11-09T01:00:00Z", user_note: "Please add the speaker." },
    { question: "Is there parking?", review_reason: "missing_information", review_status: "reviewed", created_at: "2026-11-09T01:00:00Z" },
    { question: "Wrong date shown", review_reason: "wrong_fact", review_status: "pending", created_at: "2026-11-09T01:00:00Z" },
  ];
  const i = buildInsights(runs, reviews);
  assert.equal(i.top_gaps[0].question, "Who is the instructor?");
  assert.equal(i.top_gaps[0].reported, 1);
  assert.deepEqual(i.top_gaps[0].reader_notes, ["Please add the speaker."]);
  assert.equal(i.top_gaps[1].asked, 2);
  assert.ok(!i.top_gaps.some((g) => g.question === "Is there parking?"));
  assert.ok(!i.top_gaps.some((g) => g.question === "Wrong date shown"));
});

test("empty logs give an empty, well-formed result", () => {
  const i = buildInsights([], []);
  assert.equal(i.questions_answered_by_app, 0);
  assert.equal(i.unanswered_share, 0);
  assert.deepEqual(i.top_gaps, []);
});
