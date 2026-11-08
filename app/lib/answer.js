import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { PROMPTS, DEFAULT_PROMPT_ID, buildOutputSchema, buildUserMessage } from "./prompts.js";
import { checkResult, ModelOutputError } from "./validate.js";

export class RefusalError extends Error {
  constructor(details) {
    super("The model declined this request.");
    this.name = "RefusalError";
    this.details = details;
  }
}

let client = null;
function getClient() {
  if (!client) {
    // Pass the key and host explicitly so nothing is read from process.env.
    client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: 60_000,
      maxRetries: 2,
    });
  }
  return client;
}

// Server-side refusal fallback is available on these model families only.
const FALLBACK_CAPABLE = /^claude-(opus-5|fable-5|sonnet-5-5)/;

/**
 * Ask the model one question against the active knowledge chunks.
 * Returns the checked result plus metadata about how it was produced.
 */
export async function answerQuestion(kb, { question, context = null, promptId = DEFAULT_PROMPT_ID }) {
  const prompt = PROMPTS[promptId];
  if (!prompt) throw new Error(`Unknown prompt version ${promptId}`);

  const request = {
    model: config.model,
    max_tokens: 16000,
    output_config: {
      effort: config.effort,
      format: { type: "json_schema", schema: buildOutputSchema(kb) },
    },
    system: prompt.system(kb),
    messages: [{ role: "user", content: buildUserMessage(question, context) }],
  };
  if (FALLBACK_CAPABLE.test(config.model)) {
    request.betas = ["server-side-fallback-2026-07-01"];
    request.fallbacks = "default";
  }

  const started = Date.now();
  const response = await getClient().beta.messages.create(request);
  const latencyMs = Date.now() - started;

  const meta = {
    prompt_version: prompt.id,
    knowledge_version: kb.knowledgeVersion,
    model_requested: config.model,
    model_served: response.model,
    fallback_used: (response.usage?.iterations ?? []).some((e) => e.type === "fallback_message"),
    effort: config.effort,
    latency_ms: latencyMs,
    stop_reason: response.stop_reason,
    usage: {
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
    },
  };

  if (response.stop_reason === "refusal") {
    throw new RefusalError({ ...meta, category: response.stop_details?.category ?? null });
  }
  if (response.stop_reason === "max_tokens") {
    throw new ModelOutputError("The model's answer was cut off before it finished.");
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ModelOutputError("The model did not return valid JSON.");
  }

  return { ...checkResult(parsed, kb.chunkById), meta };
}

/** Translate any failure into a stable, user-safe error description. */
export function describeError(err) {
  if (err instanceof RefusalError) {
    return { http: 422, code: "refused", retryable: false, message: "The model declined to answer this question." };
  }
  if (err instanceof ModelOutputError) {
    return { http: 502, code: "model_output_invalid", retryable: true, message: err.message };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { http: 502, code: "model_auth_failed", retryable: false, message: "The API key was rejected. Check ANTHROPIC_API_KEY in app/.env." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { http: 503, code: "rate_limited", retryable: true, message: "The model service is rate-limiting requests. Wait a moment and try again." };
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    return { http: 502, code: "bad_request", retryable: false, message: `The model service rejected the request: ${err.message}` };
  }
  if (err instanceof Anthropic.InternalServerError) {
    return { http: 503, code: "service_unavailable", retryable: true, message: "The model service is temporarily unavailable. Try again." };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { http: 504, code: "timeout", retryable: true, message: "The model took too long to respond. Try again." };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { http: 503, code: "network", retryable: true, message: "Could not reach the model service. Check the internet connection and try again." };
  }
  if (err instanceof Anthropic.APIError) {
    return { http: 502, code: "api_error", retryable: true, message: `Model service error (${err.status ?? "unknown"}).` };
  }
  return { http: 500, code: "internal", retryable: true, message: "Something went wrong on the server." };
}
