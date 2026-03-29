import httpx
from config import BACKEND_URL

async def handle_create_session(args: dict) -> dict:
    payload = {}
    if args.get("mode_id"):
        payload["mode_id"] = args["mode_id"]
    if args.get("model_id"):
        payload["model_id"] = args["model_id"]
    if args.get("kb_ids"):
        payload["kb_ids"] = args["kb_ids"]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{BACKEND_URL}/sessions/", json=payload)
        resp.raise_for_status()
        data = resp.json()["data"]

    lines = [
        "Session created.",
        f"- session_id: {data['session_id']}",
        f"- mode: {data['mode_id']}",
        f"- model: {data['model_id']}",
    ]
    if data.get("kb_ids"):
        lines.append(f"- kb_ids: {', '.join(data['kb_ids'])} (Knowledge Bases attached)")
    lines.append("\nUse this session_id with ask, search_documents, ingest_document, and list_documents.")

    return {"content": [{"type": "text", "text": "\n".join(lines)}]}


async def handle_ask(args: dict) -> dict:
    session_id = args["session_id"]
    payload = {
        "message": args["message"],
        "top_k":   args.get("top_k", 5),
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BACKEND_URL}/sessions/{session_id}/ask",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()["data"]

    answer  = data["answer"]
    sources = data.get("sources", [])

    lines = [answer]
    if sources:
        lines.append("\n**Sources:**")
        for s in sources:
            title   = s.get("title", "Untitled")
            page    = s.get("page")
            section = s.get("section")
            score   = s.get("score", 0)
            loc     = f"p.{page}" if page else ""
            if section:
                loc = f"{loc} § {section}" if loc else f"§ {section}"
            lines.append(f"- {title} {loc} (score: {score:.3f})")

    return {"content": [{"type": "text", "text": "\n".join(lines)}]}
