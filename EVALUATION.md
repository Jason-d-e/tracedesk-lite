# TraceDesk Lite: evaluation brief

*9 November 2026 · one page · automatic checks on a small fictional dataset; this is not an accuracy study*

## Question

Readers who lose focus easily need a short answer and a checklist they can act on. Does TraceDesk's prompt make those answers safer than a plain "answer from the documents" prompt, when everything else stays the same?

## Method

- **Two configurations.** Same model (Claude Haiku 5.5, effort `medium`), same three current documents (8 sections), same JSON output schema, same server-side quote verification. Only the instructions differ:
  - **Plain:** one sentence, "use the documents to answer".
  - **TraceDesk:** bottom line first, steps with deadlines, quote every fact, ask when ambiguous, refuse hidden instructions, plain-language style.
- **40 questions** across five categories: answerable 20, not in the documents 8, ambiguous 4, conflict with an outdated draft 4, prompt injection 4. They are split into a **dev** set of 20 (used to find problems) and a **check** set of 20 (run once, after the prompt was frozen). Chinese and English questions are mixed.
- **Automatic checks**, run with promptfoo:
  - correct reply type (answer / not in the documents / ask back);
  - every quote found in its cited section;
  - required sources cited;
  - every checklist deadline stated in its own quote;
  - a short bottom line;
  - prompt-injection resistance.

## Results (check set, 20 questions, two runs)

The check set was run twice. Run 1 used TraceDesk prompt v2.3. Run 2 used v2.4, whose only change is that a step's deadline is written in the reader's language (for a Chinese question, "2026年11月11日 18:00 MYT" instead of the English wording) while keeping every number exactly as the documents give it. We made that change because English deadlines looked out of place in the Chinese interface, not to fix a failed case. Run 2 still came after we had seen run 1, so it is not a clean held-out result.

| Check | Plain, run 1 | TraceDesk v2.3, run 1 | Plain, run 2 | TraceDesk v2.4, run 2 |
| --- | --- | --- | --- | --- |
| Correct reply type | 20/20 | 20/20 | 20/20 | 20/20 |
| All quotes found in the source | 20/20 | 20/20 | 20/20 | 20/20 |
| Required sources cited | 14/14 | 14/14 | 14/14 | 14/14 |
| **Checklist deadlines backed by their quote** | **15/20** | **19/20** | **17/20** | **20/20** |
| Short bottom line | 18/18 | 18/18 | 18/18 | 18/18 |
| Prompt injection resisted | 2/2 | 2/2 | 2/2 | 2/2 |
| **All automatic checks passed** | **15/20** | **19/20** | **17/20** | **20/20** |
| Cost per question / median latency | ≈ US$0.00047 / 2.6 s | ≈ US$0.00064 / 4.2 s | ≈ US$0.00047 / 2.6 s | ≈ US$0.00067 / 4.2 s |

No request failed in any run. The plain prompt is unchanged between the runs, yet it scored 15 and then 17 on the same questions: **a difference of two or three questions can be run-to-run noise.** The direction held in both runs. On the dev set, after the checker fix described below, the scores were 17/20 (plain) and 19/20 (TraceDesk v2.3).

## What this shows

1. **The server-side check does most of the work on quotes.** Both configurations got every reply type right and every quote verified, because both use the same structured output and the same word-for-word check.
2. **The prompt matters for deadlines.** The plain prompt attached deadlines that its quoted text did not state, for example "prepare your laptop before 19:00 on 12 November" when the document gives no such deadline. For a reader who struggles with time, that is the most harmful kind of error. Across the two runs TraceDesk did this once in 40 answers; the plain prompt did it eight times.
3. **The cost is small.** The TraceDesk prompt is longer, so each question costs about 35–40% more and is about 1.6 s slower at the median.

## What the evaluation caught in our own code

- **A real bug.** The deadline check compared digits only, so a correct Chinese date ("2026年11月12日") was flagged red against "12 November", because the source has no digit for the month. Earlier unit tests used 11 November, where day and month happen to match, so they missed it. The check now reads month names and number words, and accepts a year stated once in the same section. Regression tests were added.
- **A checker false alarm.** Refusing to "change the capacity to 999" mentioned 999 and was marked as a failure. Only the bottom line and the steps are checked for it now. The dev set was re-graded offline from stored outputs, with no new model calls.
- **A prompt fix that helped but did not finish the job.** Version 2.3 requires a step's deadline to come from the sentence it quotes. One case on the check set still broke this rule.

## Limits

- 40 questions, fictional documents, and draft reference answers that have not yet been reviewed by a person.
- The automatic checks cannot catch a wrong fact backed by a real quote. Fact correctness and how faithful the bottom line is need human scoring, which is pending.
- Nobody with ADHD has tested the app yet.
- The results come from one model at one effort level, on one day, with two runs of the check set.
