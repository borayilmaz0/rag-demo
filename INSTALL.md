# Installation

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- A `config.json` at the project root (see below)
- Optionally: [Ollama](https://ollama.com) for local models

---

## 1. Configure models (`config.json`)

This file is the single source of truth for every LLM and embedding provider. The backend will refuse to start without it.

### Quick setup

A fully annotated example is included:

```bash
cp config.example.json config.json
```

Open `config.json` and **delete the model entries you don't need**. Every block has a `_comment` field explaining what it is — those are ignored by the backend.

### Environment variable substitution

Any string value in `config.json` can reference an environment variable using `${VAR}` syntax:

```json
{
  "api_key": "${OPENAI_API_KEY}"
}
```

The backend resolves these at startup from your `.env` file or from variables set in `docker-compose.yml`. If a variable isn't set, the placeholder is left as-is (and the backend will fail to authenticate, so make sure to set the keys you reference).

This keeps secrets out of `config.json` so you can safely commit the file to version control.

### Provider presets

#### Local — Ollama inside Docker

```json
{
  "id":       "local-qwen",
  "label":    "Qwen 2.5 3B (local)",
  "base_url": "http://ollama:11434/v1",
  "model":    "qwen2.5:3b",
  "api_key":  "ollama"
}
```

Start with `docker compose --profile local up`. Pull models first — see [step 4](#4-pulling-ollama-models).

#### Local — Ollama running natively on your Mac

```json
{
  "id":       "local-qwen",
  "label":    "Qwen 2.5 3B (local)",
  "base_url": "http://host.docker.internal:11434/v1",
  "model":    "qwen2.5:3b",
  "api_key":  "ollama"
}
```

Use `http://host.docker.internal:11434/v1` — Docker's built-in DNS name that resolves to your Mac from inside any container.

#### OpenAI

Add to `.env`:
```env
OPENAI_API_KEY=sk-...
```

```json
{
  "id":       "gpt-4o",
  "label":    "GPT-4o",
  "base_url": "https://api.openai.com/v1",
  "model":    "gpt-4o",
  "api_key":  "${OPENAI_API_KEY}"
}
```

#### Anthropic

Add to `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

```json
{
  "id":       "claude-sonnet",
  "label":    "Claude Sonnet",
  "base_url": "https://api.anthropic.com",
  "model":    "claude-sonnet-4-6",
  "api_key":  "${ANTHROPIC_API_KEY}"
}
```

### Multiple providers at once

All configured models appear in the UI's model switcher. You can mix local and cloud freely:

```json
{
  "models": [
    {
      "id": "local-qwen", "label": "Qwen 2.5 3B (local)",
      "base_url": "http://ollama:11434/v1", "model": "qwen2.5:3b", "api_key": "ollama"
    },
    {
      "id": "gpt-4o", "label": "GPT-4o",
      "base_url": "https://api.openai.com/v1", "model": "gpt-4o", "api_key": "${OPENAI_API_KEY}"
    }
  ],
  "embedding": {
    "base_url": "http://ollama:11434/v1",
    "model":    "nomic-embed-text",
    "api_key":  "ollama"
  }
}
```

### Model fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier shown in the model switcher |
| `label` | yes | Display name in the UI |
| `base_url` | yes | OpenAI-compatible endpoint (the backend appends `/v1` if missing) |
| `model` | yes | Model name passed to the API (e.g. `gpt-4o`, `qwen2.5:3b`) |
| `api_key` | no | Defaults to `"ollama"`. Use `${VAR}` for cloud keys. |

> **Embedding note:** Only one embedding model is active at a time. All documents in a collection must be embedded with the same model — changing the embedding model after ingestion produces incorrect similarity scores.

---

## 2. Set API keys (`.env`)

Create a `.env` file at the project root for any keys referenced in `config.json`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Docker Compose picks this file up automatically. You can also override other defaults here:

```env
COLLECTION_NAME=my_docs
CHUNK_SIZE=768
CHUNK_OVERLAP_SIZE=192
```

---

## 3. Running with Docker

### Option A — Cloud providers only (no Ollama)

```bash
docker compose up --build
```

Point `base_url` values at cloud APIs in your `config.json`.

### Option B — With Ollama running inside Docker

```bash
docker compose --profile local up --build
```

The `ollama` service starts alongside the rest of the stack. Use `http://ollama:11434/v1` as the `base_url`.

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

Use `http://host.docker.internal:11434/v1` as the `base_url` in `config.json`.

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
```

### Native Ollama (Option C)

```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### Recommended combinations

| Use case | LLM | Embedding |
|---|---|---|
| Fast, local, low RAM | `qwen2.5:3b` | `nomic-embed-text` |
| Local, higher quality | `qwen2.5:7b` | `nomic-embed-text` |
| Cloud, best quality | `gpt-4o` | `text-embedding-3-small` |

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
