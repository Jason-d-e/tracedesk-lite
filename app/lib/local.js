// The local engine: answers without any model API, the way help desks worked before large language models.
// It does not write; it chooses. The question is turned into keywords (with a small Chinese-to-English glossary,
// because the documents are English), every sentence of the active documents is scored by the keywords it
// contains, and the best sentence becomes the bottom line, quoted word for word. Sentences that read as
// instructions become checklist steps, with the deadline lifted from the same sentence. Two things the model
// does are kept as rules: asking which link is meant, and saying plainly when the documents do not cover
// something (with the documented contact). Nothing is paraphrased, invented or inferred.
import { checkResult } from "./validate.js";

export const LOCAL_VERSION = "local-rules-v1";
export const LOCAL_ENGINE = "local-rules (keywords + templates)";
/** A best sentence scoring below this is not treated as an answer (a rare keyword scores 1.5, a common one 1). */
export const THRESHOLD = 1.5;

const isChinese = (q) => /[㐀-鿿]/.test(q);

// Chinese phrases a reader might use, and the English words the documents use for the same thing.
// Entries marked q are question words: their expansions help rank sentences but do not count as a real hit.
const ZH_GLOSSARY = [
  [/取消|退出|不去|退掉/, ["cancel"]],
  [/报名|报了名|注册|登记/, ["register"]],
  [/截止|最晚|什么时候关|关闭/, ["closes", "deadline"]],
  [/什么时候|几点|时间|日期|哪天|哪一天|几号|哪日/, ["takes place", "closes", "sent by", "from"], "q"],
  [/开始|结束|几点到几点/, ["takes place", "from"]],
  [/在哪|地点|线上|线下|地址|哪里/, ["online", "takes place"], "q"],
  [/费用|多少钱|收费|免费|价格|要钱/, ["free", "participation"]],
  [/位置|座位|名额/, ["places"]],
  [/人数|容量|满了|多少人|几个人/, ["capacity", "participants"]],
  [/一定|保证|肯定/, ["guarantee"]],
  [/候补|等待|排队/, ["waiting list"]],
  [/转让|转给|换人|朋友|别人/, ["transfer", "different person"]],
  [/联系|客服|邮箱|邮件地址|找谁|支持|帮助/, ["support", "address", "contact"]],
  [/工作时间|几点上班|营业|周末/, ["support hours", "monday"]],
  [/回复|多久回|多久答复/, ["response time", "business days"]],
  [/链接|网址/, ["link"]],
  [/失效|过期|有效期/, ["expires", "minutes"]],
  [/密码|重置|重设/, ["password", "reset"]],
  [/几次|多少次|次数/, ["at most", "requests", "allowed"]],
  [/资格|谁可以|谁能|年龄|条件|要求/, ["open to", "students", "aged"]],
  [/编程|基础|经验|零基础/, ["programming experience"]],
  [/证书|证明|结业/, ["certificate"]],
  [/电脑|笔记本|设备|浏览器|网络|带什么|准备什么/, ["laptop", "browser", "internet connection"]],
  [/确认邮件|确认信|确认/, ["confirmation email"]],
  [/参会链接|会议链接|加入链接|怎么进|进入/, ["joining link", "confirmation email"]],
  [/垃圾邮件|找不到.*邮件|没收到|收不到/, ["spam folder", "cannot find the email"]],
  [/老师|讲师|主讲|谁讲/, ["instructor"]],
  [/电话|手机号|热线/, ["phone"]],
  [/截图|问题描述|怎么写|包含什么|写什么/, ["support request", "screenshot", "description of the problem"]],
  [/身份证|证件|隐私/, ["private identity", "passwords"]],
];
// English words a reader might use for what the documents say differently (content words: a match counts as a real hit).
const EN_SYNONYMS = {
  signup: ["register"], "sign up": ["register"], cost: ["free"], price: ["free"], pay: ["free"], deadline: ["closes"],
  start: ["takes place", "from"], starts: ["takes place", "from"], end: ["takes place", "from"], ends: ["takes place", "from"],
  transfer: ["different person"], friend: ["transfer", "different person"], contact: ["support", "address"], email: ["address"],
  expire: ["expires"], expiry: ["expires"], expired: ["expires", "request a new one"], teacher: ["instructor"], spam: ["spam folder"],
  join: ["joining link"], joining: ["joining link"], late: ["waiting list", "closes"], full: ["waiting list", "capacity"],
  spot: ["places"], seat: ["places"], seats: ["places"], place: ["places"], hours: ["support hours"], reply: ["response time"],
  response: ["response time"], age: ["aged"], eligible: ["open to"], eligibility: ["open to"], experience: ["programming experience"],
  beginner: ["programming experience"], bring: ["laptop", "need a"], guaranteed: ["guarantee"], sure: ["guarantee"],
  venue: ["online", "takes place"], location: ["online", "takes place"], find: ["cannot find the email"],
};
// Question words: their expansions help rank sentences but do not count as a real hit on their own.
const QUESTION_WORDS = {
  when: ["takes place", "closes", "sent by"], where: ["online", "takes place"], who: ["open to"], "what time": ["takes place", "from"],
  "how many": ["capacity", "at most"], "how long": ["expires", "minutes", "business days", "response time"], "how much": ["free"],
};
const STOP = new Set(["the", "a", "an", "is", "are", "am", "do", "does", "did", "i", "my", "me", "we", "to", "of", "for", "in", "on", "at", "it", "its", "this",
  "that", "can", "could", "what", "how", "if", "be", "will", "with", "and", "or", "you", "your", "there", "any", "please", "about", "get", "have", "has",
  "need", "want", "still", "also", "so", "then", "than", "up", "out", "into", "from", "by", "as", "not", "no", "yes", "ok", "tell", "know", "should", "would",
  "workshop", "democlub", "club", "event", "intro", "ai", "tools", "which", "right", "said", "now", "time", "after", "before", "one", "when", "where", "who",
  "many", "long", "much", "make", "ignore", "documents", "document", "date", "dates", "day", "days", "old", "new", "poster"]);

/** A light stemmer: plurals and the commonest endings, so "places" meets "place" and "registers" meets "register". */
export function stem(word) {
  let w = word.toLowerCase();
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 6) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 5) w = w.slice(0, -2);
  return w;
}
/** Two stems name the same word when equal, or when they share a long enough start ("regist" for register and registration, "cancel" for cancel and cancellation). */
function sameWord(a, b) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 5) return false;
  let i = 0;
  while (i < shorter && a[i] === b[i]) i++;
  return i >= 6 && i >= shorter * 0.7;
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s@.:]/g, " ").replace(/\s+/g, " ");
const key = (t) => (t.includes(" ") ? t : stem(t));

/** The search terms of a question: real (content) terms and question-word expansions, each with a weight. */
export function termsOf(question) {
  const lower = String(question).toLowerCase();
  const primary = [];
  const secondary = new Map(); // term -> weight factor
  const addP = (t) => { if (!primary.some((p) => sameWord(key(p), key(t)))) primary.push(t); };
  const addS = (t, factor) => { if (primary.some((p) => sameWord(key(p), key(t)))) return; secondary.set(t, Math.max(secondary.get(t) ?? 0, factor)); };
  for (const [k, syns] of Object.entries(EN_SYNONYMS)) if (new RegExp(`\\b${k}\\b`).test(lower)) syns.forEach(addP);
  for (const [re, words, kind] of ZH_GLOSSARY) if (re.test(question) && kind !== "q") words.forEach(addP);
  for (const w of lower.match(/[a-z][a-z-]+/g) ?? []) if (!STOP.has(w) && w.length > 2) addP(w);
  // The first expansion of a question word is its likeliest reading and weighs more than the rest.
  for (const [k, syns] of Object.entries(QUESTION_WORDS)) if (lower.includes(k)) syns.forEach((s, i) => addS(s, i === 0 ? 0.8 : 0.5));
  for (const [re, words, kind] of ZH_GLOSSARY) if (re.test(question) && kind === "q") words.forEach((s, i) => addS(s, i === 0 ? 0.8 : 0.5));
  return { primary, secondary };
}

/** Sentences of every active section, each with where it came from. */
export function sentencesOf(kb) {
  const out = [];
  for (const c of kb.activeChunks) {
    for (const s of c.text.split(/(?<=[.!?])\s+(?=[A-Z"“(])/)) {
      const text = s.trim();
      if (text.length >= 12) {
        const n = " " + norm(text) + " ";
        // Trailing punctuation leaves the token, so the last word of a sentence ("free.") matches like any other.
        out.push({ source_id: c.id, title: c.title, text, norm: n, stems: (n.match(/[a-z0-9@.:-]+/g) ?? []).map((w) => stem(w.replace(/[.:,-]+$/, ""))) });
      }
    }
  }
  return out;
}

const matches = (s, term) => (term.includes(" ") ? s.norm.includes(norm(term).trim()) : s.stems.some((w) => sameWord(w, stem(term))));

const ACTION_RE = /^(reply|register|contact|check|request|send|submit|bring|use|ask|apply|email)\b|\b(reply to|should|need to|needs? a|must|have to|required|registers through|request a new one)\b|^to (cancel|register|request|contact|join)\b/i;
const DEADLINE_RE = /\b(?:before|by|until)\s+(\d{1,2} \w+ \d{4}(?: at \d{1,2}:\d{2}(?: [A-Z]{3})?)?|\d{1,2}:\d{2}(?: [A-Z]{3})?)/;
const HOW_RE = /^\s*(how (do|can|should|would) i|how to)\b|怎么|怎样|如何/i;
const CONTACT_TERM = /^(support|address|contact|email|phone)$/;
const LINK_RE = /\blink\b|链接|网址/i;
const LINK_KIND_RE = /password|reset|密码|重置|joining|join|workshop|confirmation|参会|会议|加入|进入/i;

export function rank(sentences, { primary, secondary }, how) {
  const n = sentences.length;
  const weight = (term, factor = 1) => {
    const df = sentences.filter((s) => matches(s, term)).length;
    return (df === 0 ? 0 : df <= Math.max(2, n * 0.1) ? 1.5 : 1) * factor;
  };
  const w = new Map([...primary.map((t) => [t, weight(t)]), ...[...secondary].map(([t, f]) => [t, weight(t, f)])]);
  const aboutContact = primary.some((t) => CONTACT_TERM.test(t));
  return sentences
    .map((s) => {
      const hitsP = primary.filter((t) => matches(s, t));
      const hitsS = [...secondary.keys()].filter((t) => matches(s, t));
      const action = ACTION_RE.test(s.text);
      // A "how do I" question wants the instruction, not the consequence; a question about contacting wants the address.
      const bonus = (how && action ? 1 : 0) + (aboutContact && /@/.test(s.text) ? 1.5 : 0);
      const score = [...hitsP, ...hitsS].reduce((sum, t) => sum + w.get(t), 0) + bonus;
      return { ...s, hitsP, hitsS, action, score };
    })
    .sort((a, b) => b.score - a.score || Number(b.action) - Number(a.action) || a.text.length - b.text.length);
}

const texts = (zh) => ({
  clarify: zh ? "你是指密码重置链接，还是研讨会的参会链接？" : "Do you mean the password reset link or the workshop joining link?",
});

/**
 * A checklist step from an instruction sentence, still in the document's own words: the instruction after
 * "To cancel …," and without the deadline, which is shown beside it. "To cancel X, reply to the confirmation
 * email before 11 November" becomes "Reply to the confirmation email."
 */
export function actionOf(sentence, deadline) {
  let t = sentence;
  const lead = t.match(/^To [^,]+,\s+(.+)$/);
  if (lead) t = lead[1];
  if (deadline) {
    const at = t.indexOf(deadline);
    if (at > 0) t = (t.slice(0, at).replace(/\s+(before|by|until)\s*$/, "") + t.slice(at + deadline.length)).trim();
  }
  t = t.replace(/[.\s]+$/, "") + ".";
  return t[0].toUpperCase() + t.slice(1);
}

/**
 * Answer one question without a model. Same result shape as answerQuestion, so the interface and the checks
 * do not care which engine answered.
 */
export function answerLocally(kb, { question, context = null }) {
  const started = Date.now();
  const zh = isChinese(question);
  const T = texts(zh);
  // A reply to our own clarifying question is read together with the question it answers.
  const query = context?.clarifying_question ? `${context.previous_question} ${question}` : question;
  const sentences = sentencesOf(kb);
  let parsed;
  if (LINK_RE.test(query) && !LINK_KIND_RE.test(query)) {
    parsed = { status: "needs_clarification", key_point: "", answer: "", next_steps: [], citations: [], missing_info: "", clarifying_question: T.clarify };
  } else {
    const terms = termsOf(query);
    const ranked = rank(sentences, terms, HOW_RE.test(query));
    const best = ranked[0];
    // A real hit is needed: a content word of the question (or its glossary form) in the sentence. A question made
    // only of question words ("When is the workshop?") may be answered from their expansions.
    const real = best && (best.hitsP.length > 0 || (terms.primary.length === 0 && best.hitsS.length > 0));
    if (!best || !real || (best.score < THRESHOLD && terms.primary.length > 0)) {
      const contact = sentences.find((s) => /@/.test(s.text));
      parsed = {
        status: "insufficient_evidence", key_point: "", answer: "", next_steps: [],
        citations: contact ? [{ source_id: contact.source_id, quote: contact.text }] : [],
        // The status line already says the documents do not cover it; the engine has nothing to add about what is missing.
        missing_info: "", clarifying_question: "",
      };
    } else {
      const same = ranked.filter((s) => s.source_id === best.source_id && s.score > 0 && s !== best).slice(0, 3);
      const steps = [best, ...same]
        .filter((s) => s.action)
        .slice(0, 3)
        .map((s) => {
          const deadline = (s.text.match(DEADLINE_RE) ?? [])[1] ?? "";
          return { action: actionOf(s.text, deadline), deadline, source_id: s.source_id, quote: s.text };
        })
        // A step that only repeats the bottom line is not a step.
        .filter((s) => s.action !== best.text);
      parsed = {
        status: "answered",
        // The sentence itself, in the document's words; the interface shows which document it comes from.
        key_point: best.text,
        answer: same.map((s) => s.text).join(" "),
        next_steps: steps,
        citations: [{ source_id: best.source_id, quote: best.text }],
        missing_info: "",
        clarifying_question: "",
      };
    }
  }
  const meta = {
    prompt_version: LOCAL_VERSION,
    engine: "local",
    knowledge_version: kb.knowledgeVersion,
    model_requested: "local",
    model_served: LOCAL_ENGINE,
    fallback_used: false,
    effort: "n/a",
    latency_ms: Date.now() - started,
    stop_reason: "end",
    usage: { input_tokens: null, output_tokens: null },
  };
  return { ...checkResult(parsed, kb.chunkById), meta };
}
