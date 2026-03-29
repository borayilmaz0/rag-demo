"""
dispatch.py
-----------
JSON-RPC 2.0 dispatcher and tool handler registry.
"""

import httpx
from typing import Any

from config import TOOLS
from handlers.kb import (
    handle_create_kb,
    handle_list_kbs,
    handle_ingest_into_kb,
    handle_export_session_to_kb,
    handle_attach_kb,
    handle_detach_kb,
    handle_toggle_kb,
)
from handlers.sessions import handle_create_session, handle_ask
from handlers.documents import (
    handle_toggle_doc,
    handle_search_documents,
    handle_ingest_document,
    handle_list_documents,
)

HANDLERS = {
    "create_kb":            handle_create_kb,
    "list_kbs":             handle_list_kbs,
    "ingest_into_kb":       handle_ingest_into_kb,
    "export_session_to_kb": handle_export_session_to_kb,
    "attach_kb":            handle_attach_kb,
    "detach_kb":            handle_detach_kb,
    "toggle_kb":            handle_toggle_kb,
    "create_session":       handle_create_session,
    "ask":                  handle_ask,
    "toggle_doc":           handle_toggle_doc,
    "search_documents":     handle_search_documents,
    "ingest_document":      handle_ingest_document,
    "list_documents":       handle_list_documents,
}


async def dispatch(message: dict) -> dict:
    """Handle a single JSON-RPC 2.0 message and return a response dict."""
    rpc_id = message.get("id")
    method = message.get("method", "")
    params = message.get("params", {})

    def ok(result: Any) -> dict:
        return {"jsonrpc": "2.0", "id": rpc_id, "result": result}

    def err(code: int, msg: str) -> dict:
        return {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": code, "message": msg}}

    if method == "initialize":
        return ok({
            "protocolVersion": "2024-11-05",
            "serverInfo": {"name": "rag-mcp-server", "version": "2.0.0"},
            "capabilities": {"tools": {}}
        })

    if method == "tools/list":
        return ok({"tools": TOOLS})

    if method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})

        if tool_name not in HANDLERS:
            return err(-32601, f"Unknown tool: {tool_name}")

        try:
            result = await HANDLERS[tool_name](tool_args)
            return ok(result)
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300]
            return err(-32000, f"Backend error {e.response.status_code}: {body}")
        except httpx.HTTPError as e:
            return err(-32000, f"Backend unreachable: {str(e)}")
        except Exception as e:
            return err(-32000, f"Tool execution failed: {str(e)}")

    return err(-32601, f"Method not found: {method}")
