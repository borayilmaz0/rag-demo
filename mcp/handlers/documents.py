import httpx
from config import BACKEND_URL

async def handle_toggle_doc(args: dict) -> dict:
    session_id = args["session_id"]
    doc_id     = args["doc_id"]
    enabled    = args["enabled"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f"{BACKEND_URL}/sessions/{session_id}/docs/{doc_id}/toggle",
            json={"enabled": enabled},
        )
        resp.raise_for_status()
    state = "enabled" if enabled else "disabled"
    return {"content": [{"type": "text", "text": f"Document {doc_id} {state} in session {session_id}."}]}

async def handle_search_documents(args: dict) -> dict:
    query      = args["query"]
    top_k      = args.get("top_k", 5)
    session_id = args.get("session_id")

    params = {}
    if session_id:
        params["session_id"] = session_id

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BACKEND_URL}/search",
            json={"query": query, "top_k": top_k},
            params=params,
        )
        resp.raise_for_status()
        chunks = resp.json()["data"]["chunks"]

    if not chunks:
        return {"content": [{"type": "text", "text": "No relevant documents found."}]}

    lines = [f"Found {len(chunks)} relevant chunks:\n"]
    for i, chunk in enumerate(chunks, 1):
        meta    = chunk.get("metadata", {})
        title   = meta.get("title", "Untitled")
        page    = meta.get("page")
        section = meta.get("section")
        score   = chunk.get("score", 0)
        loc     = f"p.{page}" if page else ""
        if section:
            loc = f"{loc} § {section}" if loc else f"§ {section}"
        lines.append(f"[{i}] **{title}** {loc} (score: {score:.3f})\n{chunk['text']}\n")

    return {"content": [{"type": "text", "text": "\n".join(lines)}]}


async def handle_ingest_document(args: dict) -> dict:
    session_id = args.get("session_id")

    params = {}
    if session_id:
        params["session_id"] = session_id

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{BACKEND_URL}/ingest",
            json={
                "source":  args["source"],
                "title":   args["title"],
                "is_file": args.get("is_file", True),
            },
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()["data"]

    scope = f"session {session_id}" if session_id else "global knowledge base"
    msg = (
        f"Ingested '{data['title']}' into {scope}. "
        f"Stored {data['chunks_stored']} chunks."
    )
    return {"content": [{"type": "text", "text": msg}]}


async def handle_list_documents(args: dict) -> dict:
    session_id = args.get("session_id")

    params = {}
    if session_id:
        params["session_id"] = session_id

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{BACKEND_URL}/documents", params=params)
        resp.raise_for_status()
        docs = resp.json()["data"]["documents"]

    if not docs:
        scope = f"session {session_id}" if session_id else "global knowledge base"
        return {"content": [{"type": "text", "text": f"No documents in {scope} yet."}]}

    scope = f"session {session_id}" if session_id else "global knowledge base"
    lines = [f"{scope} — {len(docs)} document(s):\n"]
    for doc in docs:
        lines.append(f"- {doc['title']}  ({doc['chunk_count']} chunks)  [{doc['source']}]")

    return {"content": [{"type": "text", "text": "\n".join(lines)}]}
