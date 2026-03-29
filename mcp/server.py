"""
RAG MCP Server
--------------
Exposes MCP tools over two transports so any MCP-compatible client can connect.

Tools:
  Knowledge Bases (persistent, named document collections):
  - create_kb         : create a named Knowledge Base, returns a write_token
  - list_kbs          : list all Knowledge Bases
  - ingest_into_kb    : ingest a file or text into a Knowledge Base (requires write_token)
  - export_session_to_kb : convert a session's documents into a persistent KB

  Sessions (conversation contexts that can reference a KB):
  - create_session    : create a RAG session; optionally attach KB(s) with kb_ids
  - attach_kb         : attach a KB to an existing session
  - detach_kb         : remove a KB from a session
  - toggle_kb         : enable/disable a KB in a session
  - ask               : send a message through a session (full RAG pipeline)
  - search_documents  : hybrid semantic + BM25 search, optionally scoped to session
  - ingest_document   : ingest into a session or global collection
  - list_documents    : return collection metadata and doc count
  - toggle_doc        : enable/disable a specific document in a session

Transports:
  Streamable HTTP  POST /mcp     → JSON response   (Claude Code, preferred)
  SSE (legacy)     GET  /sse     → event stream    (Claude Desktop)
                   POST /message → event stream

Protocol: JSON-RPC 2.0  (MCP spec)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import mcp, sse, health

app = FastAPI(title="RAG MCP Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mcp.router)
app.include_router(sse.router)
app.include_router(health.router)
