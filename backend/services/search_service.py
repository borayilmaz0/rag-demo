"""
services/search_service.py
--------------------------
Embedding and hybrid retrieval (dense vector + sparse BM25).
Supersedes the top-level search.py.
Call init() once from the app lifespan.
"""

from __future__ import annotations

import numpy as np
from openai import OpenAI
from rank_bm25 import BM25Okapi
import chromadb

from config import CFG

_embed_client: OpenAI | None = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init() -> None:
    global _embed_client
    _embed_client = OpenAI(
        base_url=CFG.embedding.base_url,
        api_key=CFG.embedding.api_key,
    )


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed(texts: list[str]) -> list[list[float]]:
    response = _embed_client.embeddings.create(
        model=CFG.embedding.model,
        input=texts,
    )
    return [e.embedding for e in sorted(response.data, key=lambda e: e.index)]


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


# ── Hybrid search ─────────────────────────────────────────────────────────────

def hybrid_search(
    query:             str,
    collection:        chromadb.Collection,
    top_k:             int        = 5,
    candidate_k:       int        = 20,
    vector_weight:     float      = 0.6,
    excluded_doc_ids:  list[str]  | None = None,
) -> list[dict]:
    """
    Returns up to top_k chunks, each as:
      {"id": str, "text": str, "score": float, "metadata": dict}

    excluded_doc_ids: doc_ids whose chunks are filtered out before retrieval.
    """
    if collection.count() == 0:
        return []

    # ── Dense retrieval ───────────────────────────────────────────────────────
    query_vec = embed_one(query)

    where = (
        {"doc_id": {"$nin": excluded_doc_ids}}
        if excluded_doc_ids
        else None
    )

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=min(candidate_k, collection.count()),
        include=["documents", "metadatas", "distances"],
        where=where,
    )

    ids       = results["ids"][0]
    texts     = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    # Cosine distance → similarity in [0, 1]
    vector_scores = [1 - (d / 2) for d in distances]

    if not ids:
        return []

    # ── BM25 re-ranking ───────────────────────────────────────────────────────
    tokenized_corpus = [t.lower().split() for t in texts]
    bm25     = BM25Okapi(tokenized_corpus)
    bm25_raw = bm25.get_scores(query.lower().split())

    bm25_max    = float(np.max(bm25_raw)) if np.max(bm25_raw) > 0 else 1.0
    bm25_scores = [float(s) / bm25_max for s in bm25_raw]

    # ── Combine ───────────────────────────────────────────────────────────────
    bm25_w   = 1 - vector_weight
    combined = [
        vector_weight * v + bm25_w * b
        for v, b in zip(vector_scores, bm25_scores)
    ]

    ranked = sorted(
        zip(ids, texts, metadatas, combined),
        key=lambda x: x[3],
        reverse=True,
    )[:top_k]

    return [
        {
            "id":       rid,
            "text":     text,
            "score":    round(score, 4),
            "metadata": meta,
        }
        for rid, text, meta, score in ranked
    ]
