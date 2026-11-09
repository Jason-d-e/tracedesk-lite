// When the documents do not answer, draft the email the reader would send to ask. A template, not a model, so it
// works in every mode and never invents a contact: the address is the one the documents state, and the body
// follows what the support guide asks a request to contain. The reader copies it or opens it in their mail app;
// nothing is sent by TraceDesk.

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const isChinese = (q) => /[㐀-鿿]/.test(q);

/** The documented support address, with the section it comes from. */
export function findContact(kb) {
  for (const c of kb.activeChunks) {
    const m = c.text.match(EMAIL_RE);
    if (m) return { email: m[0], source_id: c.id, title: c.title };
  }
  return null;
}

/** The draft: subject, body, address and a mailto link. The body is English, as the club's support guide is. */
export function draftEmail({ question, missing_info, kb }) {
  const contact = findContact(kb);
  const zh = isChinese(question);
  const docs = [...new Map(kb.activeChunks.map((c) => [c.doc_id, c.title])).values()];
  const subject = "Intro to AI Tools workshop: a question the documents do not answer";
  const body = [
    "Hello,",
    "",
    "Event: Intro to AI Tools workshop",
    "",
    "My question:",
    `“${question}”`,
    "",
    `I have read: ${docs.join("; ")}.`,
    missing_info ? `What they do not say: ${missing_info}` : "",
    "",
    "Could you tell me what applies, and whether there is a deadline I should know about?",
    "(Screenshot attached if useful, with private information removed.)",
    "",
    "Thank you,",
    "[Your name]",
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
  const to = contact?.email ?? "";
  return {
    to,
    to_source: contact ? { source_id: contact.source_id, title: contact.title } : null,
    subject,
    body,
    mailto: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    note: zh
      ? contact
        ? `收件地址来自《${contact.title}》；邮件按支持指南的要求用英文写好（活动名、问题描述、必要时附截图），可以直接复制或改动。`
        : "资料里没有写邮箱，收件人留空。邮件用英文写好，可以直接复制或改动。"
      : contact
        ? `The address comes from “${contact.title}”. The draft follows the support guide (event name, description, a screenshot if useful); edit it as you like.`
        : "The documents give no email address, so the recipient is left blank. Edit the draft as you like.",
  };
}
