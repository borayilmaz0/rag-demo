"""
inspect_doc.py
--------------
Debug tool for inspecting what Docling extracts from a PDF before ingestion.

Reuses the converter, chunker, and all helper functions from ingestion.py
directly — so what you see here is exactly what the RAG pipeline will ingest.

Usage:
    python inspect_doc.py path/to/file.pdf [--fast] [--out output.md]

    --fast   Use the PyMuPDF fast path instead of Docling (shows what the
             default ingestion path produces for this file).
    --out    Write the markdown report to a file instead of stdout.
             Defaults to <filename>.inspect.md next to the source file.

Output:
    A markdown report with four sections:
      1. Document overview  — page count, item counts by label
      2. Table of Contents  — if one was detected
      3. All chunks         — exactly as they would be embedded, with metadata
      4. Raw Docling labels — every item label in document order (diagnostics)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from collections import Counter

# ── Import everything from ingestion so we test the real pipeline ─────────────
from ingestion import (
    _converter,
    _chunker,
    _STRIP_LABELS,
    _TOC_LABELS,
    _VISUAL_LABELS,
    _CAPTION_LABEL,
    _HANDLED_LABELS,
    _recursive_split,
    _item_label,
    _item_page,
    _extract_toc_chunk,
    _build_visual_chunks,
    parse_and_chunk_file,
    _chunk_pdf_fast,
    _chunk_pdf_docling,
)
from docling_core.types.doc import DocItemLabel


# ── Helpers ───────────────────────────────────────────────────────────────────

def _divider(title: str, width: int = 72) -> str:
    return f"\n## {title}\n"


def _fmt_chunk(i: int, chunk: dict) -> str:
    meta = chunk["metadata"]
    header_parts = [f"**Chunk {i}**"]
    if meta.get("type"):
        header_parts.append(f"`{meta['type']}`")
    if meta.get("page"):
        header_parts.append(f"page {meta['page']}")
    if meta.get("section"):
        header_parts.append(f"section: *{meta['section']}*")

    header = "  |  ".join(header_parts)
    text   = chunk["text"]
    # Indent text so it renders as a block in markdown
    indented = "\n".join(f"  {line}" for line in text.splitlines())
    return f"{header}\n\n{indented}\n"


# ── Main report builder ───────────────────────────────────────────────────────

def build_report(path: Path, use_fast: bool) -> str:
    lines: list[str] = []
    lines.append(f"# Docling Inspection Report\n")
    lines.append(f"**File:** `{path}`  \n")
    lines.append(f"**Mode:** {'PyMuPDF fast path' if use_fast else 'Docling full pipeline'}  \n")

    # ── Section 1: Overview ───────────────────────────────────────────────────
    lines.append(_divider("1. Document Overview"))

    if not use_fast:
        result    = _converter.convert(str(path))
        doc       = result.document
        raw_items = list(doc.iterate_items())
        items     = [i[0] if isinstance(i, tuple) else i for i in raw_items]

        label_counts: Counter = Counter()
        for item in items:
            lbl = _item_label(item)
            label_counts[lbl.value if lbl else "unknown"] += 1

        lines.append(f"Total document items: **{len(items)}**\n")
        lines.append("Item counts by label:\n")
        for label, count in sorted(label_counts.items(), key=lambda x: -x[1]):
            lines.append(f"- `{label}`: {count}")
        lines.append("")

        # Stripped items
        stripped = [i for i in items if _item_label(i) in _STRIP_LABELS]
        lines.append(f"Items stripped (headers/footers): **{len(stripped)}**\n")

        # ── Section 2: TOC ────────────────────────────────────────────────────
        lines.append(_divider("2. Table of Contents"))
        content_items = [i for i in items if _item_label(i) not in _STRIP_LABELS]
        toc_chunk = _extract_toc_chunk(content_items, path.stem, str(path))
        if toc_chunk:
            lines.append(toc_chunk["text"])
        else:
            lines.append("*No table of contents detected.*")
        lines.append("")

        # ── Section 3: Raw label sequence (diagnostics) ───────────────────────
        lines.append(_divider("4. Raw Docling Label Sequence (diagnostics)"))
        lines.append("Every item in document order — useful for spotting misclassifications:\n")
        for idx, item in enumerate(items):
            lbl  = _item_label(item)
            page = _item_page(item)
            text_preview = (getattr(item, "text", "") or "").strip()[:80]
            text_preview = text_preview.replace("\n", " ")
            marker = ""
            if lbl in _STRIP_LABELS:
                marker = " ⛔ stripped"
            elif lbl in _TOC_LABELS:
                marker = " 📋 toc"
            elif lbl in _VISUAL_LABELS:
                marker = " 🖼 visual"
            elif lbl == _CAPTION_LABEL:
                marker = " 💬 caption"
            lines.append(
                f"  [{idx:03d}] p{page or '?'}  `{lbl.value if lbl else 'unknown'}`{marker}  "
                f"→ {text_preview!r}"
            )
        lines.append("")

    # ── Section 4: All chunks as they will be embedded ────────────────────────
    lines.append(_divider("3. Chunks (as they will be embedded)"))

    if use_fast:
        chunks = _chunk_pdf_fast(path, path.stem)
    else:
        chunks = _chunk_pdf_docling(path, path.stem)

    if not chunks:
        lines.append("*No chunks produced.*\n")
    else:
        lines.append(f"Total chunks: **{len(chunks)}**\n")

        # Group by type for summary
        type_counts: Counter = Counter(c["metadata"]["type"] for c in chunks)
        lines.append("Chunk types: " + ", ".join(f"`{t}` × {n}" for t, n in type_counts.items()))
        lines.append("")

        for i, chunk in enumerate(chunks, 1):
            lines.append(_fmt_chunk(i, chunk))
            lines.append("---")
        lines.append("")

    return "\n".join(lines)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect what Docling / ingestion.py produces for a PDF."
    )
    parser.add_argument("file", help="Path to a PDF file")
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Use the PyMuPDF fast path instead of Docling",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output markdown file path (default: <file>.inspect.md)",
    )
    args = parser.parse_args()

    path = Path(args.file).expanduser().resolve()
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    print(f"Processing {path.name} ...", file=sys.stderr)
    report = build_report(path, use_fast=args.fast)

    out_path = Path(args.out) if args.out else path.with_suffix(".inspect.md")
    out_path.write_text(report, encoding="utf-8")
    print(f"Report written → {out_path}", file=sys.stderr)
    print(f"Open with:  open '{out_path}'", file=sys.stderr)


if __name__ == "__main__":
    main()