import fs from "node:fs";
import path from "node:path";
import { PROJECT_DIR } from "./config.js";

export const DEFAULT_KNOWLEDGE_FILE = path.join(PROJECT_DIR, "data", "knowledge.json");

/**
 * Load the knowledge base. Only sections of documents whose status is "active"
 * become answerable chunks; superseded documents stay visible in the catalogue
 * but are never sent to the model.
 */
export function loadKnowledge(file = DEFAULT_KNOWLEDGE_FILE) {
  const kb = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!kb.knowledge_version || !Array.isArray(kb.documents)) {
    throw new Error(`Knowledge file ${file} is missing knowledge_version or documents.`);
  }

  const documents = kb.documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    version: doc.version,
    status: doc.status,
    effective_date: doc.effective_date,
    superseded_by: doc.superseded_by ?? null,
    sections: doc.sections.map((s) => ({ id: `${doc.id}#${s.id}`, text: s.text })),
  }));

  const activeChunks = [];
  for (const doc of kb.documents) {
    if (doc.status !== "active") continue;
    for (const section of doc.sections) {
      activeChunks.push({
        id: `${doc.id}#${section.id}`,
        doc_id: doc.id,
        title: doc.title,
        version: doc.version,
        effective_date: doc.effective_date,
        text: section.text,
      });
    }
  }

  const ids = activeChunks.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate chunk ids in knowledge base.");
  }

  return {
    knowledgeVersion: kb.knowledge_version,
    provenance: kb.provenance ?? "",
    documents,
    activeChunks,
    chunkById: new Map(activeChunks.map((c) => [c.id, c])),
  };
}
