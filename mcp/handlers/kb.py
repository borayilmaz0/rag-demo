"""
handlers/kb.py
--------------
Tool handlers for Knowledge Base operations:
  create_kb, list_kbs, ingest_into_kb, export_session_to_kb
"""

import httpx
from config import BACKEND_URL


async def handle_create_kb(args: dict) -> dict:
    payload = {"name": args["name"]}
    if args.get("description"):
        payload["description"] = args["description"]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{BACKEND_URL}/kb/", json=payload)
        resp.raise_for_status()
        data = resp.json()["data"]

    msg = (
        f"Knowledge Base created.\n"
        f"- kb_id: {data['kb_id']}\n"
        f"- name: {data['name']}\n"
        f"- write_token: {data['write_token']}\n\n"
        f"Store the write_token securely — it is shown only once.\n"
        f"Use kb_id with create_session to attach this KB to a session, "
        f"or ingest_into_kb to add documents."
    )
    return {"content": [{"type": "text", "text": msg}]}


async def handle_list_kbs(args: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{BACKEND_URL}/kb/")
        resp.raise_for_status()
        kbs = resp.json()["data"]["knowledge_bases"]

    if not kbs:
        return {"content": [{"type": "text", "text": "No Knowledge Bases exist yet. Use create_kb to create one."}]}

    lines = [f"{len(kbs)} Knowledge Base(s):\n"]
    for kb in kbs:
        desc = f" — {kb['description']}" if kb.get("description") else ""
        lines.append(f"- [{kb['kb_id']}] **{kb['name']}**{desc}  (created: {kb['created_at']})")

    return {"content": [{"type": "text", "text": "\n".join(lines)}]}


async def handle_ingest_into_kb(args: dict) -> dict:
    kb_id       = args["kb_id"]
    write_token = args["write_token"]

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BACKEND_URL}/kb/{kb_id}/ingest",
            json={
                "source":  args["source"],
                "title":   args["title"],
                "is_file": args.get("is_file", True),
            },
            headers={"x-write-token": write_token},
        )
        resp.raise_for_status()
        data = resp.json()["data"]

    msg = (
        f"Ingested '{data['title']}' into Knowledge Base {kb_id}. "
        f"Stored {data['chunks_stored']} chunks."
    )
    return {"content": [{"type": "text", "text": msg}]}


async def handle_export_session_to_kb(args: dict) -> dict:
    session_id = args["session_id"]
    payload    = {"name": args["name"]}
    if args.get("description"):
        payload["description"] = args["description"]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BACKEND_URL}/sessions/{session_id}/export-to-kb",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()["data"]

    msg = (
        f"Knowledge Base created from session.\n"
        f"- kb_id: {data['kb_id']}\n"
        f"- name: {data['name']}\n"
        f"- chunks_copied: {data['chunks_copied']}\n"
        f"- write_token: {data['write_token']}\n\n"
        f"Store the write_token securely — it is shown only once.\n"
        f"Use kb_id with create_session to attach this KB to future sessions."
    )
    return {"content": [{"type": "text", "text": msg}]}


async def handle_attach_kb(args: dict) -> dict:
    session_id = args["session_id"]
    kb_id      = args["kb_id"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{BACKEND_URL}/sessions/{session_id}/kbs/{kb_id}")
        resp.raise_for_status()
    return {"content": [{"type": "text", "text": f"Knowledge Base {kb_id} attached to session {session_id}."}]}


async def handle_detach_kb(args: dict) -> dict:
    session_id = args["session_id"]
    kb_id      = args["kb_id"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(f"{BACKEND_URL}/sessions/{session_id}/kbs/{kb_id}")
        resp.raise_for_status()
    return {"content": [{"type": "text", "text": f"Knowledge Base {kb_id} detached from session {session_id}."}]}


async def handle_toggle_kb(args: dict) -> dict:
    session_id = args["session_id"]
    kb_id      = args["kb_id"]
    enabled    = args["enabled"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f"{BACKEND_URL}/sessions/{session_id}/kbs/{kb_id}/toggle",
            json={"enabled": enabled},
        )
        resp.raise_for_status()
    state = "enabled" if enabled else "disabled"
    return {"content": [{"type": "text", "text": f"Knowledge Base {kb_id} {state} in session {session_id}."}]}
