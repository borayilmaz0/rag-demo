"""
prompts.py
----------
Built-in modes and runtime mode registry.

Built-in modes (always present, cannot be overridden by config):
  chat   — conversational, no forced retrieval, toggle available in UI
  strict — document-only, force_search=True, toggle hidden in UI

Custom modes from config.json are registered at startup via register_mode().
They are additive — built-ins always exist alongside them.

force_search behaviour (enforced in main.py /ask):
  True  → retrieval always runs regardless of the frontend toggle
  False → retrieval runs only if the user enables the toggle
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Mode:
    id:           str
    label:        str
    description:  str
    system:       str
    force_search: bool = False   # True → toggle hidden, search always on


# ── Context block injected into system prompt when search runs ────────────────

CONTEXT_BLOCK_TEMPLATE = """\
## Retrieved context from your knowledge base

{context}

---
Base your answer on the context above. Cite sources by title and page where available.
If the context does not contain enough information, say so clearly.\
"""


def build_context_block(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant documents were found in the knowledge base."

    lines = []
    for i, chunk in enumerate(chunks, 1):
        meta    = chunk["metadata"]
        title   = meta.get("title", "Untitled")
        page    = f"p.{meta['page']}" if meta.get("page") else ""
        section = meta.get("section", "")
        label   = " — ".join(filter(None, [title, section, page]))
        lines.append(f"[{i}] {label}\n{chunk['text']}")

    return CONTEXT_BLOCK_TEMPLATE.format(context="\n\n".join(lines))


# ── Built-in modes ────────────────────────────────────────────────────────────

_BUILTIN_MODES: dict[str, Mode] = {
    "chat": Mode(
        id="chat",
        label="Chat",
        description="Conversational assistant. Answers freely from its own knowledge.",
        system="You are a helpful conversational assistant. Be concise and natural.",
        force_search=False,
    ),
    "strict": Mode(
        id="strict",
        label="Strict",
        description="Only answers using retrieved document context. Never uses general knowledge.",
        system=(
            "You are a strict document assistant. "
            "You may ONLY answer using the retrieved context provided below. "
            "Never use your own training knowledge. "
            "If the context does not contain enough information to answer, respond with: "
            "\"I couldn't find information about that in your documents.\" "
            "Always cite the document title and page number."
        ),
        force_search=True,
    ),
}

# Working registry — starts as a copy of built-ins, custom modes appended
_MODES: dict[str, Mode] = dict(_BUILTIN_MODES)

DEFAULT_MODE = "chat"


# ── Registration (called once at startup from main.py) ────────────────────────

def register_mode(mode: Mode) -> None:
    """Add a custom mode from config. Built-in ids are protected."""
    if mode.id in _BUILTIN_MODES:
        raise ValueError(f"Mode id '{mode.id}' is reserved for a built-in mode.")
    _MODES[mode.id] = mode


# ── Accessors ─────────────────────────────────────────────────────────────────

def get_mode(mode_id: str) -> Mode:
    if mode_id not in _MODES:
        raise ValueError(f"Unknown mode '{mode_id}'. Available: {list(_MODES.keys())}")
    return _MODES[mode_id]


def list_modes() -> list[dict]:
    return [
        {
            "id":           m.id,
            "label":        m.label,
            "description":  m.description,
            "force_search": m.force_search,
        }
        for m in _MODES.values()
    ]