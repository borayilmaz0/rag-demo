"""
services/session_service.py
----------------------------
Session lifecycle (CRUD, mode/model switching) and Q&A orchestration.

A session can have multiple Knowledge Bases attached (kb_ids). Each KB can be
individually enabled/disabled, and individual documents (by doc_id) can be
toggled off for retrieval — all without modifying the underlying KB or its
ChromaDB collection.

Session state shape:
  {
    "id":               str,
    "mode_id":          str,
    "model_id":         str,
    "kb_ids":           list[str],          # attached KBs (ordered)
    "disabled_kb_ids":  list[str],          # KBs skipped during retrieval
    "disabled_doc_ids": list[str],          # doc_ids filtered out during query
    "history":          list[dict],
  }
"""

from __future__ import annotations

import uuid

from config import CFG
from prompts import get_mode, build_context_block
from schemas import ErrorResponse
from services import llm_service, search_service
from repositories import state_repository, vector_repository, kb_repository


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_session(session_id: str) -> dict:
    session = state_repository.get_session(session_id)
    if session is None:
        raise ErrorResponse(status_code=404, detail=f"Session {session_id} not found.")
    _migrate(session)
    return session


def _migrate(session: dict) -> None:
    """Migrate old single-kb_id format to multi-kb_ids format in-place."""
    if "kb_ids" not in session:
        old_kb_id = session.pop("kb_id", None)
        session["kb_ids"]           = [old_kb_id] if old_kb_id else []
        session["disabled_kb_ids"]  = []
        session["disabled_doc_ids"] = []


def _require_mode(mode_id: str):
    try:
        return get_mode(mode_id)
    except ValueError as e:
        raise ErrorResponse(status_code=400, detail=str(e))


# ── Session CRUD ──────────────────────────────────────────────────────────────

def create(mode_id: str, model_id: str, kb_ids: list[str] | None = None) -> dict:
    _require_mode(mode_id)

    resolved_model_id = model_id or CFG.default_model.id
    if not CFG.get_model(resolved_model_id):
        raise ErrorResponse(
            status_code=400,
            detail=f"Unknown model id: '{resolved_model_id}'",
        )

    validated_kb_ids: list[str] = []
    for kb_id in (kb_ids or []):
        kb = kb_repository.get(kb_id)
        if kb is None:
            raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
        validated_kb_ids.append(kb_id)

    session_id = str(uuid.uuid4())
    state_repository.set_session(session_id, {
        "id":               session_id,
        "mode_id":          mode_id,
        "model_id":         resolved_model_id,
        "kb_ids":           validated_kb_ids,
        "disabled_kb_ids":  [],
        "disabled_doc_ids": [],
        "history":          [],
    })
    return {
        "session_id": session_id,
        "mode_id":    mode_id,
        "model_id":   resolved_model_id,
        "kb_ids":     validated_kb_ids,
    }


def get_state(session_id: str) -> dict:
    session   = _require_session(session_id)
    model_cfg = CFG.get_model(session["model_id"])

    kbs = []
    for kb_id in session["kb_ids"]:
        kb = kb_repository.get(kb_id)
        if kb:
            kbs.append({
                "kb_id":    kb_id,
                "name":     kb["name"],
                "enabled":  kb_id not in session["disabled_kb_ids"],
            })

    return {
        "session_id":       session_id,
        "mode_id":          session["mode_id"],
        "mode_label":       get_mode(session["mode_id"]).label,
        "model_id":         session["model_id"],
        "model_label":      model_cfg.label if model_cfg else session["model_id"],
        "turns":            len([m for m in session["history"] if m["role"] == "user"]),
        "kbs":              kbs,
        "disabled_doc_ids": session["disabled_doc_ids"],
    }


def attach_kb(session_id: str, kb_id: str) -> dict:
    session = _require_session(session_id)
    kb      = kb_repository.get(kb_id)
    if kb is None:
        raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
    if kb_id not in session["kb_ids"]:
        session["kb_ids"].append(kb_id)
    # Remove from disabled if it was previously detached-and-re-added
    session["disabled_kb_ids"] = [x for x in session["disabled_kb_ids"] if x != kb_id]
    return {"session_id": session_id, "kb_id": kb_id, "attached": True}


def detach_kb(session_id: str, kb_id: str) -> dict:
    session = _require_session(session_id)
    session["kb_ids"]          = [x for x in session["kb_ids"] if x != kb_id]
    session["disabled_kb_ids"] = [x for x in session["disabled_kb_ids"] if x != kb_id]
    return {"session_id": session_id, "kb_id": kb_id, "detached": True}


def toggle_kb(session_id: str, kb_id: str, enabled: bool) -> dict:
    session = _require_session(session_id)
    if kb_id not in session["kb_ids"]:
        raise ErrorResponse(status_code=404, detail=f"KB {kb_id} is not attached to this session.")
    if enabled:
        session["disabled_kb_ids"] = [x for x in session["disabled_kb_ids"] if x != kb_id]
    else:
        if kb_id not in session["disabled_kb_ids"]:
            session["disabled_kb_ids"].append(kb_id)
    return {"session_id": session_id, "kb_id": kb_id, "enabled": enabled}


def toggle_doc(session_id: str, doc_id: str, enabled: bool) -> dict:
    session = _require_session(session_id)
    if enabled:
        session["disabled_doc_ids"] = [x for x in session["disabled_doc_ids"] if x != doc_id]
    else:
        if doc_id not in session["disabled_doc_ids"]:
            session["disabled_doc_ids"].append(doc_id)
    return {"session_id": session_id, "doc_id": doc_id, "enabled": enabled}


def switch_mode(session_id: str, mode_id: str) -> dict:
    session = _require_session(session_id)
    mode    = _require_mode(mode_id)
    session["mode_id"] = mode_id
    return {"session_id": session_id, "mode_id": mode_id, "mode_label": mode.label}


def switch_model(session_id: str, model_id: str) -> dict:
    session   = _require_session(session_id)
    model_cfg = CFG.get_model(model_id)
    if not model_cfg:
        raise ErrorResponse(status_code=400, detail=f"Unknown model id: '{model_id}'")
    session["model_id"] = model_id
    return {"session_id": session_id, "model_id": model_id, "model_label": model_cfg.label}


def delete(session_id: str) -> dict:
    _require_session(session_id)
    state_repository.delete_session(session_id)
    vector_repository.delete_collection(f"session_{session_id.replace('-', '_')}")
    return {"session_id": session_id, "deleted": True}


def export_to_kb(session_id: str, name: str, description: str | None) -> dict:
    """
    Copy all chunks (with their existing embeddings) from the session's
    ChromaDB collection into a new persistent Knowledge Base collection.
    No re-embedding — chunks are transferred as-is.
    """
    _require_session(session_id)

    session_col = vector_repository.get_session_collection(session_id)
    if session_col.count() == 0:
        raise ErrorResponse(
            status_code=422,
            detail="Session has no documents to export.",
        )

    try:
        kb = kb_repository.create(name, description)
    except ValueError as e:
        raise ErrorResponse(status_code=409, detail=str(e))

    kb_col = vector_repository.get_kb_collection(kb["chroma_collection"])

    result = session_col.get(include=["embeddings", "documents", "metadatas"])

    updated_metadatas = []
    for meta in result["metadatas"]:
        m = dict(meta)
        m["source_type"] = "kb"
        m["kb_id"]       = kb["kb_id"]
        m.pop("session_id", None)
        updated_metadatas.append(m)

    kb_col.upsert(
        ids        = result["ids"],
        documents  = result["documents"],
        embeddings = result["embeddings"],
        metadatas  = updated_metadatas,
    )

    return {
        "kb_id":         kb["kb_id"],
        "name":          kb["name"],
        "description":   kb["description"],
        "write_token":   kb["write_token"],
        "chunks_copied": len(result["ids"]),
    }


# ── Q&A ───────────────────────────────────────────────────────────────────────

async def ask(
    session_id:     str,
    message:        str,
    search_enabled: bool,
    top_k:          int,
) -> dict:
    session = _require_session(session_id)
    mode    = get_mode(session["mode_id"])
    history = session["history"]

    do_search = search_enabled or mode.force_search
    sources:  list[dict] = []

    if do_search:
        chunks = _retrieve(session, message, top_k)
        system_prompt = f"{mode.system}\n\n{build_context_block(chunks)}"
        sources = [
            {
                "title":   c["metadata"].get("title"),
                "source":  c["metadata"].get("source"),
                "page":    c["metadata"].get("page"),
                "section": c["metadata"].get("section"),
                "score":   c["score"],
                "text":    c["text"],
            }
            for c in chunks
        ]
    else:
        system_prompt = mode.system

    answer = await llm_service.call_llm(
        messages=history + [{"role": "user", "content": message}],
        system_prompt=system_prompt,
        model_id=session["model_id"],
    )

    session["history"] = history + [
        {"role": "user",      "content": message},
        {"role": "assistant", "content": answer},
    ]

    return {
        "session_id":     session_id,
        "mode_id":        mode.id,
        "model_id":       session["model_id"],
        "answer":         answer,
        "sources":        sources,
        "search_enabled": do_search,
        "top_k":          top_k if do_search else 0,
        "kb_ids":         session["kb_ids"],
    }


def _retrieve(session: dict, query: str, top_k: int) -> list[dict]:
    """
    Retrieve from the session collection and all enabled attached KBs.
    Disabled KBs are skipped. disabled_doc_ids are filtered at query time.
    All results are merged and re-ranked by combined score.
    """
    session_id        = session["id"]
    disabled_kb_ids   = set(session.get("disabled_kb_ids", []))
    disabled_doc_ids  = session.get("disabled_doc_ids", []) or None

    all_chunks: list[dict] = []

    # Session collection
    session_col = vector_repository.get_session_collection(session_id)
    if session_col.count() > 0:
        all_chunks += search_service.hybrid_search(
            query=query,
            collection=session_col,
            top_k=top_k,
            excluded_doc_ids=disabled_doc_ids,
        )

    # Attached KB collections (skip disabled)
    for kb_id in session.get("kb_ids", []):
        if kb_id in disabled_kb_ids:
            continue
        kb = kb_repository.get(kb_id)
        if kb is None:
            continue
        kb_col = vector_repository.get_kb_collection(kb["chroma_collection"])
        if kb_col.count() > 0:
            all_chunks += search_service.hybrid_search(
                query=query,
                collection=kb_col,
                top_k=top_k,
                excluded_doc_ids=disabled_doc_ids,
            )

    return sorted(all_chunks, key=lambda c: c["score"], reverse=True)[:top_k]
