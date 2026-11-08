import path from "node:path";
import express from "express";
import { APP_DIR, config, modelConfigured } from "./lib/config.js";
import { loadKnowledge } from "./lib/knowledge.js";
import { PROMPTS, DEFAULT_PROMPT_ID } from "./lib/prompts.js";
import { answerQuestion, describeError } from "./lib/answer.js";
import { logRun } from "./lib/runlog.js";

const MAX_QUESTION_CHARS = 500;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };

const kb = loadKnowledge();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));
app.use(express.static(path.join(APP_DIR, "public")));

// Reused open-source browser modules (see THIRD_PARTY_NOTICES.md), served straight from node_modules.
const VENDOR = {
  "easy-speech.js": "node_modules/easy-speech/dist/EasySpeech.js",
  "text-vide.mjs": "node_modules/text-vide/dist/index.mjs",
};
app.get("/vendor/:file", (req, res, next) => {
  const rel = VENDOR[req.params.file];
  if (!rel) return next();
  res.type("text/javascript").sendFile(path.join(APP_DIR, rel));
});

// Small in-memory limiter so a shared demo cannot run up the API bill.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip ?? "local";
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) {
    return res.status(429).json({
      error: { code: "too_many_requests", retryable: true, message: "Too many questions in a minute. Please wait a little." },
    });
  }
  recent.push(now);
  hits.set(key, recent);
  next();
}

function badRequest(res, message) {
  return res.status(400).json({ error: { code: "invalid_input", retryable: false, message } });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

app.get("/api/status", (req, res) => {
  res.json({
    model_configured: modelConfigured(),
    model: config.model,
    knowledge_version: kb.knowledgeVersion,
    prompt_version: DEFAULT_PROMPT_ID,
    active_chunks: kb.activeChunks.length,
  });
});

app.get("/api/sources", (req, res) => {
  res.json({ knowledge_version: kb.knowledgeVersion, provenance: kb.provenance, documents: kb.documents });
});

app.post("/api/ask", rateLimit, async (req, res) => {
  const body = req.body ?? {};
  const question = cleanText(body.question);
  if (!question) return badRequest(res, "Please type a question.");
  if (question.length > MAX_QUESTION_CHARS) return badRequest(res, `Questions are limited to ${MAX_QUESTION_CHARS} characters.`);

  let context = null;
  if (body.context && typeof body.context === "object") {
    const previous = cleanText(body.context.previous_question);
    const clarifying = cleanText(body.context.clarifying_question);
    if (previous.length > MAX_QUESTION_CHARS || clarifying.length > MAX_QUESTION_CHARS) {
      return badRequest(res, "The earlier conversation is too long.");
    }
    if (previous && clarifying) context = { previous_question: previous, clarifying_question: clarifying };
  }

  const promptId = typeof body.prompt === "string" && PROMPTS[body.prompt] ? body.prompt : DEFAULT_PROMPT_ID;

  if (!modelConfigured()) {
    return res.status(503).json({
      error: {
        code: "model_not_configured",
        retryable: false,
        message: "No model is connected yet. Add ANTHROPIC_API_KEY to app/.env and restart the server.",
      },
    });
  }

  try {
    const result = await answerQuestion(kb, { question, context, promptId });
    logRun({
      source: "web",
      question,
      context,
      status: result.status,
      model_status: result.model_status,
      checks: result.checks,
      citations: result.citations.map(({ source_id, verified, reason }) => ({ source_id, verified, reason })),
      ...result.meta,
    });
    res.json(result);
  } catch (err) {
    const info = describeError(err);
    logRun({
      source: "web",
      question,
      context,
      prompt_version: promptId,
      knowledge_version: kb.knowledgeVersion,
      model_requested: config.model,
      error: { code: info.code, detail: err.message },
      ...(err.details ?? {}),
    });
    if (info.code === "internal") console.error(err);
    res.status(info.http).json({ error: { code: info.code, retryable: info.retryable, message: info.message } });
  }
});

// Malformed or oversized request bodies: answer in JSON without leaking stack traces.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status === 413 ? 413 : err.type === "entity.parse.failed" ? 400 : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: {
      code: status === 500 ? "internal" : "invalid_input",
      retryable: status === 500,
      message: status === 413 ? "Request too large." : status === 400 ? "Request body must be valid JSON." : "Something went wrong on the server.",
    },
  });
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`TraceDesk Lite running at http://localhost:${config.port}`);
  console.log(`Knowledge ${kb.knowledgeVersion}: ${kb.activeChunks.length} active chunks.`);
  console.log(modelConfigured() ? `Model: ${config.model} (effort ${config.effort})` : "Model: NOT CONFIGURED (add ANTHROPIC_API_KEY to app/.env)");
});
