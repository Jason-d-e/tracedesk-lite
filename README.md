# TraceDesk Lite

**The bottom line first, a checklist you can tick, and a source for every word.**

TraceDesk Lite is a help-desk assistant for student organisations, designed for readers who find long, dense text hard to act on. That includes people with ADHD or other attention, reading or executive-function difficulties, and people reading English as a second language. It answers only from the organisation's current documents. Every sentence and every checklist step must quote those documents, and the server checks each quote word for word before anything is shown.

> Status: working prototype, v0.4 (November 2026). The demo uses a **fictional** club called “DemoClub”. Its documents are not a real service or policy.

## The problem

Practical student information (deadlines, eligibility, how to cancel, who to contact) usually sits in several dense English documents, and some of them go out of date. Reading these is a real barrier for some people:

- **Attention and working memory.** Long paragraphs are hard to finish. Conditions buried mid-sentence get missed, and multi-step instructions are hard to hold in mind.
- **Time blindness.** A deadline written inside a paragraph is easy to overlook until it has passed.
- **Getting started.** It is not obvious what the first action is.

An AI summary could help, but a fluent summary that invents or shifts a deadline does the most harm to exactly the people who rely on it. TraceDesk's rule is: **read less, but never be misled.**

## The cover (`/`)

The first screen says what the product does and lets you try it in one click. A short scene plays once on a paper desk: a real rule from the demo documents is underlined, an index card slides out with the one-sentence answer, a checklist step is ticked, and a "Quote verified" stamp is pressed in. With reduced motion turned on, the finished scene is shown at once. Below it: the same rule as a dense paragraph and as an answer, the measured results, the reading features, the organiser dashboard, what it needs to run, and real example questions that open the help desk with the question already asked.

## The reader's side: the help desk (`/#/ask`)

**One language at a time.** A 中文 / EN switch changes every label, button, hint and example question, and the choice is remembered. The answer comes back in the language of the question. The only English that stays in the Chinese interface is the source quotes, and they are labelled “English, not translated” so readers know why.

**Questions grouped by topic.** Instead of a wall of examples, suggested questions sit under five tabs: dates and times, registering and cancelling, who can join, help and contact, and “try a tricky one” (vague, unanswerable or manipulative questions that show the assistant will not guess).

**Every answer has the same numbered layout**, so readers always know where to look:

1. **Status banner.** An icon, a title and one sentence: “Found in the official documents”, “The documents don’t cover this”, “One quick question first” or “Answer held back”.
2. **① The bottom line.** One short sentence in large text, with a Listen button. Its key facts (date, time, place, contact) are marked with a highlighter stroke and repeated underneath as labelled chips, but only when the same values appear in a verified quote; an unbacked date is never emphasised.
3. **② What you need to do.** A checklist you can tick.
   - Each step starts with a verb and shows its deadline in a highlighted label that never gets cut off on a phone.
   - Each step names the document it comes from, and the whole list can be copied in one click.
   - **Deadlines are double-checked.** Every number in a step's deadline (day, year, hour, minute) must also appear in that step's verified quote, even when the answer is in Chinese and the source in English. A deadline that fails is shown in red with a warning.
4. **③ More detail**, folded by default.
5. **④ Evidence.** Quotes grouped by document and underlined inside the original paragraph, with a “Quotes verified 3/3” tag.
6. **Report a problem** or **ask the organisers to add this**.

**Reading settings** (one drawer, remembered in the browser):

- **Focus mode** hides everything except the question and the answer and stops animations.
- **Text size**: standard, large or extra large.
- **Bold word starts** for English text. Some readers find this easier to follow; the evidence is mixed, so it is off by default.
- **Reading speed** for Listen, which uses the browser's own voices at no extra cost.
- **Colour scheme**: light (the default), dark, or follow the device.

**Recent questions** stay in a side panel for the current browser tab, so an answer is not lost after a second question. Opening the dashboard and coming back keeps them too.

**Honest outcomes.**

- **Nothing unverified is shown as fact.** If none of an answer's quotes match the source, the answer is withheld.
- **Current documents only.** Superseded drafts are listed but never sent to the model.
- **Prompt-injection aware.** Hidden instructions such as “ignore the documents” or “invent a phone number” are not followed, and any genuine question in the same message is still answered.

## The organiser's side: the dashboard (`/#/organiser`)

Five sections in a side menu (a menu button on phones):

| Section | What organisers see and do |
| --- | --- |
| **Overview** | Questions asked, share answered from the documents, share not covered, open reports; a chart of outcomes and a chart of the most-needed missing information. |
| **Reader reports** | Each report with the answer that was given, its sources and the reader's note. Filter by pending / done, write how it was resolved, mark it done or reopen it, and export everything as a CSV file that opens correctly in Excel (UTF-8, formula-safe). |
| **Knowledge gaps** | Questions the documents could not answer, grouped and counted. Items readers explicitly asked to be added are ranked first, so organisers know what to write next. Only questions typed into the help desk are counted, not tests. |
| **Documents** | Every document with its ID, version, status and effective date. Superseded drafts show which document replaced them. |
| **Answer quality** | The prompt comparison below as a chart and a table, with its limits stated next to it. |

Readers' reports are saved only if they tick a consent box, and the form asks them not to include personal details.

The design follows the W3C guidance *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA), with WCAG 2.2 AA as the baseline. The app is **not a medical tool**: it never asks about, and does not record, any health information.

## How it works

```
web/ (React + Mantine, built to web/dist)  ──POST /api/ask──►  server.js (Express)
                                              ├─ lib/knowledge.js  load data/knowledge.json, keep active sections only
                                              ├─ lib/prompts.js    instructions + documents + JSON schema (key_point, next_steps, citations…)
                                              ├─ lib/answer.js     one Claude API call with structured JSON output
                                              ├─ lib/validate.js   check every quote and every deadline against the source
                                              ├─ lib/runlog.js     append each run to logs/runs.jsonl
                                              └─ lib/reviews.js, lib/insights.js   reader reports and knowledge gaps
```

- **Two engines.** With a key, the server makes one Messages API call through the official Anthropic SDK (`claude-haiku-5-5`, the cheapest current Claude model, at effort `medium`). Without a key, or when the reader picks **Local engine** on the help desk, `lib/local.js` answers the way help desks did before large language models: the question becomes keywords (English words lightly stemmed; Chinese phrases through a small glossary), every sentence of the active documents is scored by the keywords it contains, and the best sentence is the bottom line, quoted word for word. Sentences that read as instructions become checklist steps: the instruction itself, in the document's words, with the deadline lifted out beside it, and never a step that only repeats the bottom line. Two rules stay: it asks which link is meant, and it says "not covered" (with the documented contact) when nothing scores. It never paraphrases, combines or translates. Both engines go through the same verification.
- **When the documents do not answer**, the help desk drafts the email the reader would send (`lib/email.js`): the documented support address, the question as asked, the documents read, and what the support guide asks a request to contain. Copy it or open it in a mail app; nothing is sent.
- **Structured output.** A JSON schema limits every `source_id` to real, active sections.
- **No retrieval layer.** The knowledge base is small, so all active sections go into the prompt; there is no vector search.
- **Key handling.** The API key is read only from `app/.env`, never from system environment variables, and is never sent to the browser.
- **Logging.** Every run records the model, prompt version, knowledge version, latency, token usage and verification results.
- **Interface.** A single-page React app. Every piece of interface text lives in two language files (`web/src/locales/en.ts`, `zh.ts`); none is written into the components. The dashboard and its charts are only downloaded when an organiser opens it.
- **Visual design.** One system across the cover, the help desk and the dashboard: warm paper, cotton stationery, letterpress-card controls, General Sans with Noto Sans SC for Chinese, and one coral ink kept for the verified state, focus and links. Colours are OKLCH tokens checked for contrast. Motion is limited to the cover's one scene and short state changes (a press, an arriving answer), all under 300 ms except the scene, and none under reduced motion.

## Measured so far (real model runs, 2026-11-09)

| What | Result |
| --- | --- |
| Real model calls | 214, all successful: 20 smoke-test calls, 72 questions typed into the app (including the ones used for screenshots) and 122 evaluation calls. These are demo questions only, so this is not an accuracy evaluation. |
| Quotes and steps that failed verification | 0 across all 214 calls |
| Expected outcome matched (smoke cases TD-001, 018, 021, 029, 033, 037, 040) | 7 of 7 |
| Median / max response time | 3.4 s / 10.6 s |
| Total cost of all 214 calls | about US$0.13 |
| Automated accessibility check (axe-core 4.10.2, WCAG 2.2 A/AA rules plus best practices) | 0 violations on the cover, the help desk with an answer shown and all five dashboard sections; checked in Chinese and English, light and dark, at desktop and 375 px phone width, with no sideways scrolling |
| 40-question prompt comparison (promptfoo): plain prompt vs TraceDesk prompt, same model, documents, schema and server checks | On the 20 held-out questions, all automatic checks passed for **20/20** with the TraceDesk prompt (v2.4) vs **17/20** with the plain prompt. The earlier run (v2.3) scored 19/20 vs 15/20. The plain prompt scored 15 and then 17 on the same questions, so a gap of a few questions can be run-to-run noise. Every remaining difference is checklist deadlines the quoted text did not state. The TraceDesk prompt costs about 40% more per question and is about 1.6 s slower (median). Automatic checks only, so this is not an accuracy figure. Details: `EVALUATION.md`. |

## Run it locally (Windows, macOS or Linux)

Requirements: Node.js 22 or newer and an Anthropic API key.

```bash
cd app
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
# open .env and paste your key after ANTHROPIC_API_KEY=
npm start                     # then open http://localhost:3000 (help desk: /#/ask, dashboard: /#/organiser)
```

The built interface (`app/web/dist`) is included, so no build step is needed to run the app.

| Command (in `app/`) | What it does |
| --- | --- |
| `npm test` | Runs 27 offline tests: knowledge loading, quote and deadline checks, withholding, the review queue with its CSV export, and knowledge-gap insights. No API calls. |
| `npm run smoke` | Makes real model calls on the 7 demo questions in `app/scripts/smoke-cases.json`. |
| `npm run smoke -- TD-018 TD-029` | Runs only the cases you name. |

To change the interface:

```bash
cd app/web
npm install
npm run dev      # live-reloading interface on http://localhost:5173 (keep `npm start` running in app/ for the API)
npm run build    # type-check and rebuild app/web/dist
```

## What was built when (disclosure)

| Date (MYT) | Work |
| --- | --- |
| 2026-11-03 | The fictional DemoClub knowledge base (`data/knowledge.json`) and a set of draft test questions. No application code. |
| 2026-11-09 onward | Everything in `app/`: the server, quote and deadline verification, the accessibility features, the tests and the smoke script. The web interface was first written in plain HTML and rebuilt the same day in React with Mantine, after trying it ourselves showed mixed languages, unclear labels and ungrouped examples. Later the same day we added the cover and gave the whole interface one visual system. |

**AI assistance.** The fictional documents and the draft questions were written with AI help. The application code was written with an AI coding assistant (Claude Code) under the team's direction.

**Reused work.** We used existing open-source components wherever one fitted. All are listed with versions and licenses in `THIRD_PARTY_NOTICES.md`:

- Interface: React, Mantine (components, charts, notifications), Recharts, Tabler Icons, i18next, Vite.
- Read-aloud uses easy-speech; bold word starts uses text-vide; key facts are found with chrono-node and marked with Rough Notation.
- The answer-style rules are adapted from i-have-adhd.
- Design: the visual system is the "Coral" theme of the Hallmark design skill (MIT), chosen from three it offered; motion follows Emil Kowalski's design-engineering skills (MIT); Impeccable's quality rules (Apache-2.0) were used as a final checklist. Fonts: General Sans (Fontshare), Geist Mono and Noto Sans SC (both OFL).

## Known limitations

- **No user testing yet.** Nobody with ADHD has tried the app. It is *designed with* cognitive-accessibility guidance; we do not claim it is proven to help.
- **The quote check has limits.** It proves the quoted text exists in the source. It does not prove the quote fully supports the sentence, which still needs human review. The deadline check compares numbers only.
- **The local engine only selects sentences.** It cannot combine two sections into one answer, a Chinese question gets an English sentence under a Chinese lead-in, and a phrasing its glossary does not know comes back as "not covered". On the 34 demo questions it picked the right sentence for 29, asked back on 2 and said "not covered" on 3; a keyword can still land on the wrong sentence.
- **Small fictional demo.** The demo has four short fictional documents. Results on it say nothing about accuracy on real material.
- **Automated accessibility checks are not enough.** An automated checker catches only part of the problems. Screen-reader and keyboard-only testing by real users has not been done.
- **Read-aloud depends on the browser.** The voices available depend on the browser and operating system.
- **Fonts load from Fontshare and Google Fonts.** Offline, the page falls back to the system sans-serif.
- **Single-user local prototype.** There are no accounts, the rate limit is in memory, and there is no public deployment. The dashboard has no login, which is acceptable only because the server listens on this computer alone (127.0.0.1).
