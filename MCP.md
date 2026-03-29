# MCP Integration

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard that lets AI assistants call external tools defined by a server. Instead of copy-pasting text into Claude, you ask Claude naturally and it decides when to call your tools automatically.

This project ships an MCP server that exposes your knowledge base as tools. Once connected, Claude can create sessions, manage Knowledge Bases, search documents, ingest new files, and ask questions — all from within a conversation.

---

## Available tools

### Knowledge Base management

#### `create_kb`
Creates a named, persistent Knowledge Base backed by a dedicated ChromaDB collection. Returns a `kb_id` and a `write_token` — **store the token securely, it is shown only once**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Unique name for the KB |
| `description` | string | no | Optional description of its contents |

#### `list_kbs`
Lists all persistent Knowledge Bases with their `kb_id`, name, and description. No parameters required.

#### `ingest_into_kb`
Ingests a file or raw text into a persistent Knowledge Base. Requires the `write_token` issued at creation. Documents here persist across sessions and container restarts.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `kb_id` | string | yes | Knowledge Base ID from `create_kb` |
| `source` | string | yes | Absolute file path or raw text content |
| `title` | string | yes | Human-readable document title |
| `write_token` | string | yes | Token issued when the KB was created |
| `is_file` | boolean | no | `true` if source is a path, `false` if raw text (default: `true`) |

#### `export_session_to_kb`
Promotes a session's documents into a new persistent Knowledge Base. Copies all chunks and their existing embeddings — no re-processing or re-embedding. Returns a `kb_id` and `write_token`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session whose documents will be exported |
| `name` | string | yes | Name for the new Knowledge Base |
| `description` | string | no | Optional description |

---

### Session management

#### `create_session`
Creates a new RAG session. Returns a `session_id` used by all other session tools.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `mode_id` | string | no | `"chat"` (default) or `"strict"` (documents only) |
| `model_id` | string | no | Model ID from `config.json` (e.g. `"local-qwen"`) |
| `kb_ids` | array | no | Knowledge Base IDs to attach at creation |

#### `attach_kb`
Attaches a Knowledge Base to an existing session. The KB is searched on the next `ask`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session ID |
| `kb_id` | string | yes | Knowledge Base ID to attach |

#### `detach_kb`
Detaches a KB from a session. Documents in the KB are not deleted.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session ID |
| `kb_id` | string | yes | Knowledge Base ID to detach |

#### `toggle_kb`
Enables or disables a KB within a session without detaching it. Disabled KBs are skipped during retrieval.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session ID |
| `kb_id` | string | yes | Knowledge Base ID |
| `enabled` | boolean | yes | `true` to enable, `false` to disable |

#### `toggle_doc`
Enables or disables a specific document within a session. Disabled docs are excluded from retrieval across all collections (session and KB).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session ID |
| `doc_id` | string | yes | Document ID (from `list_documents`) |
| `enabled` | boolean | yes | `true` to enable, `false` to disable |

---

### Document operations

#### `ask`
Asks a question through a RAG session. Retrieves relevant chunks from all enabled collections (session + attached KBs), injects them as context, and returns the model's answer with source citations.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | yes | Session ID from `create_session` |
| `message` | string | yes | Question or message to send |
| `top_k` | integer | no | Number of chunks to retrieve (default: 5) |

#### `search_documents`
Searches using hybrid semantic + BM25 retrieval and returns raw chunks with scores. Pass a `session_id` to scope the search to that session's documents; omit it to search the global collection.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Natural language question or search query |
| `session_id` | string | no | Scope search to a session |
| `top_k` | integer | no | Number of chunks to return (default: 5) |

#### `ingest_document`
Ingests a file or raw text into a session or the global collection (not a KB — use `ingest_into_kb` for persistent KBs).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | Absolute file path or raw text content |
| `title` | string | yes | Human-readable document title |
| `is_file` | boolean | no | `true` if source is a path (default: `true`) |
| `session_id` | string | no | Scope the document to a session |

#### `list_documents`
Lists all documents in a session or the global collection with titles, sources, and chunk counts.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `session_id` | string | no | Scope to a session; omit for global |

---

## Claude Desktop

Claude Desktop uses the **SSE transport** (the older format — Desktop does not yet support Streamable HTTP). The server exposes both transports so Desktop and Claude Code work simultaneously.

Claude Desktop reads its MCP configuration from a JSON file on your machine.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

A pre-filled config file is included in this project:

```bash
cat claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "rag-assistant": {
      "url": "http://localhost:8081/sse",
      "description": "Personal knowledge base — search, ingest, and list your documents"
    }
  }
}
```

### Setup

1. Make sure the stack is running: `docker compose up`
2. Copy the config to Claude Desktop's config directory:

```bash
# macOS
cp claude_desktop_config.json \
   ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

3. Restart Claude Desktop
4. Look for the tools icon (hammer) in the Claude Desktop input bar — the `rag-assistant` server should be listed

---

## Claude Code

There are two ways to connect Claude Code to the MCP server.

### Option A — One command (quickest)

```bash
claude mcp add --transport http rag-assistant http://localhost:8081/mcp
```

This registers the server at **local scope** (stored in `~/.claude.json`, scoped to this project, private to you). Verify it was added:

```bash
claude mcp list
```

Or check inside a Claude Code session with `/mcp`.

To remove it later:

```bash
claude mcp remove rag-assistant
```

### Option B — Project `.mcp.json` (shared with the team)

A `.mcp.json` file is already included at the project root — Claude Code picks it up automatically:

```json
{
  "mcpServers": {
    "rag-assistant": {
      "type": "http",
      "url": "http://localhost:8081/mcp"
    }
  }
}
```

On first use Claude Code will ask you to approve the server — confirm once and it won't ask again. To reset that approval:

```bash
claude mcp reset-project-choices
```

### Scoping options

| Scope | Command flag | Where it's stored | Who sees it |
|---|---|---|---|
| local (default) | `--scope local` | `~/.claude.json` | Only you, this project |
| project | `--scope project` | `.mcp.json` | Everyone who clones the repo |
| user | `--scope user` | `~/.claude.json` | Only you, all projects |

---

## Example conversations

Once connected, Claude uses the tools automatically when relevant. You do not need to explicitly ask it to call a tool.

**Create a Knowledge Base and ingest documents:**
> *"Create a Knowledge Base called 'research-papers' and ingest /app/docs/paper.pdf titled 'ML Paper 2024' into it."*

Claude will call `create_kb`, then `ingest_into_kb`. Store the returned `write_token` — it won't be shown again.

**Ask with a Knowledge Base:**
> *"Create a session using the 'research-papers' KB and ask: what are the main contributions?"*

Claude will call `create_session` with the `kb_id`, then `ask`.

**Export a session to a persistent KB:**
> *"Export my session abc123 to a Knowledge Base named 'meeting-notes'."*

Claude will call `export_session_to_kb` and return the new `kb_id` and `write_token`.

**Toggle a document off:**
> *"Disable the document with ID xyz in session abc123 so it's excluded from search."*

Claude will call `toggle_doc` with `enabled: false`.

**Search:**
> *"What does my uploaded architecture document say about the database layer?"*

Claude will call `search_documents` with an appropriate query and cite the retrieved chunks.

**Ingest:**
> *"Please ingest this file: /Users/me/reports/q3-review.pdf with the title 'Q3 Review'"*

Claude will call `ingest_document` and confirm how many chunks were created.

**Chained:**
> *"Ingest the PDF at /tmp/paper.pdf titled 'ML Paper', then summarise its main contributions."*

Claude will ingest the document, then immediately search it to answer the question in the same turn.

---

## Troubleshooting

**Tools not appearing in Claude Desktop**
- Confirm the MCP server is running: `curl http://localhost:8081/health`
- Check that Claude Desktop was fully restarted after editing the config
- Verify the config file path and JSON syntax are correct

**`connection refused` errors**
- The MCP server at port 8081 must be accessible. If you are running Docker, confirm the port is mapped: `docker compose ps`
- If using Claude Code with the nginx-proxied config (`/mcp/sse`), ensure the nginx proxy is running and routing `/mcp` to the MCP container on port 8081

**Tool calls return backend errors**
- The MCP server forwards calls to the backend at `http://backend:8080` (inside Docker) or `http://localhost:8080` (native). Confirm the backend health: `curl http://localhost:8080/health`

**`409 Duplicate` error on ingest**
- The file content is already present in the target collection (identified by SHA-256 hash). The error message includes the title and `doc_id` of the existing document. No action needed unless you intend to replace it (delete the existing doc first).
