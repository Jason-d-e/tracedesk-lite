import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  openReviews, normaliseReport, addReview, updateReview, listReviews, reviewsToCsv,
  ReviewInputError, CSV_COLUMNS,
} from "../lib/reviews.js";

const valid = new Set(["D01#event", "D02#cancellation"]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tracedesk-reviews-"));
const file = path.join(tmp, "reviews.json");

const report = (over = {}) => ({
  question: "Who is the instructor?",
  answer_status: "insufficient_evidence",
  key_point: "The documents don't name the instructor.",
  related_sources: ["D01#event", "D99#made-up"],
  review_reason: "missing_information",
  note: "Please add the speaker's name.",
  prompt_version: "grounded-v2.2-access",
  knowledge_version: "democlub-2026-11-03-v1",
  model: "claude-haiku-5-5",
  ...over,
});

test("a report is normalised: invented source ids dropped, text trimmed", () => {
  const r = normaliseReport(report({ question: "  Who is the instructor?  " }), valid);
  assert.equal(r.question, "Who is the instructor?");
  assert.deepEqual(r.related_sources, ["D01#event"]);
  assert.equal(r.user_note, "Please add the speaker's name.");
});

test("reports without a known reason or question are rejected", () => {
  assert.throws(() => normaliseReport(report({ review_reason: "hack" }), valid), ReviewInputError);
  assert.throws(() => normaliseReport(report({ question: "   " }), valid), ReviewInputError);
  assert.throws(() => normaliseReport(report({ note: "x".repeat(301) }), valid), ReviewInputError);
  assert.throws(() => normaliseReport(null, valid), ReviewInputError);
});

test("reports are stored as pending, can be marked reviewed and reopened", async () => {
  const db = await openReviews(file);
  const item = await addReview(db, normaliseReport(report(), valid));
  assert.equal(item.review_status, "pending");
  assert.equal(listReviews(db, "pending").length, 1);

  const done = await updateReview(db, item.id, { review_status: "reviewed", reviewer_note: "Added the speaker to D01." });
  assert.equal(done.review_status, "reviewed");
  assert.ok(done.reviewed_at);
  assert.equal(listReviews(db, "pending").length, 0);

  const reopened = await updateReview(db, item.id, { review_status: "pending", reviewer_note: "" });
  assert.equal(reopened.reviewed_at, "");

  assert.equal(await updateReview(db, "no-such-id", { review_status: "reviewed" }), null);
  await assert.rejects(updateReview(db, item.id, { review_status: "deleted" }), ReviewInputError);

  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.reviews.length, 1, "data is persisted to the JSON file");
});

test("CSV export: header, escaping, Chinese text and formula protection", () => {
  const rows = [
    { ...normaliseReport(report({ question: "取消报名, \"怎么\" 做？" }), valid), id: "a", created_at: "2026-11-09T00:00:00Z", review_status: "pending", reviewer_note: "", reviewed_at: "" },
    { ...normaliseReport(report({ note: "=HYPERLINK(\"http://x\")" }), valid), id: "b", created_at: "2026-11-09T00:00:01Z", review_status: "pending", reviewer_note: "", reviewed_at: "" },
  ];
  const csv = reviewsToCsv(rows);
  assert.ok(csv.startsWith("﻿"), "BOM for Excel");
  const lines = csv.slice(1).trim().split("\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  assert.ok(lines[1].includes('"取消报名, ""怎么"" 做？"'), "comma and quotes escaped");
  assert.ok(lines[2].includes("'=HYPERLINK"), "formula neutralised");
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
