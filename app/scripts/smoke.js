// Real-model smoke check on a few demo questions (costs a fraction of a cent).
// Usage: npm run smoke                  (all cases in scripts/smoke-cases.json)
//        npm run smoke -- TD-018 TD-029
// Only question text and expected reply type are used; reference answers never reach the model.
// IDs not in smoke-cases.json are looked up in an optional local evaluation file, if one exists.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_DIR, config, modelConfigured } from "../lib/config.js";
import { loadKnowledge } from "../lib/knowledge.js";
import { answerQuestion, describeError } from "../lib/answer.js";
import { logRun } from "../lib/runlog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeCases = JSON.parse(fs.readFileSync(path.join(here, "smoke-cases.json"), "utf8")).cases;
const evalFile = path.join(PROJECT_DIR, "eval", "cases.json");
const evalCases = fs.existsSync(evalFile) ? JSON.parse(fs.readFileSync(evalFile, "utf8")).cases : [];
const cases = [...smokeCases, ...evalCases.filter((c) => !smokeCases.some((s) => s.id === c.id))];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : smokeCases.map((c) => c.id);

async function main() {
  if (!modelConfigured()) {
    console.log("NOT RUN: no ANTHROPIC_API_KEY in app/.env. No model call was made.");
    return 2;
  }

  const kb = loadKnowledge();
  console.log(`Model ${config.model} · effort ${config.effort} · knowledge ${kb.knowledgeVersion}\n`);

  let failures = 0;
  for (const id of wanted) {
    const c = cases.find((x) => x.id === id);
    if (!c) {
      console.log(`${id}: no such case`);
      failures++;
      continue;
    }
    try {
      const r = await answerQuestion(kb, { question: c.question });
      logRun({
        source: "smoke",
        case_id: id,
        question: c.question,
        status: r.status,
        model_status: r.model_status,
        checks: r.checks,
        key_point: r.key_point,
        answer: r.answer,
        next_steps: r.next_steps.map(({ action, deadline, deadline_supported, source_id, verified }) => ({ action, deadline, deadline_supported, source_id, verified })),
        clarifying_question: r.clarifying_question,
        missing_info: r.missing_info,
        citations: r.citations.map(({ source_id, quote, verified }) => ({ source_id, quote, verified })),
        ...r.meta,
      });
      const statusOk = r.status === c.expected_status;
      console.log(`${id} [${c.category}] ${c.question}`);
      console.log(`  status: ${r.status} (expected ${c.expected_status}) ${statusOk ? "OK" : "MISMATCH"}`);
      if (r.key_point) console.log(`  key point: ${r.key_point}`);
      console.log(`  answer: ${r.answer || r.clarifying_question}`);
      if (r.missing_info) console.log(`  missing: ${r.missing_info}`);
      for (const s of r.next_steps) {
        console.log(`  step: ${s.action}${s.deadline ? ` [by ${s.deadline}${s.deadline_supported === false ? " — DEADLINE NOT IN QUOTE" : ""}]` : ""} (${s.source_id} ${s.verified ? "verified" : "NOT VERIFIED"})`);
      }
      for (const cit of r.citations) console.log(`  cite ${cit.source_id} ${cit.verified ? "verified" : "NOT VERIFIED"}: "${cit.quote}"`);
      console.log(`  ${r.meta.model_served} · ${r.meta.latency_ms} ms · in ${r.meta.usage.input_tokens} / out ${r.meta.usage.output_tokens} tokens${r.meta.fallback_used ? " · fallback" : ""}\n`);
      if (!statusOk) failures++;
    } catch (err) {
      const info = describeError(err);
      logRun({ source: "smoke", case_id: id, question: c.question, error: { code: info.code, detail: err.message } });
      console.log(`${id}: ERROR ${info.code} — ${err.message}\n`);
      failures++;
    }
  }

  console.log(failures ? `${failures} case(s) need attention. Status match is only a first check; read the answers.` : "All status checks matched. Still read each answer and quote yourself.");
  return failures ? 1 : 0;
}

// Set exitCode instead of calling process.exit(): exiting while HTTP keep-alive
// sockets are still closing crashes libuv on Windows.
process.exitCode = await main();
