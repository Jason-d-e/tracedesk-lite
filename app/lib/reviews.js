// Review queue: readers report problems or ask organisers to add missing information;
// organisers mark items reviewed and export them as CSV.
// Reused: lowdb (JSON-file storage, MIT) and csv-stringify (CSV escaping, MIT).
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { JSONFilePreset } from "lowdb/node";
import { stringify } from "csv-stringify/sync";
import { APP_DIR } from "./config.js";

export const DEFAULT_REVIEW_FILE = path.join(APP_DIR, "data-runtime", "reviews.json");

export const REVIEW_REASONS = {
  wrong_fact: "A fact in the answer is wrong",
  wrong_source: "The source does not support the answer",
  missing_information: "The documents don't cover this — please add it",
  should_have_answered: "It said 'not in the documents' but the answer is there",
  should_have_asked: "It guessed instead of asking what I meant",
  hard_to_follow: "The answer was hard to follow",
  other: "Something else",
};
export const REVIEW_STATUSES = ["pending", "reviewed"];
export const ANSWER_STATUSES = ["answered", "insufficient_evidence", "needs_clarification", "withheld"];

const LIMITS = { question: 500, text: 300, note: 300 };

const dbs = new Map();
export async function openReviews(file = DEFAULT_REVIEW_FILE) {
  if (!dbs.has(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    dbs.set(file, JSONFilePreset(file, { reviews: [] }));
  }
  return dbs.get(file);
}

export class ReviewInputError extends Error {}

function text(value, max, field, required = false) {
  const v = typeof value === "string" ? value.trim() : "";
  if (required && !v) throw new ReviewInputError(`${field} is required.`);
  if (v.length > max) throw new ReviewInputError(`${field} is limited to ${max} characters.`);
  return v;
}

/** Validate and normalise a report sent by the browser. `validSourceIds` filters invented ids. */
export function normaliseReport(body, validSourceIds) {
  if (!body || typeof body !== "object") throw new ReviewInputError("Invalid report.");
  const reason = body.review_reason;
  if (!Object.hasOwn(REVIEW_REASONS, reason)) throw new ReviewInputError("Please choose a reason.");
  const answerStatus = ANSWER_STATUSES.includes(body.answer_status) ? body.answer_status : "";
  const sources = Array.isArray(body.related_sources)
    ? [...new Set(body.related_sources.filter((s) => typeof s === "string" && validSourceIds.has(s)))]
    : [];
  return {
    question: text(body.question, LIMITS.question, "Question", true),
    answer_status: answerStatus,
    key_point: text(body.key_point, LIMITS.text, "Answer summary"),
    related_sources: sources,
    review_reason: reason,
    user_note: text(body.note, LIMITS.note, "Note"),
    prompt_version: text(body.prompt_version, 60, "Prompt version"),
    knowledge_version: text(body.knowledge_version, 60, "Knowledge version"),
    model: text(body.model, 60, "Model"),
  };
}

export async function addReview(db, report) {
  const item = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...report,
    review_status: "pending",
    reviewer_note: "",
    reviewed_at: "",
  };
  await db.update(({ reviews }) => reviews.push(item));
  return item;
}

export async function updateReview(db, id, body) {
  const status = body?.review_status;
  if (!REVIEW_STATUSES.includes(status)) throw new ReviewInputError("Status must be pending or reviewed.");
  const note = text(body.reviewer_note, LIMITS.note, "Reviewer note");
  let updated = null;
  await db.update(({ reviews }) => {
    const item = reviews.find((r) => r.id === id);
    if (!item) return;
    item.review_status = status;
    item.reviewer_note = note;
    item.reviewed_at = status === "reviewed" ? new Date().toISOString() : "";
    updated = { ...item };
  });
  return updated;
}

export function listReviews(db, status) {
  const all = [...db.data.reviews].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return REVIEW_STATUSES.includes(status) ? all.filter((r) => r.review_status === status) : all;
}

// Spreadsheet apps treat cells starting with these characters as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;
function safeCell(value) {
  const s = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return FORMULA_START.test(s) ? `'${s}` : s;
}

export const CSV_COLUMNS = [
  "id", "created_at", "question", "answer_status", "key_point", "related_sources", "review_reason",
  "user_note", "review_status", "reviewer_note", "reviewed_at", "prompt_version", "knowledge_version", "model",
];

export function reviewsToCsv(reviews) {
  const rows = reviews.map((r) => CSV_COLUMNS.map((c) => safeCell(r[c])));
  // BOM so Excel opens UTF-8 (Chinese questions) correctly.
  return "﻿" + stringify([CSV_COLUMNS, ...rows]);
}
