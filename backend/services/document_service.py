"""
services/document_service.py
-----------------------------
Ingestion pipeline (parse → embed → upsert) and document management.

Routing logic:
  kb_id present      → ingest into the KB's dedicated ChromaDB collection
  session_id present → ingest into the session's ChromaDB collection
  neither            → ingest into the global collection

Every chunk is tagged with source_type ("kb", "session", or "global") so
that delete protection can be enforced at the collection level.
"""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from ingestion import parse_and_chunk_file, parse_and_chunk_text
from schemas import ErrorResponse
from services import search_service
from repositories import state_repository, vector_repository, kb_repository


# ── Ingest ────────────────────────────────────────────────────────────────────

def run_ingest(
    source:     str,
    title:      str,
    is_file:    bool,
    session_id: str | None,
    doc_id:     str,
    kb_id:      str | None = None,
) -> int:
    if kb_id:
        kb = kb_repository.get(kb_id)
        if kb is None:
            raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
        col = vector_repository.get_kb_collection(kb["chroma_collection"])
        source_meta = {"source_type": "kb", "kb_id": kb_id}
    elif session_id:
        col = vector_repository.get_session_collection(session_id)
        source_meta = {"source_type": "session", "session_id": session_id}
    else:
        col = vector_repository.get_global_collection()
        source_meta = {"source_type": "global"}

    if is_file:
        path = Path(source)
        if not path.exists():
            raise ErrorResponse(status_code=404, detail=f"File not found: {source}")
        content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        chunks = parse_and_chunk_file(str(path), title)
    else:
        content_hash = hashlib.sha256(source.encode()).hexdigest()
        chunks = parse_and_chunk_text(source, title)

    # ── Duplicate check ───────────────────────────────────────────────────────
    existing = col.get(
        where={"content_hash": {"$eq": content_hash}},
        limit=1,
        include=["metadatas"],
    )
    if existing["ids"]:
        existing_title = existing["metadatas"][0].get("title", "Unknown")
        existing_doc   = existing["metadatas"][0].get("doc_id", "")
        raise ErrorResponse(
            status_code=409,
            detail=f"Duplicate: '{existing_title}' (doc_id: {existing_doc}) already contains this content.",
        )

    if not chunks:
        raise ErrorResponse(
            status_code=422,
            detail="No content could be extracted from the document.",
        )

    for chunk in chunks:
        chunk["metadata"]["doc_id"]       = doc_id
        chunk["metadata"]["content_hash"] = content_hash
        chunk["metadata"].update(source_meta)

    texts      = [c["text"] for c in chunks]
    metadatas  = [
        {k: v for k, v in c["metadata"].items() if v is not None}
        for c in chunks
    ]
    embeddings = search_service.embed(texts)
    ids        = [str(uuid.uuid4()) for _ in chunks]

    col.upsert(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
    return len(chunks)


def run_ingest_background(
    job_id:     str,
    source:     str,
    title:      str,
    is_file:    bool,
    session_id: str | None,
    doc_id:     str,
    kb_id:      str | None = None,
) -> None:
    state_repository.update_job(job_id, status="processing")
    try:
        chunks_stored = run_ingest(source, title, is_file, session_id, doc_id, kb_id)
        state_repository.update_job(
            job_id,
            status="done",
            chunks_stored=chunks_stored,
            doc_id=doc_id,
        )
    except Exception as exc:
        state_repository.update_job(job_id, status="error", error=str(exc))


# ── Documents ─────────────────────────────────────────────────────────────────

def list_documents(session_id: str | None, kb_id: str | None = None) -> list[dict]:
    if kb_id:
        kb = kb_repository.get(kb_id)
        if kb is None:
            raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
        col = vector_repository.get_kb_collection(kb["chroma_collection"])
    elif session_id:
        col = vector_repository.get_session_collection(session_id)
    else:
        col = vector_repository.get_global_collection()

    if col.count() == 0:
        return []

    all_items = col.get(include=["metadatas"])
    seen: dict[str, dict] = {}
    for meta in all_items["metadatas"]:
        doc_id = meta.get("doc_id", "unknown")
        if doc_id not in seen:
            seen[doc_id] = {
                "doc_id":      doc_id,
                "title":       meta.get("title", "Untitled"),
                "source":      meta.get("source", ""),
                "source_type": meta.get("source_type", "global"),
                "chunk_count": 1,
            }
        else:
            seen[doc_id]["chunk_count"] += 1
    return list(seen.values())


def delete_document(
    doc_id:     str,
    session_id: str | None,
    kb_id:      str | None = None,
) -> int:
    if kb_id:
        kb = kb_repository.get(kb_id)
        if kb is None:
            raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
        col = vector_repository.get_kb_collection(kb["chroma_collection"])
    elif session_id:
        col = vector_repository.get_session_collection(session_id)
    else:
        col = vector_repository.get_global_collection()

    results = col.get(where={"doc_id": {"$eq": doc_id}}, include=[])
    if not results["ids"]:
        raise ErrorResponse(status_code=404, detail=f"Document {doc_id} not found.")
    col.delete(ids=results["ids"])
    return len(results["ids"])
