"""
repositories/state_repository.py
---------------------------------
In-memory stores for sessions and ingestion jobs.
State is lost on restart — no persistence is intentional at this stage.
"""

from __future__ import annotations

_sessions: dict[str, dict] = {}
_jobs:     dict[str, dict] = {}


# ── Sessions ──────────────────────────────────────────────────────────────────

def get_session(session_id: str) -> dict | None:
    return _sessions.get(session_id)


def set_session(session_id: str, data: dict) -> None:
    _sessions[session_id] = data


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


# ── Jobs ──────────────────────────────────────────────────────────────────────

def get_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)


def set_job(job_id: str, data: dict) -> None:
    _jobs[job_id] = data


def update_job(job_id: str, **updates) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(updates)
