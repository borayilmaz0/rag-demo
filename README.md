# RAG Assistant

A fully local, provider-agnostic Retrieval-Augmented Generation (RAG) system. Upload your documents, ask questions in a chat interface, and get answers grounded in your own knowledge base — using any LLM you choose.

## What it does

- **Chat with your documents** — hybrid semantic + keyword search surfaces the most relevant chunks before the LLM answers
- **Persistent Knowledge Bases** — named, write-token-protected document collections that survive session deletion and can be shared across sessions
- **Provider-agnostic** — works with local models via Ollama, OpenAI, Anthropic, or any OpenAI-compatible API; configure multiple providers at once and switch mid-conversation
- **MCP server included** — exposes your knowledge base as tools to Claude Desktop and Claude Code
- **Session-based** — each conversation is isolated with its own document scope and history; attach one or more KBs at creation or dynamically later
- **Structured ingestion** — PDFs parsed with structural awareness (headings, sections, tables); plain text split recursively with overlap
- **Duplicate detection** — SHA-256 content hash prevents re-ingesting identical files; surfaces a clear warning instead of silently storing duplicates

## Quick start

```bash
# 1. Clone and enter the project
git clone <repo-url> && cd rag

# 2. Configure your models (copy and edit)
cp config.example.json config.json

# 3. Start everything (cloud providers)
docker compose up --build

# 4. Start with local Ollama included
docker compose --profile local up --build

# 5. Open the UI
open http://localhost:3000
```

> First run takes a few minutes — the backend pre-caches Docling's ML models into the image.

## Documentation

| Guide | Contents |
|---|---|
| [Installation](INSTALL.md) | Docker setup, config.json, Ollama, cloud providers, env vars |
| [Usage](USAGE.md) | Sessions, Knowledge Bases, modes, uploading documents, asking questions |
| [Architecture](ARCHITECTURE.md) | Code structure, technology choices, upload flow, ask flow |
| [MCP Integration](MCP.md) | Claude Desktop and Claude Code setup, available tools |

## Services at a glance

| Service | Port | Role |
|---|---|---|
| Frontend | 3000 | React chat UI |
| Backend | 8080 | FastAPI — ingestion, search, sessions, knowledge bases, Q&A |
| MCP Server | 8081 | MCP bridge for Claude Desktop / Claude Code |
| ChromaDB | 8000 | Vector store (internal) |
| Ollama | 11434 | Local LLM + embeddings (optional, `--profile local`) |
