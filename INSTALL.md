# Installation

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- A `config.json` at the project root (see below)
- Optionally: [Ollama](https://ollama.com) for local models

---

## 1. Configure models (`config.json`)

This file is the single source of truth for every LLM and embedding provider. The backend will refuse to start without it.

```json
{
  "models": [
    {
      "id": "local-qwen",
      "label": "Qwen 2.5 3B (local)",
      "base_url": "http://ollama:11434/v1",
      "model": "qwen2.5:3b",
      "api_key": "ollama"
    }
  ],
  "embedding": {
    "base_url": "http://ollama:11434/v1",
    "model": "nomic-embed-text",
    "api_key": "ollama"
  }
}
```

### Fields

| Field      | Required | Description                                                               |
| ---------- | -------- | ------------------------------------------------------------------------- |
| `id`       | yes      | Unique identifier shown in the model switcher                             |
| `label`    | yes      | Display name in the UI                                                    |
| `base_url` | yes      | OpenAI-compatible endpoint root (the backend appends `/v1` automatically) |
| `model`    | yes      | Model name passed to the API (e.g. `gpt-4o`, `qwen2.5:3b`)                |
| `api_key`  | no       | Defaults to `"ollama"`. Set to your real key for cloud providers.         |

### Multiple providers at once

```json
{
  "models": [
    {
      "id": "local-qwen",
      "label": "Qwen 2.5 3B (local)",
      "base_url": "http://ollama:11434/v1",
      "model": "qwen2.5:3b",
      "api_key": "ollama"
    },
    {
      "id": "gpt-4o",
      "label": "GPT-4o",
      "base_url": "https://api.openai.com/v1",
      "model": "gpt-4o",
      "api_key": "sk-..."
    },
    {
      "id": "claude-sonnet",
      "label": "Claude Sonnet",
      "base_url": "https://api.anthropic.com",
      "model": "claude-sonnet-4-6",
      "api_key": "sk-ant-..."
    }
  ],
  "embedding": {
    "base_url": "https://api.openai.com/v1",
    "model": "text-embedding-3-small",
    "api_key": "sk-..."
  }
}
```

All configured models appear in the UI's model switcher. You can switch between them mid-conversation without losing history.

> **Embedding note:** Only one embedding model is used at a time (configured in the `embedding` block). All documents ingested into a session must be embedded with the same model — changing the embedding model after ingestion will produce incorrect similarity scores.

---

## 2. Environment variables (optional)

Create a `.env` file at the project root for API keys you don't want to hardcode in `config.json`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
COLLECTION_NAME=rag_docs
```

These are available inside the backend container. You can reference them in your deployment scripts, but `config.json` must still contain the actual values used by the backend.

---

## 3. Running with Docker

### Option A — Cloud providers only (no Ollama)

```bash
docker compose up --build
```

Use `base_url` values that point to cloud APIs in your `config.json`.

### Option B — With Ollama running inside Docker

```bash
docker compose --profile local up --build
```

The `ollama` service starts alongside the rest of the stack. Use `http://ollama:11434` as the `base_url` for local models (the internal Docker network name).

### Option C — With Ollama running natively on your Mac

This gives better performance because Ollama has direct access to Apple Silicon's Metal GPU.

```bash
# Install Ollama natively
brew install ollama

# Start the Ollama server
ollama serve

# Start the rest of the stack (no Ollama container needed)
docker compose up --build
```

In `config.json`, point to `http://host.docker.internal:11434/v1` — this is Docker's built-in DNS name that resolves to your Mac's localhost from inside any container:

```json
{
  "base_url": "http://host.docker.internal:11434/v1"
}
```

---

## 4. Pulling Ollama models

Models must be pulled before they can be used. Storage is persistent via the `ollama_data` Docker volume (or `~/.ollama` for native installs).

### Inside Docker (Option B)

```bash
# LLM — small, fast, capable
docker exec -it rag_ollama ollama pull qwen2.5:3b

# LLM — larger, more capable
docker exec -it rag_ollama ollama pull qwen2.5:7b

# Embedding model (required for ingestion and search)
docker exec -it rag_ollama ollama pull nomic-embed-text

# Alternative embedding (if using qwen3-embedding in config.json)
docker exec -it rag_ollama ollama pull qwen3-embedding:0.6b
```

### Native Ollama (Option C)

```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### Recommended model combinations

| Use case             | LLM          | Embedding          |
| -------------------- | ------------ | ------------------ |
| Fast, local, low RAM | `qwen2.5:3b` | `nomic-embed-text` |

---

## 5. Verifying the stack is running

```bash
# All containers healthy
docker compose ps

# Backend health
curl http://localhost:8080/health

# MCP server health
curl http://localhost:8081/health

# Frontend
open http://localhost:3000
```

---

## Stopping

```bash
# Stop containers, keep volumes (documents and models are preserved)
docker compose down

# Stop and delete everything including volumes
docker compose down -v
```
