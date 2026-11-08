// TraceDesk Lite front end. Model text is always inserted as text nodes, never as HTML.
// Reused libraries: easy-speech (read aloud, MIT) and text-vide (bold word starts, MIT).

const $ = (sel) => document.querySelector(sel);
const form = $("#ask-form");
const input = $("#ask");
const askButton = $("#ask-button");
const charCount = $("#char-count");
const resultBox = $("#result");
const modelStatus = $("#model-status");
const focusToggle = $("#focus-toggle");
const bionicToggle = $("#bionic-toggle");

let lastRequest = null;
let lastPayload = null;
let lastData = null;

// ---------- preferences (per browser; page works without storage) ----------

const PREF_KEY = "tracedesk-prefs";
const prefs = { focus: false, bionic: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}"));
} catch {
  /* storage unavailable: keep defaults */
}
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
function applyPrefs() {
  document.body.classList.toggle("focus", prefs.focus);
  focusToggle.setAttribute("aria-pressed", String(prefs.focus));
  bionicToggle.setAttribute("aria-pressed", String(prefs.bionic));
}

// ---------- small DOM helper ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---------- bold word starts (text-vide) ----------

let textVide = null;
import("/vendor/text-vide.mjs")
  .then((m) => {
    textVide = m.textVide;
    if (lastData) renderResult(lastPayload, lastData);
  })
  .catch(() => bionicToggle.remove());

const OPEN = "\u0001";
const CLOSE = "\u0002";
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/** Returns nodes for `text`; when "bold word starts" is on and the text is not CJK, bolds word starts. */
function readable(text) {
  if (!prefs.bionic || !textVide || CJK.test(text)) return [text];
  const marked = textVide(text, { sep: [OPEN, CLOSE] });
  const nodes = [];
  for (const part of marked.split(OPEN)) {
    const [bold, rest] = part.includes(CLOSE) ? part.split(CLOSE) : [null, part];
    if (bold) nodes.push(el("b", { class: "vide" }, bold));
    if (rest) nodes.push(rest);
  }
  return nodes;
}

// ---------- read aloud (easy-speech) ----------

let speech = null;
async function getSpeech() {
  if (speech) return speech;
  const { default: EasySpeech } = await import("/vendor/easy-speech.js");
  if (!EasySpeech.detect().speechSynthesis) throw new Error("unsupported");
  await EasySpeech.init({ maxTimeout: 5000, interval: 250 });
  speech = EasySpeech;
  return speech;
}

async function speak(text, button) {
  const original = button.textContent;
  try {
    const s = await getSpeech();
    s.cancel();
    const lang = CJK.test(text) ? "zh" : "en";
    const voice = s.voices().find((v) => v.lang?.toLowerCase().startsWith(lang));
    button.textContent = "Speaking…";
    await s.speak({ text, voice, rate: 0.95, pitch: 1, volume: 1 });
  } catch {
    button.textContent = "Read aloud isn't available in this browser";
    setTimeout(() => (button.textContent = original), 3000);
    return;
  }
  button.textContent = original;
}

function speakableText(data) {
  const parts = [];
  if (data.key_point) parts.push(data.key_point);
  else if (data.clarifying_question) parts.push(data.clarifying_question);
  data.next_steps
    .filter((s) => s.verified)
    .forEach((s, i) => parts.push(`${i + 1}. ${s.action}${s.deadline ? `, ${s.deadline}` : ""}`));
  return parts.join(". ");
}

// ---------- status & sources ----------

async function loadStatus() {
  try {
    const data = await (await fetch("/api/status")).json();
    modelStatus.textContent = data.model_configured ? `Model connected · ${data.model}` : "Model not connected";
    modelStatus.className = `chip ${data.model_configured ? "chip-ok" : "chip-warn"}`;
  } catch {
    modelStatus.textContent = "Server unreachable";
    modelStatus.className = "chip chip-bad";
  }
}

async function loadSources() {
  const list = $("#doc-list");
  try {
    const data = await (await fetch("/api/sources")).json();
    $("#kb-version").textContent = `Knowledge version ${data.knowledge_version}. ${data.provenance}`;
    list.replaceChildren(
      ...data.documents.map((doc) => {
        const active = doc.status === "active";
        return el(
          "div",
          { class: `doc ${active ? "" : "superseded"}` },
          el(
            "div",
            { class: "doc-head" },
            el("strong", {}, `${doc.id} · ${doc.title}`),
            el("span", { class: `chip ${active ? "chip-ok" : "chip-muted"}` },
              active ? "current" : `superseded${doc.superseded_by ? ` by ${doc.superseded_by}` : ""} — not used`),
            el("span", { class: "hint" }, `version ${doc.version} · effective ${doc.effective_date}`),
          ),
          doc.sections.map((s) => el("p", { class: "doc-section" }, el("code", {}, s.id), " ", s.text)),
        );
      }),
    );
  } catch {
    list.textContent = "Could not load the document list.";
  }
}

// ---------- asking ----------

function setBusy(busy) {
  askButton.disabled = busy;
  resultBox.setAttribute("aria-busy", String(busy));
  resultBox.querySelectorAll("button, textarea").forEach((n) => (n.disabled = busy));
}

function asked(question) {
  return el("p", { class: "asked" }, "You asked: ", el("em", {}, question));
}

async function ask(payload) {
  lastRequest = payload;
  resultBox.hidden = false;
  resultBox.replaceChildren(
    asked(payload.question),
    el("div", { class: "loading" }, el("span", { class: "spinner", "aria-hidden": "true" }), "Checking the documents…"),
  );
  setBusy(true);
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { error: { message: `Unexpected server response (${res.status}).`, retryable: true } };
    }
    if (!res.ok || data.error) renderError(payload, data.error ?? { message: `Request failed (${res.status}).`, retryable: true });
    else renderResult(payload, data);
  } catch {
    renderError(payload, { message: "Could not reach the server. Is it still running?", retryable: true });
  } finally {
    setBusy(false);
  }
}

function renderError(payload, error) {
  lastData = null;
  resultBox.replaceChildren(
    asked(payload.question),
    el(
      "div",
      { class: "error-box", role: "alert" },
      el("strong", {}, "No answer this time. "),
      error.message,
      error.retryable ? el("div", {}, el("button", { type: "button", class: "btn", onclick: () => ask(lastRequest) }, "Try again")) : null,
    ),
  );
}

// ---------- rendering an answer ----------

const STATUS_VIEW = {
  answered: { label: "Answered from the documents", cls: "chip-ok" },
  insufficient_evidence: { label: "Not in the documents", cls: "chip-warn" },
  needs_clarification: { label: "Needs one more detail", cls: "chip-info" },
  withheld: { label: "Answer withheld — no quote could be verified", cls: "chip-bad" },
};

function highlighted(text, span) {
  if (!span) return [text];
  return [text.slice(0, span.start), el("mark", {}, text.slice(span.start, span.end)), text.slice(span.end)];
}

function renderCitation(c) {
  return el(
    "li",
    { class: "citation" },
    el(
      "div",
      { class: "citation-head" },
      el("span", { class: "citation-id" }, c.source_id),
      c.title ? el("span", {}, c.title) : null,
      c.version ? el("span", { class: "hint" }, `v${c.version} · effective ${c.effective_date}`) : null,
      el("span", { class: `chip ${c.verified ? "chip-ok" : "chip-bad"}` }, c.verified ? "quote verified" : "quote not found"),
    ),
    c.source_text ? el("blockquote", {}, highlighted(c.source_text, c.span)) : null,
    c.verified ? null : el("p", { class: "unverified" }, `The model quoted “${c.quote}”, which does not appear in this source.`),
  );
}

function renderSteps(steps) {
  const items = steps.map((s, i) => {
    const id = `step-${Date.now()}-${i}`;
    let deadline = null;
    if (s.deadline) {
      deadline = el(
        "span",
        { class: `deadline ${s.deadline_supported === false ? "deadline-bad" : ""}` },
        "⏰ ",
        s.deadline,
        s.deadline_supported === false ? " — not found in the quoted source, check before relying on it" : "",
      );
    }
    return el(
      "li",
      { class: `step ${s.verified ? "" : "step-unverified"}` },
      el("input", { type: "checkbox", id }),
      el(
        "label",
        { for: id },
        el("span", { class: "step-action" }, readable(s.action)),
        deadline,
        s.verified
          ? el("span", { class: "step-source hint" }, `source ${s.source_id} ✓`)
          : el("span", { class: "unverified" }, "This step could not be matched to the documents. Don't rely on it."),
      ),
    );
  });
  return el("ol", { class: "steps" }, items);
}

async function copySteps(steps, button) {
  const text = steps
    .filter((s) => s.verified)
    .map((s, i) => `${i + 1}. ${s.action}${s.deadline ? ` (${s.deadline})` : ""}`)
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied ✓";
  } catch {
    button.textContent = "Copy failed — select the list instead";
  }
  setTimeout(() => (button.textContent = "Copy checklist"), 2500);
}

function renderResult(payload, data) {
  lastPayload = payload;
  lastData = data;
  const view = STATUS_VIEW[data.status] ?? { label: data.status, cls: "chip-muted" };
  const parts = [asked(payload.question), el("div", { class: "result-head" }, el("span", { class: `chip ${view.cls}` }, view.label))];

  if (data.status === "withheld") {
    parts.push(el("p", { class: "key-point" }, "The model produced an answer, but none of its quotes could be matched to the documents, so it is not shown. Try rephrasing, or contact the organisers."));
  } else if (data.status === "needs_clarification") {
    const question = data.clarifying_question || data.answer;
    const reply = el("textarea", { rows: "2", maxlength: "500", id: "clarify-reply" });
    parts.push(
      el("p", { class: "key-point" }, readable(question)),
      el(
        "form",
        {
          class: "clarify",
          onsubmit: (e) => {
            e.preventDefault();
            const text = reply.value.trim();
            if (!text) return reply.focus();
            ask({ question: text, context: { previous_question: payload.question, clarifying_question: question } });
          },
        },
        el("label", { class: "label", for: "clarify-reply" }, "Your reply"),
        reply,
        el("div", { class: "form-row" }, el("span"), el("button", { type: "submit", class: "btn btn-primary" }, "Reply")),
      ),
    );
  } else {
    if (data.key_point) parts.push(el("p", { class: "key-point" }, readable(data.key_point)));
    if (data.status === "insufficient_evidence" && data.missing_info) {
      parts.push(el("p", { class: "missing" }, "Not in the documents: ", readable(data.missing_info)));
    }
  }

  const visibleSteps = data.status === "withheld" ? [] : data.next_steps;
  if (visibleSteps.length) {
    const copyBtn = el("button", { type: "button", class: "btn btn-small" }, "Copy checklist");
    copyBtn.addEventListener("click", () => copySteps(visibleSteps, copyBtn));
    parts.push(el("h3", { class: "section-title" }, "What to do"), renderSteps(visibleSteps), copyBtn);
  }

  if (data.status !== "withheld" && (data.key_point || data.clarifying_question)) {
    const listen = el("button", { type: "button", class: "btn btn-small" }, "🔊 Listen");
    listen.addEventListener("click", () => speak(speakableText(data), listen));
    parts.push(el("div", { class: "actions" }, listen));
  }

  if (data.answer && data.status !== "withheld" && data.status !== "needs_clarification") {
    parts.push(el("details", { class: "more", open: !prefs.focus }, el("summary", {}, "More detail"), el("p", { class: "answer" }, readable(data.answer))));
  }

  if (data.citations.length) {
    const c = data.checks;
    parts.push(
      el(
        "details",
        { class: "more" },
        el("summary", {}, `Sources (${c.citations_verified} of ${c.citations_total} quotes verified)`),
        el("ul", { class: "citations" }, data.citations.map(renderCitation)),
      ),
    );
  }

  const m = data.meta ?? {};
  parts.push(
    el(
      "p",
      { class: "meta" },
      `${m.model_served ?? m.model_requested} · prompt ${m.prompt_version} · knowledge ${m.knowledge_version} · ${((m.latency_ms ?? 0) / 1000).toFixed(1)} s`,
      m.fallback_used ? " · served by fallback model" : "",
    ),
  );

  resultBox.hidden = false;
  resultBox.replaceChildren(...parts);
}

// ---------- wiring ----------

focusToggle.addEventListener("click", () => {
  prefs.focus = !prefs.focus;
  savePrefs();
  applyPrefs();
  if (lastData) renderResult(lastPayload, lastData);
});

bionicToggle.addEventListener("click", () => {
  prefs.bionic = !prefs.bionic;
  savePrefs();
  applyPrefs();
  if (lastData) renderResult(lastPayload, lastData);
});

input.addEventListener("input", () => {
  charCount.textContent = `${input.value.length} / 500`;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) {
    input.focus();
    return;
  }
  ask({ question });
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit();
});

document.querySelectorAll(".example").forEach((btn) =>
  btn.addEventListener("click", () => {
    input.value = btn.textContent;
    charCount.textContent = `${input.value.length} / 500`;
    form.requestSubmit();
  }),
);

applyPrefs();
loadStatus();
loadSources();
