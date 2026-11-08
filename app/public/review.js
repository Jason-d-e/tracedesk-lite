// Organiser review page. All stored text is inserted as text nodes, never as HTML.

const list = document.querySelector("#list");
const tabs = [...document.querySelectorAll("[data-status]")];
const exportLink = document.querySelector("#export");
let current = "pending";
let reasons = {};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

const STATUS_LABEL = {
  answered: ["Answered", "chip-ok"],
  insufficient_evidence: ["Not in the documents", "chip-warn"],
  needs_clarification: ["Asked for detail", "chip-info"],
  withheld: ["Withheld", "chip-bad"],
};

function when(iso) {
  return iso ? new Date(iso).toLocaleString() : "";
}

function renderItem(item) {
  const [label, cls] = STATUS_LABEL[item.answer_status] ?? ["Unknown", "chip-muted"];
  const note = el("textarea", { rows: "2", maxlength: "300", "aria-label": "What did you do about it?" });
  note.value = item.reviewer_note ?? "";
  const done = item.review_status === "reviewed";
  const button = el("button", { type: "button", class: "btn btn-small" + (done ? "" : " btn-primary") }, done ? "Reopen" : "Mark as done");
  const msg = el("span", { class: "hint", "aria-live": "polite" });

  button.addEventListener("click", async () => {
    button.disabled = true;
    const res = await fetch(`/api/reviews/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status: done ? "pending" : "reviewed", reviewer_note: note.value }),
    });
    if (res.ok) load();
    else {
      msg.textContent = (await res.json()).error?.message ?? "Could not save.";
      button.disabled = false;
    }
  });

  return el(
    "article",
    { class: "review-item" },
    el("p", { class: "review-q" }, item.question),
    el(
      "div",
      { class: "review-meta" },
      el("span", { class: `chip ${cls}` }, label),
      el("strong", {}, reasons[item.review_reason] ?? item.review_reason),
      el("span", { class: "hint" }, `reported ${when(item.created_at)}`),
      done ? el("span", { class: "chip chip-ok" }, `done ${when(item.reviewed_at)}`) : null,
    ),
    item.key_point ? el("p", { class: "hint" }, "Answer given: ", item.key_point) : null,
    item.user_note ? el("p", {}, "Reader's note: ", el("em", {}, item.user_note)) : null,
    item.related_sources?.length ? el("p", { class: "hint" }, "Sources: ", item.related_sources.join(", ")) : null,
    el("p", { class: "hint" }, `${item.model || "model ?"} · prompt ${item.prompt_version || "?"} · knowledge ${item.knowledge_version || "?"}`),
    el("div", { class: "review-actions" }, note, el("div", { class: "form-row" }, msg, button)),
  );
}

async function load() {
  try {
    const res = await fetch(`/api/reviews${current ? `?status=${current}` : ""}`);
    const data = await res.json();
    document.querySelector("#count-pending").textContent = `(${data.counts.pending})`;
    document.querySelector("#count-reviewed").textContent = `(${data.counts.reviewed})`;
    exportLink.href = `/api/reviews.csv${current ? `?status=${current}` : ""}`;
    list.replaceChildren(
      ...(data.reviews.length ? data.reviews.map(renderItem) : [el("p", { class: "empty" }, "Nothing here yet.")]),
    );
  } catch {
    list.replaceChildren(el("p", { class: "error-box", role: "alert" }, "Could not load the review queue. Is the server running?"));
  }
}

async function loadGaps() {
  const summary = document.querySelector("#gap-summary");
  const gaps = document.querySelector("#gaps");
  try {
    const d = await (await fetch("/api/insights")).json();
    const s = d.by_status;
    summary.textContent = d.questions_answered_by_app
      ? `${d.questions_answered_by_app} reader questions so far: ${s.answered ?? 0} answered, ${s.insufficient_evidence ?? 0} not in the documents (${Math.round(d.unanswered_share * 100)}%), ${s.needs_clarification ?? 0} needed more detail, ${s.withheld ?? 0} withheld.`
      : "No reader questions yet.";
    gaps.replaceChildren(
      ...d.top_gaps.map((g) =>
        el(
          "li",
          { class: "gap" },
          el("strong", {}, g.question),
          " ",
          g.reported ? el("span", { class: "chip chip-warn" }, `${g.reported} asked to add`) : null,
          " ",
          g.asked ? el("span", { class: "chip chip-muted" }, `asked ${g.asked}×`) : null,
          g.missing_info ? el("div", { class: "hint" }, "Missing: ", g.missing_info) : null,
          g.reader_notes.length ? el("div", { class: "hint" }, "Reader notes: ", g.reader_notes.slice(0, 2).join(" · ")) : null,
        ),
      ),
    );
    if (!d.top_gaps.length) gaps.replaceChildren(el("li", { class: "empty" }, "No gaps found yet."));
  } catch {
    summary.textContent = "Could not load insights.";
  }
}

tabs.forEach((t) =>
  t.addEventListener("click", () => {
    current = t.dataset.status;
    tabs.forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
    load();
  }),
);

fetch("/api/review-reasons")
  .then((r) => r.json())
  .then((d) => (reasons = d))
  .finally(() => {
    load();
    loadGaps();
  });
