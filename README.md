# TraceDesk Lite

**The bottom line first, a checklist you can tick, and a source for every word.**

TraceDesk Lite is a help-desk assistant for student organisations, designed for readers who find long, dense text hard to act on. That includes people with ADHD or other attention, reading or executive-function difficulties, and people reading English as a second language. It answers only from the organisation's current documents. Every sentence and every checklist step must quote those documents, and the server checks each quote word for word before anything is shown.

> Status: working prototype, v0.1 (November 2026). The demo uses a **fictional** club called “DemoClub”. Its documents are not a real service or policy.

## The problem

Practical student information (deadlines, eligibility, how to cancel, who to contact) usually sits in several dense English documents, and some of them go out of date. Reading these is a real barrier for some people:

- **Attention and working memory.** Long paragraphs are hard to finish. Conditions buried mid-sentence get missed, and multi-step instructions are hard to hold in mind.
- **Time blindness.** A deadline written inside a paragraph is easy to overlook until it has passed.
- **Getting started.** It is not obvious what the first action is.

An AI summary could help, but a fluent summary that invents or shifts a deadline does the most harm to exactly the people who rely on it. TraceDesk's rule is: **read less, but never be misled.**

## What it does

- **Bottom line first.** Each answer opens with one short sentence. Details stay folded under “More detail”.
- **A checklist you can tick.** When the documents say something needs doing, the answer becomes numbered steps.
  - Each step starts with a verb and shows its deadline as a highlighted ⏰ label.
  - You can tick steps off or copy the whole list.
  - Each step carries its own source quote.
- **Deadlines are double-checked.** Every number in a step's deadline (day, year, hour, minute) must also appear in that step's verified quote. This works even when the answer is in Chinese and the source is in English. A deadline that fails the check is marked in red.
- **Focus mode.** One switch hides everything except the question and the answer, enlarges the text, widens line spacing and stops animations. The setting is remembered in the browser.
- **Listen.** Reads the bottom line and the steps aloud with the browser's own voices. This is free and makes no extra model call.
- **Bold word starts (optional).** Bolds the beginning of each English word. Some readers find this easier to follow, and evidence for it is mixed, so it is off by default.
- **Ask in any language.** The answer comes back in the language of the question. Source quotes stay in the original English, so readers can check them.
- **Honest outcomes.** The assistant does one of three things:
  - answers from the documents;
  - says “not in the documents” and gives the documented contact;
  - asks one short question back when a request is ambiguous, for example “that link” when two different links exist.
- **Nothing unverified is shown as fact.** If none of an answer's quotes match the source, the answer is withheld.
- **Current documents only.** Superseded drafts are listed but never sent to the model.
- **Prompt-injection aware.** Hidden instructions such as “ignore the documents” or “invent a phone number” are not followed, and any genuine question in the same message is still answered.

### For organisers: close the loop

- **Report a problem.** Readers can flag an answer, or ask the organisers to add missing information. They choose a reason and can add a short optional note. Nothing is saved unless they tick a consent box, and the form asks them not to include personal details.
- **Review queue** (`/review.html`). Organisers see what was reported, together with the answer that was given, its sources, and the model and prompt versions behind it. They can mark each item done with a note and export the queue as a CSV file. The export opens correctly in Excel (UTF-8, formula-safe).

The design follows the W3C guidance *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA), with WCAG 2.2 AA as the baseline. The app is **not a medical tool**: it never asks about, and does not record, any health information.

## How it works

```
browser (public/)  ──POST /api/ask──►  server.js (Express)
                                         ├─ lib/knowledge.js  load data/knowledge.json, keep active sections only
                                         ├─ lib/prompts.js    instructions + documents + JSON schema (key_point, next_steps, citations…)
                                         ├─ lib/answer.js     one Claude API call with structured JSON output
                                         ├─ lib/validate.js   check every quote and every deadline against the source
                                         └─ lib/runlog.js     append each run to logs/runs.jsonl
```

- **Model call.** The server makes one Messages API call through the official Anthropic SDK. The model is `claude-haiku-5-5`, the cheapest current Claude model, at effort `medium`.
- **Structured output.** A JSON schema limits every `source_id` to real, active sections.
- **No retrieval layer.** The knowledge base is small, so all active sections go into the prompt; there is no vector search.
- **Key handling.** The API key is read only from `app/.env`, never from system environment variables, and is never sent to the browser.
- **Logging.** Every run records the model, prompt version, knowledge version, latency, token usage and verification results.

## Measured so far (real model runs, 2026-11-09)

| What | Result |
| --- | --- |
| Real model calls | 15, all successful. Run on the demo questions only, so this is not an accuracy evaluation. |
| Quotes and steps that failed verification | 0 |
| Expected outcome matched (smoke cases TD-001, 018, 021, 029, 033, 037, 040) | 7 of 7 |
| Median / max response time | 3.1 s / 6.1 s |
| Total cost of all 15 calls | about US$0.009 |
| Automated accessibility check (axe-core 4.10.2, WCAG 2.2 A/AA rules) | 0 violations, in both normal and focus mode |
| 40-question comparison (promptfoo): plain prompt vs TraceDesk prompt. Same model, documents, schema and server checks. | On the held-out 20 questions, all automatic checks passed for **19/20** with the TraceDesk prompt vs **15/20** with the plain prompt. The difference is checklist deadlines: the plain prompt attached deadlines the quoted text did not state. The TraceDesk prompt costs about 35% more per question and is about 1.6 s slower (median). Automatic checks only, so this is not an accuracy figure. |

## Run it locally (Windows, macOS or Linux)

Requirements: Node.js 22 or newer and an Anthropic API key.

```bash
cd app
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
# open .env and paste your key after ANTHROPIC_API_KEY=
npm start                     # then open http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm test` | Runs 23 offline tests: knowledge loading, quote and deadline checks, withholding, and the review queue with its CSV export. No API calls. |
| `npm run smoke` | Makes real model calls on the 7 demo questions in `app/scripts/smoke-cases.json`. |
| `npm run smoke -- TD-018 TD-029` | Runs only the cases you name. |

## What was built when (disclosure)

| Date (MYT) | Work |
| --- | --- |
| 2026-11-03 | The fictional DemoClub knowledge base (`data/knowledge.json`) and a set of draft test questions. No application code. |
| 2026-11-09 onward | Everything in `app/`: the server, quote and deadline verification, the accessibility features, the web interface, the tests and the smoke script. |

**AI assistance.** The fictional documents and the draft questions were written with AI help. The application code was written with an AI coding assistant (Claude Code) under the author's direction.

**Reused work.** Reused open-source components and adapted text are listed in `THIRD_PARTY_NOTICES.md` at the repository root:

- Read-aloud uses easy-speech.
- Bold word starts uses text-vide.
- The answer-style rules are adapted from i-have-adhd.

## Known limitations

- **No user testing yet.** Nobody with ADHD has tried the app. It is *designed with* cognitive-accessibility guidance; we do not claim it is proven to help.
- **The quote check has limits.** It proves the quoted text exists in the source. It does not prove the quote fully supports the sentence, which still needs human review. The deadline check compares numbers only.
- **Small fictional demo.** The demo has four short fictional documents. Results on it say nothing about accuracy on real material.
- **Read-aloud depends on the browser.** The voices available depend on the browser and operating system.
- **Single-user local prototype.** There are no accounts, the rate limit is in memory, and there is no public deployment. The organiser page has no login, which is acceptable only because the server listens on this computer alone (127.0.0.1).
