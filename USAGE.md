# Usage Guide

## Accessing the UI

Open [http://localhost:3000](http://localhost:3000) after the stack is running.

---

## Sessions

Every conversation starts by creating a **session**. A session is an isolated workspace that tracks:

- its own document collection (documents you upload are scoped to the session)
- the full conversation history
- the active mode and model
- attached Knowledge Bases and their enabled/disabled state

Sessions persist in your browser's `localStorage` as long as the backend is running. Navigating away and returning will restore the session list. Closing the session (the back arrow) deletes it from the backend and removes its document collection from ChromaDB. **Knowledge Base documents are not affected.**

**To create a session:** click "New Session", choose a mode and model, and optionally select one or more Knowledge Bases to attach.

---

## Knowledge Bases

A **Knowledge Base (KB)** is a named, persistent document collection that exists independently of any session. Documents in a KB survive session deletion and can be used across multiple sessions simultaneously.

### Creating a KB

Currently KBs are created via the MCP server (`create_kb` tool). See [MCP Integration](MCP.md). The MCP server returns a `write_token` when a KB is created — **save it**, it is shown only once. You need the token to upload documents to or delete documents from the KB.

### Attaching a KB to a session

When creating a session, select one or more KBs from the "Knowledge Bases (optional)" multi-select picker. All attached KBs are searched automatically when you ask a question.

You can also add or remove KBs from within an active session using the **Add KB** button in the sidebar's Knowledge Bases section.

### Sidebar — Knowledge Bases section

Each attached KB appears in the left sidebar with its own controls:

| Control | What it does |
|---|---|
| Expand arrow | Shows/hides the KB's document list |
| Enable/disable switch | Includes or excludes the entire KB from retrieval without detaching it |
| Link-off button | Detaches the KB from this session (KB and its documents are not deleted) |
| Eye icon (per doc) | Toggles a specific document's visibility in retrieval |
| Lock icon (per doc) | Opens the delete dialog (requires write token) |
| "Upload to KB" button | Ingests a new file into the KB (requires write token) |

### Deleting a KB document

Click the lock icon next to a KB document, enter the write token, and confirm. The chunks are permanently removed from the KB's ChromaDB collection. **This affects all sessions using that KB.**

### Exporting a session to a KB

When the session has documents, a **"Save to Knowledge Base"** button appears at the bottom of the sidebar. This copies the session's documents (with their existing embeddings — no re-processing) into a new persistent KB. The dialog shows a `write_token` to copy and save.

---

## Modes

Modes control how the assistant behaves — specifically the system prompt it receives and whether document search runs automatically.

### Built-in modes

#### Chat (default)
- General-purpose conversational assistant
- Search is **off by default** — the model answers from its own training knowledge
- You can manually toggle search on per-message using the search button in the input bar
- Use this for general questions, brainstorming, or when you want the model's own knowledge

#### Strict
- The assistant is instructed to **only answer from your documents**
- Search always runs automatically (the toggle is hidden)
- If the documents don't contain enough information, the assistant says so rather than guessing
- Use this when you need answers that are strictly grounded in your uploaded content

### Custom modes

You can define your own modes in `config.json`:

```json
{
  "modes": [
    {
      "id":           "legal",
      "label":        "Legal Review",
      "description":  "Analyses documents for legal implications",
      "system":       "You are a legal assistant. Analyse the provided documents carefully. Always cite the specific clause or section you are referencing. Never give legal advice — only summarise what the documents say.",
      "force_search": true
    }
  ]
}
```

| Field | Description |
|---|---|
| `id` | Unique identifier (cannot be `"chat"` or `"strict"`) |
| `label` | Displayed in the mode selector |
| `description` | Shown as a subtitle under the label |
| `system` | The full system prompt the model receives |
| `force_search` | `true` = search always runs and toggle is hidden; `false` = user controls search |

Custom modes are additive — the two built-in modes are always available alongside them.

---

## Uploading documents

Supported formats: **PDF**, **Markdown (.md)**, **plain text (.txt)**

### To a session

- **Drag and drop** files onto the upload area in the sidebar's SESSION DOCUMENTS section
- **Click** the upload area to open a file picker (multi-select supported)

Uploaded documents are scoped to the session and deleted when the session is closed.

### To a Knowledge Base

Click **"Upload to KB"** inside an expanded KB in the sidebar. A dialog will prompt for:
1. Your **write token** for that KB
2. The file to upload (drag or click)

KB documents persist independently of any session.

### Duplicate detection

Before ingesting, the backend computes a SHA-256 hash of the file content and checks whether an identical document already exists in the target collection. If a duplicate is found, a **yellow warning** is shown (not an error) with the title and ID of the existing document. No duplicate is stored.

### What happens to your document

Upload is asynchronous. After the file is received, a background job processes it (parse → chunk → embed → store). The UI polls the job until it completes and then refreshes the document list.

Large or complex PDFs (especially scanned documents) may take 30–60 seconds due to the Docling parsing step.

See [Architecture — Upload flow](ARCHITECTURE.md#upload-and-ingest-flow) for the full sequence.

---

## What are chunks?

Long documents are too large to fit into a model's context window in one go, and sending an entire document for every question would be slow and expensive. Instead, documents are split into **chunks** — smaller, overlapping pieces of text.

- **Default chunk size:** ~1000 characters
- **Overlap:** ~100 characters between consecutive chunks (so context at boundaries isn't lost)
- **PDFs with structure:** Docling-parsed PDFs produce chunks that respect heading boundaries and include metadata (page number, section breadcrumb, element type)

When you ask a question with search enabled, the most relevant chunks (not the full document) are retrieved and injected into the model's context. The number of chunks retrieved is controlled by the **top_k** parameter.

---

## Asking questions

Type your question in the input bar and press **Enter** (or **Shift+Enter** for a newline).

Retrieval searches all enabled sources: the session's own documents **and** all enabled attached KBs.

### Search toggle

The button to the left of the Send button controls whether document search runs for this message:

- **Search OFF** (magnifying glass with cross): the model answers from its own knowledge only
- **Search ON** (magnifying glass): the system retrieves the top-k most relevant chunks from your documents and includes them as context before the model answers

In **Strict** mode this toggle is hidden — search always runs.

### top_k — how many chunks to retrieve

When search is on, you can choose how many chunks to retrieve:

| top_k | Effect |
|---|---|
| 5 (default) | Fast, focused answers. Best for precise questions. |
| 10 | More context. Better for broad questions or when the answer spans multiple sections. |
| 20 | Maximum context. Useful when you're unsure where the answer is. Slower and uses more of the model's context window. |

You can also type a custom number in the "custom" box.

Higher top_k increases recall (less chance of missing relevant content) but also introduces more noise. For most questions, 5 is the right starting point.

---

## Understanding the output

### Answer

The model's response, rendered with full markdown formatting — bold, italics, inline code, code blocks with syntax highlighting, lists, headings, and tables are all displayed properly.

### Sources panel

When search was enabled for a message, a **"N sources"** button appears below the answer. Clicking it expands the retrieved chunks that were given to the model:

| Field | Description |
|---|---|
| **Title** | The document name the chunk came from |
| **p.N** | Page number (PDFs only) |
| **Section** | Heading breadcrumb from the document structure, e.g. `Introduction > Background > Motivation` |
| **Score %** | Relevance score (0–100%). Combines cosine similarity and BM25. Higher = more relevant. |
| **Text** | The actual chunk text the model was given |

The score reflects how well the chunk matched your question — not how good the answer is. Chunks with >60% are usually a strong match.

### Search indicator

A small icon appears under every assistant message:
- Blue search icon: answer was grounded in retrieved documents
- Grey crossed-out search icon: answer came from the model's own knowledge

### Model label

The model that produced each answer is shown under the message. If you switch models mid-conversation, older messages retain their original model label.

---

## Switching models mid-conversation

Use the **Model** dropdown in the left sidebar. The change applies to the next message only — existing messages in the history stay attached to the model that produced them. The conversation history is preserved and passed to the new model in full.

---

## Downloading chat history

Click the download icon (top of the sidebar) to export the full conversation as a Markdown file. The export includes every message, the model used for each answer, and the retrieved sources with their text.
