import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECT_DIR = path.resolve(APP_DIR, "..");

function readDotEnv() {
  const file = path.join(APP_DIR, ".env");
  if (!fs.existsSync(file)) return {};
  return parseEnv(fs.readFileSync(file, "utf8"));
}

// Settings come ONLY from app/.env, never from process.env. This stops the app from
// silently picking up credentials that belong to other tools on the same machine
// (for example a coding assistant's ANTHROPIC_AUTH_TOKEN or ANTHROPIC_BASE_URL).
const env = readDotEnv();

export const config = {
  apiKey: (env.ANTHROPIC_API_KEY ?? "").trim(),
  // Cheapest current (non-deprecated) Claude model, chosen by the user on 2026-11-09.
  model: (env.TRACEDESK_MODEL ?? "").trim() || "claude-haiku-5-5",
  effort: (env.TRACEDESK_EFFORT ?? "").trim() || "medium",
  port: Number(env.PORT) || 3000,
  baseURL: "https://api.anthropic.com",
};

export function modelConfigured() {
  return config.apiKey.length > 0;
}
