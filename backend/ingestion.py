"""
ingestion.py
------------
Handles document loading, parsing, and chunking.

Strategy:
  - PDF files  → PyMuPDF
  - MD / TXT   → hand-rolled recursive splitter (no extra deps).
  - Everything else → Docling fallback.

Why two PDF paths?
  Docling runs a full ML pipeline (layout detection, TableFormer) that takes
  10-60s per document even on Apple Silicon because Docker can't use Metal.
  PyMuPDF extracts text in pure C in under a second for the vast majority of
  PDFs. Docling is still available as an opt-in for scanned or table-heavy docs.
"""

from __future__ import annotations

from pathlib import Path
import os

# ── Optional fast PDF parser ──────────────────────────────────────────────────
try:
    import fitz
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False

# ── Docling (slow but structure-aware) ───────────────────────────────────────
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling_core.transforms.chunker import HybridChunker

# Pipeline options for Docling:
#   do_ocr=False            → skip OCR (enable only for scanned PDFs)
#   do_table_structure=False → skip TableFormer neural model (big speedup);
#                              set True only when you need structured table JSON
_pdf_options = PdfPipelineOptions()
_pdf_options.do_ocr             = False
_pdf_options.do_table_structure = False   # flip to True for table-heavy docs

CHUNK_SIZE = os.getenv("CHUNK_SIZE", 1000)
CHUNK_OVERLAP_SIZE = os.getenv("CHUNK_OVERLAP_SIZE", 150)

_converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=_pdf_options)
    }
)

# HybridChunker without a HuggingFace tokenizer dependency.
# Docling will use its internal character-based limits — good enough for RAG.
# (Previously this loaded Qwen/Qwen3-Embedding-0.6B tokenizer which (a) didn't
# match our actual embedding model and (b) added a slow network download.)
_chunker = HybridChunker(merge_peers=True)


# ── Plain-text recursive chunker ─────────────────────────────────────────────

def _recursive_split(
    text: str,
    chunk_size: int = 1000,   # characters; ~200-250 tokens for nomic-embed-text
    overlap: int = 200,
) -> list[str]:
    """
    Split text on natural boundaries (paragraphs → newlines → sentences → words)
    until every chunk is within chunk_size characters.
    Adds overlap between consecutive chunks to avoid cutting context at boundaries.
    """
    separators = ["\n\n", "\n", ". ", " ", ""]
    chunks: list[str] = []
    print("CHUNK_SIZE", CHUNK_SIZE, "CHUNK_OVERLAP_SIZE", CHUNK_OVERLAP_SIZE)

    def split(s: str, seps: list[str]) -> None:
        if len(s) <= chunk_size or not seps:
            if s.strip():
                chunks.append(s.strip())
            return
        sep, *rest = seps
        parts = s.split(sep) if sep else list(s)
        current = ""
        for part in parts:
            candidate = current + (sep if current else "") + part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current.strip():
                    chunks.append(current.strip())
                tail = current[-overlap:] if overlap else ""
                current = (tail + sep + part).strip() if tail else part
                if len(current) > chunk_size:
                    split(current, rest)
                    current = ""
        if current.strip():
            chunks.append(current.strip())

    split(text, separators)
    return chunks


# ── Public API ────────────────────────────────────────────────────────────────

def parse_and_chunk_file(
    file_path: str,
    title: str,
    use_docling: bool = False,
) -> list[dict]:
    """
    Parse a file and return a list of chunk dicts ready for embedding.

    Args:
        file_path:   Absolute path to the file.
        title:       Human-readable document title stored in metadata.
        use_docling: Force Docling for PDFs even when PyMuPDF is available.
                     Use this for scanned PDFs or docs where table structure matters.

    Each returned chunk:
        {
            "text":     str,
            "metadata": {
                "title":   str,
                "source":  str,           # file path
                "page":    int | None,
                "section": str | None,    # heading breadcrumb (Docling only)
                "type":    str,           # "text", "table", etc.
            }
        }
    """
    path = Path(file_path)

    if path.suffix.lower() == ".pdf":
        if use_docling or not _PYMUPDF_AVAILABLE:
            return _chunk_pdf_docling(path, title)
        return _chunk_pdf_fast(path, title)

    return _chunk_text_file(path, title)


def parse_and_chunk_text(
    raw_text: str,
    title: str,
    source: str = "raw",
) -> list[dict]:
    """Chunk raw text content directly (no file needed)."""
    return [
        {
            "text": chunk,
            "metadata": {
                "title":   title,
                "source":  source,
                "page":    None,
                "section": None,
                "type":    "text",
            },
        }
        for chunk in _recursive_split(raw_text, CHUNK_SIZE, CHUNK_OVERLAP_SIZE)
        if chunk.strip()
    ]


# ── PDF: fast path (PyMuPDF) ──────────────────────────────────────────────────

def _chunk_pdf_fast(path: Path, title: str) -> list[dict]:
    """
    Extract text page-by-page with PyMuPDF and split with the recursive chunker.
    Runs in milliseconds. No ML models invoked.
    Falls back to Docling automatically if PyMuPDF finds no text on any page
    (likely a scanned PDF).
    """
    doc = fitz.open(str(path))
    chunks: list[dict] = []

    for page_num, page in enumerate(doc, 1):
        text = page.get_text().strip()
        if not text:
            continue
        for chunk_text in _recursive_split(text, CHUNK_SIZE, CHUNK_OVERLAP_SIZE):
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "title":   title,
                    "source":  str(path),
                    "page":    page_num,
                    "section": None,
                    "type":    "text",
                },
            })

    doc.close()

    # If we got nothing, the PDF is probably scanned — hand off to Docling
    if not chunks:
        return _chunk_pdf_docling(path, title)

    return chunks


# ── PDF: slow path (Docling) ──────────────────────────────────────────────────

def _chunk_pdf_docling(path: Path, title: str) -> list[dict]:
    """
    Use Docling's ML pipeline + HybridChunker for structure-aware chunking.
    Preserves heading breadcrumbs, page numbers, and element types.
    Slower (~10-60s per doc) but understands columns, tables, and headings.
    """
    result = _converter.convert(str(path))
    doc    = result.document

    chunks: list[dict] = []
    for chunk in _chunker.chunk(doc):
        meta = chunk.meta

        page    = None
        section = None
        el_type = "text"

        if hasattr(meta, "doc_items") and meta.doc_items:
            first_item = meta.doc_items[0]

            if hasattr(first_item, "prov") and first_item.prov:
                page = first_item.prov[0].page_no

            if hasattr(meta, "headings") and meta.headings:
                section = " > ".join(meta.headings)

            if hasattr(first_item, "label"):
                el_type = first_item.label.value   # DocItemLabel enum → str

        text = chunk.text.strip()
        if not text:
            continue

        chunks.append({
            "text": text,
            "metadata": {
                "title":   title,
                "source":  str(path),
                "page":    page,
                "section": section,
                "type":    el_type,
            },
        })

    return chunks


# ── Plain text / Markdown ─────────────────────────────────────────────────────

def _chunk_text_file(path: Path, title: str) -> list[dict]:
    """Read a .txt or .md file and split it with the recursive chunker."""
    raw = path.read_text(encoding="utf-8", errors="replace")
    return parse_and_chunk_text(raw, title, source=str(path))