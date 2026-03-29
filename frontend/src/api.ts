const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const envelope = await res.json();
  return envelope.data as T;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface ModelConfig {
  id: string;
  label: string;
  model: string; // underlying model name (e.g. "qwen2.5:3b")
}

export interface ModeConfig {
  id: string;
  label: string;
  description: string;
  force_search: boolean;
}

export interface AppConfig {
  models: ModelConfig[];
  embedding: { model: string; base_url: string };
  modes: ModeConfig[];
}

export const getConfig = () => req<AppConfig>("/config");

// ── Knowledge Bases ───────────────────────────────────────────────────────────

export interface KnowledgeBase {
  kb_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const listKbs = () =>
  req<{ knowledge_bases: KnowledgeBase[] }>("/kb/");

export const getKbDocuments = (kb_id: string) =>
  req<{ documents: Doc[] }>(`/kb/${kb_id}/documents`);

export const deleteKbDocument = (
  kb_id: string,
  doc_id: string,
  write_token: string,
) =>
  fetch(`${BASE}/kb/${kb_id}/documents/${doc_id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-write-token": write_token,
    },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()).data as { doc_id: string; chunks_deleted: number };
  });

export const uploadFileToKb = async (
  file: File,
  kb_id: string,
  write_token: string,
  onProgress?: (msg: string) => void,
): Promise<IngestResult> => {
  const form = new FormData();
  form.append("file", file);
  onProgress?.(`Uploading ${file.name}…`);

  const res = await fetch(`${BASE}/kb/${kb_id}/ingest/upload`, {
    method: "POST",
    headers: { "x-write-token": write_token },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);

  const { job_id, title } = ((await res.json()).data) as { job_id: string; title: string };
  onProgress?.(`Processing ${title}…`);

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    const poll = await fetch(`${BASE}/ingest/jobs/${job_id}`);
    if (!poll.ok) throw new Error(`Job poll failed: ${poll.status}`);
    const job = ((await poll.json()).data) as {
      status: "pending" | "processing" | "done" | "error";
      chunks_stored: number;
      doc_id: string | null;
      title: string;
      error: string | null;
    };
    if (job.status === "done") return { doc_id: job.doc_id!, title: job.title, chunks_stored: job.chunks_stored };
    if (job.status === "error") throw new Error(job.error ?? "Ingestion failed");
    const chunkMsg = job.chunks_stored > 0 ? ` — ${job.chunks_stored} chunks so far` : "";
    onProgress?.(`Processing ${title} (${job.status}${chunkMsg})…`);
  }
  throw new Error("Upload timed out after 15 minutes");
};

// ── Sessions ──────────────────────────────────────────────────────────────────

export const createSession = (
  mode_id: string,
  model_id: string,
  kb_ids?: string[],
) =>
  req<{ session_id: string; mode_id: string; model_id: string; kb_ids: string[] }>(
    "/sessions/",
    {
      method: "POST",
      body: JSON.stringify({ mode_id, model_id, kb_ids: kb_ids ?? [] }),
    },
  );

export const attachKb = (session_id: string, kb_id: string) =>
  req(`/sessions/${session_id}/kbs/${kb_id}`, { method: "POST" });

export const detachKb = (session_id: string, kb_id: string) =>
  req(`/sessions/${session_id}/kbs/${kb_id}`, { method: "DELETE" });

export const toggleKb = (session_id: string, kb_id: string, enabled: boolean) =>
  req(`/sessions/${session_id}/kbs/${kb_id}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const toggleDoc = (session_id: string, doc_id: string, enabled: boolean) =>
  req(`/sessions/${session_id}/docs/${doc_id}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const deleteSession = (id: string) =>
  req(`/sessions/${id}`, { method: "DELETE" });

export const exportSessionToKb = (
  session_id: string,
  name: string,
  description?: string | null,
) =>
  req<{ kb_id: string; name: string; description: string | null; write_token: string; chunks_copied: number }>(
    `/sessions/${session_id}/export-to-kb`,
    {
      method: "POST",
      body: JSON.stringify({ name, description: description ?? null }),
    },
  );

export const switchMode = (id: string, mode_id: string) =>
  req(`/sessions/${id}/mode`, {
    method: "PATCH",
    body: JSON.stringify({ mode_id }),
  });

export const switchModel = (id: string, model_id: string) =>
  req<{ session_id: string; model_id: string; model_label: string }>(
    `/sessions/${id}/model`,
    {
      method: "PATCH",
      body: JSON.stringify({ model_id }),
    },
  );

export const ask = (
  id: string,
  message: string,
  searchEnabled: boolean,
  topK: number,
) =>
  req<{
    answer: string;
    sources: Source[];
    mode_id: string;
    model_id: string;
    search_enabled: boolean;
    top_k: number;
  }>(`/sessions/${id}/ask`, {
    method: "POST",
    body: JSON.stringify({
      message,
      search_enabled: searchEnabled,
      top_k: topK,
    }),
  });

// ── Documents ─────────────────────────────────────────────────────────────────

export const listDocuments = (session_id: string) =>
  req<{ documents: Doc[] }>(`/documents?session_id=${session_id}`);

export const deleteDocument = (doc_id: string, session_id: string) =>
  req(`/documents/${doc_id}?session_id=${session_id}`, { method: "DELETE" });

export const uploadFile = async (
  file: File,
  session_id: string,
  onProgress?: (msg: string) => void,
): Promise<IngestResult> => {
  const form = new FormData();
  form.append("file", file);
  onProgress?.(`Uploading ${file.name}…`);

  const res = await fetch(`${BASE}/ingest/upload?session_id=${session_id}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok)
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`);

  const { job_id, title } = ((await res.json()).data) as {
    job_id: string;
    title: string;
  };

  onProgress?.(`Processing ${title}…`);

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 2000));

    const poll = await fetch(`${BASE}/ingest/jobs/${job_id}`);
    if (!poll.ok) throw new Error(`Job poll failed: ${poll.status}`);

    const job = ((await poll.json()).data) as {
      status: "pending" | "processing" | "done" | "error";
      chunks_stored: number;
      doc_id: string | null;
      title: string;
      error: string | null;
    };

    if (job.status === "done")
      return {
        doc_id: job.doc_id!,
        title: job.title,
        chunks_stored: job.chunks_stored,
      };
    if (job.status === "error")
      throw new Error(job.error ?? "Ingestion failed");

    const chunkMsg =
      job.chunks_stored > 0 ? ` — ${job.chunks_stored} chunks so far` : "";
    onProgress?.(`Processing ${title} (${job.status}${chunkMsg})…`);
  }

  throw new Error("Upload timed out after 15 minutes");
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Doc {
  doc_id: string;
  title: string;
  source: string;
  chunk_count: number;
  source_type?: "kb" | "session" | "global";
}

export interface Source {
  title: string | null;
  source: string | null;
  page: number | null;
  section: string | null;
  score: number;
  text: string;
}

export interface IngestResult {
  doc_id: string;
  title: string;
  chunks_stored: number;
}

export const TOP_K_PRESETS = [5, 10, 20] as const;
export type TopKPreset = (typeof TOP_K_PRESETS)[number];
