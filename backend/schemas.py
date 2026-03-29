"""
schemas.py
----------
Shared request models, and the two standard response envelopes used
across every endpoint:

  DataResponse  – wraps every successful payload  → {"data": ...}
  ErrorResponse – raised anywhere, caught by the  → {"detail": "..."}
                  registered exception handler in main.py
"""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from prompts import DEFAULT_MODE

T = TypeVar("T")


# ── Standard response envelopes ───────────────────────────────────────────────

class DataResponse(BaseModel, Generic[T]):
    """Wrap every successful response so the wire format is always {"data": ...}."""
    data: T


class ErrorResponse(Exception):
    """
    Raise this anywhere (service, repository, router) to return a structured
    error.  The exception handler in main.py converts it to JSON.
    """
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ── Request models ────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    source:  str
    title:   str
    is_file: bool = True


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class CreateSessionRequest(BaseModel):
    mode_id:  str       = DEFAULT_MODE
    model_id: str       = ""    # defaults to first model in config if empty
    kb_ids:   list[str] = []    # attach one or more persistent Knowledge Bases


class CreateKBRequest(BaseModel):
    name:        str
    description: str | None = None


class ExportToKbRequest(BaseModel):
    name:        str
    description: str | None = None


class ToggleRequest(BaseModel):
    enabled: bool


class SwitchModeRequest(BaseModel):
    mode_id: str


class SwitchModelRequest(BaseModel):
    model_id: str


class AskRequest(BaseModel):
    message:        str
    search_enabled: bool = False
    top_k:          int  = 5
