"""
services/rerank_service.py
--------------------------
Optional cross-encoder re-ranking via flashrank.
Activated when config.json contains a "reranker" block.

Supported flashrank models (no GPU needed):
  ms-marco-TinyBERT-L-2-v2     (fastest, ~4 MB)
  ms-marco-MiniLM-L-2-v2       (fast, ~23 MB)
  ms-marco-MiniLM-L-12-v2      (balanced — default)
  ms-marco-MultiBERT-L-12       (accurate, ~180 MB)
  rank-T5-flan                  (generative reranker)
  ce-esci-MiniLM-L12-v2        (e-commerce domain)

Call init() once from the app lifespan.
"""

from __future__ import annotations

from config import CFG

try:
    from flashrank import Ranker, RerankRequest
    _flashrank_available = True
except ImportError:
    _flashrank_available = False

_ranker = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init() -> None:
    global _ranker
    if not CFG.reranker or not CFG.reranker.enabled:
        return
    if not _flashrank_available:
        print("[rerank_service] flashrank not installed — reranking disabled.", flush=True)
        return
    _ranker = Ranker(model_name=CFG.reranker.model)
    print(f"[rerank_service] Loaded reranker: {CFG.reranker.model}", flush=True)


# ── Rerank ────────────────────────────────────────────────────────────────────

def rerank(query: str, chunks: list[dict], top_n: int) -> list[dict]:
    """
    Re-score chunks with the cross-encoder and return top_n by rerank score.
    Falls back to score-sorted truncation when reranker is not loaded.
    """
    if _ranker is None or not chunks:
        return chunks[:top_n]

    passages = [{"id": i, "text": c["text"]} for i, c in enumerate(chunks)]
    results  = _ranker.rerank(RerankRequest(query=query, passages=passages))

    reranked = []
    for r in results[:top_n]:
        chunk = chunks[r["id"]]
        reranked.append({**chunk, "score": round(float(r["score"]), 4)})
    return reranked
