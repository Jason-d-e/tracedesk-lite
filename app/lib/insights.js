// Knowledge-gap insights for organisers: which real reader questions the documents
// could not answer, how often, and what readers explicitly asked to be added.
// Plain grouping and counting; no extra library is needed for this.
import fs from "node:fs";
import { LOG_FILE } from "./runlog.js";

export function readRuns(file = LOG_FILE) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

/** Group key for "the same question": case, spacing and closing punctuation ignored. */
export function questionKey(q) {
  return String(q)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s?？!！.。,，]+$/u, "")
    .trim();
}

function addGap(map, question, when, extra) {
  const key = questionKey(question);
  if (!key) return;
  const g = map.get(key) ?? { question: question.trim(), asked: 0, reported: 0, last_seen: "", missing_info: "", reader_notes: [] };
  if (extra.asked) g.asked += 1;
  if (extra.reported) g.reported += 1;
  if (when > g.last_seen) g.last_seen = when;
  if (extra.missing_info && !g.missing_info) g.missing_info = extra.missing_info;
  if (extra.note) g.reader_notes.push(extra.note);
  map.set(key, g);
}

/**
 * Only questions typed into the web app count ("source": "web"); smoke tests and
 * evaluation runs are excluded so organisers see real reader demand.
 */
export function buildInsights(runs, reviews = [], limit = 10) {
  const web = runs.filter((r) => r.source === "web" && r.status && !r.error);
  const byStatus = {};
  for (const r of web) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  const gaps = new Map();
  for (const r of web) {
    if (r.status === "insufficient_evidence") addGap(gaps, r.question, r.run_at ?? "", { asked: true, missing_info: r.missing_info });
  }
  for (const item of reviews) {
    if (item.review_reason === "missing_information" && item.review_status !== "reviewed") {
      addGap(gaps, item.question, item.created_at ?? "", { reported: true, note: item.user_note });
    }
  }

  const ranked = [...gaps.values()]
    .sort((a, b) => b.reported - a.reported || b.asked - a.asked || b.last_seen.localeCompare(a.last_seen))
    .slice(0, limit);

  return {
    questions_answered_by_app: web.length,
    by_status: byStatus,
    unanswered_share: web.length ? (byStatus.insufficient_evidence ?? 0) / web.length : 0,
    top_gaps: ranked,
  };
}
