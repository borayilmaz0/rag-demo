"""
repositories/kb_repository.py
------------------------------
SQLite-backed registry for persistent Knowledge Bases.

A Knowledge Base is a named, permanent document collection backed by a
dedicated ChromaDB collection. Sessions reference a KB by kb_id; documents
ingested into a KB persist across restarts and sessions.

Write operations (ingest, delete, drop KB) require the write token that is
returned once at KB creation time and never stored in plaintext.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
import uuid
from pathlib import Path

_DB_PATH = Path(os.getenv("KB_DB_PATH", "/app/data/kb.db"))


# ── Internal helpers ──────────────────────────────────────────────────────────

def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init() -> None:
    """Create the knowledge_bases table if it does not exist."""
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                kb_id             TEXT PRIMARY KEY,
                name              TEXT UNIQUE NOT NULL,
                description       TEXT,
                chroma_collection TEXT NOT NULL,
                write_token_hash  TEXT NOT NULL,
                created_at        TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create(name: str, description: str | None = None) -> dict:
    """
    Create a new Knowledge Base.
    Returns the full record including the write_token (shown once, never stored).
    Raises ValueError if a KB with that name already exists.
    """
    kb_id             = str(uuid.uuid4())
    chroma_collection = f"kb_{kb_id.replace('-', '_')}"
    write_token       = secrets.token_hex(32)

    with _conn() as conn:
        try:
            conn.execute(
                """
                INSERT INTO knowledge_bases
                    (kb_id, name, description, chroma_collection, write_token_hash)
                VALUES (?, ?, ?, ?, ?)
                """,
                (kb_id, name, description, chroma_collection, _hash_token(write_token)),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"A knowledge base named '{name}' already exists.")

    return {
        "kb_id":             kb_id,
        "name":              name,
        "description":       description,
        "chroma_collection": chroma_collection,
        "write_token":       write_token,  # returned once — caller must store it
    }


def get(kb_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT kb_id, name, description, chroma_collection, created_at FROM knowledge_bases WHERE kb_id = ?",
            (kb_id,),
        ).fetchone()
        return dict(row) if row else None


def get_by_name(name: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT kb_id, name, description, chroma_collection, created_at FROM knowledge_bases WHERE name = ?",
            (name,),
        ).fetchone()
        return dict(row) if row else None


def list_all() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT kb_id, name, description, chroma_collection, created_at FROM knowledge_bases ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def delete(kb_id: str) -> bool:
    with _conn() as conn:
        cursor = conn.execute("DELETE FROM knowledge_bases WHERE kb_id = ?", (kb_id,))
        conn.commit()
        return cursor.rowcount > 0


# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_write_token(kb_id: str, token: str) -> bool:
    """Return True if token matches the stored hash for kb_id."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT write_token_hash FROM knowledge_bases WHERE kb_id = ?",
            (kb_id,),
        ).fetchone()
        if not row:
            return False
        return secrets.compare_digest(row["write_token_hash"], _hash_token(token))
