"""
repositories/vector_repository.py
----------------------------------
Singleton ChromaDB client and collection helpers.
Call init() once from the app lifespan before any other function is used.
"""

from __future__ import annotations

import os

import chromadb

_client: chromadb.HttpClient | None = None

COLLECTION_NAME = os.getenv("COLLECTION_NAME", "rag_docs")


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init(host: str, port: int) -> None:
    global _client
    _client = chromadb.HttpClient(host=host, port=port)


def _get_client() -> chromadb.HttpClient:
    if _client is None:
        raise RuntimeError("ChromaDB client not initialized. Call init() first.")
    return _client


# ── Collection access ─────────────────────────────────────────────────────────

def get_collection(name: str) -> chromadb.Collection:
    return _get_client().get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def get_session_collection(session_id: str) -> chromadb.Collection:
    return get_collection(f"session_{session_id.replace('-', '_')}")


def get_kb_collection(chroma_collection: str) -> chromadb.Collection:
    return get_collection(chroma_collection)


def get_global_collection() -> chromadb.Collection:
    return get_collection(COLLECTION_NAME)


def delete_collection(name: str) -> None:
    try:
        _get_client().delete_collection(name)
    except Exception:
        pass
