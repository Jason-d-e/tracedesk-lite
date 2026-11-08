import fs from "node:fs";
import path from "node:path";
import { APP_DIR } from "./config.js";

export const LOG_FILE = path.join(APP_DIR, "logs", "runs.jsonl");

/** Append one run record (success or failure) to logs/runs.jsonl. Never throws. */
export function logRun(record) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ run_at: new Date().toISOString(), ...record }) + "\n", "utf8");
  } catch (err) {
    console.error("Could not write run log:", err.message);
  }
}
