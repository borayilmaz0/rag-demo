"""
routers/kb_router.py
---------------------
Knowledge Base CRUD endpoints.

Read operations (list, get, list documents) are open.
Write operations (create, ingest, delete document, delete KB) require the
X-Write-Token header matching the token issued at KB creation time.
"""

import uuid

from fastapi import APIRouter, BackgroundTasks, Header, File, UploadFile
from typing import Annotated
import os
from pathlib import Path

from schemas import CreateKBRequest, DataResponse, ErrorResponse, IngestRequest
from services import document_service
from repositories import kb_repository, vector_repository, state_repository

router = APIRouter(prefix="/kb", tags=["knowledge-bases"])

DOCS_PATH = os.getenv("DOCS_PATH", "./docs")


# ── Auth dependency ───────────────────────────────────────────────────────────

def _require_write(kb_id: str, x_write_token: str | None) -> None:
    if not x_write_token:
        raise ErrorResponse(status_code=401, detail="X-Write-Token header is required.")
    if not kb_repository.verify_write_token(kb_id, x_write_token):
        raise ErrorResponse(status_code=403, detail="Invalid write token for this knowledge base.")


# ── KB CRUD ───────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def create_kb(req: CreateKBRequest):
    try:
        kb = kb_repository.create(req.name, req.description)
    except ValueError as e:
        raise ErrorResponse(status_code=409, detail=str(e))
    # Eagerly create the ChromaDB collection so it exists immediately
    vector_repository.get_kb_collection(kb["chroma_collection"])
    return DataResponse(data=kb)


@router.get("/")
def list_kbs():
    kbs = kb_repository.list_all()
    return DataResponse(data={"knowledge_bases": kbs})


@router.get("/{kb_id}")
def get_kb(kb_id: str):
    kb = kb_repository.get(kb_id)
    if kb is None:
        raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
    docs = document_service.list_documents(session_id=None, kb_id=kb_id)
    return DataResponse(data={**kb, "documents": docs})


@router.delete("/{kb_id}")
def delete_kb(
    kb_id: str,
    x_write_token: Annotated[str | None, Header()] = None,
):
    _require_write(kb_id, x_write_token)
    kb = kb_repository.get(kb_id)
    if kb is None:
        raise ErrorResponse(status_code=404, detail=f"Knowledge base {kb_id} not found.")
    vector_repository.delete_collection(kb["chroma_collection"])
    kb_repository.delete(kb_id)
    return DataResponse(data={"kb_id": kb_id, "deleted": True})


# ── Document management ───────────────────────────────────────────────────────

@router.post("/{kb_id}/ingest", status_code=201)
def ingest_into_kb(
    kb_id: str,
    req: IngestRequest,
    x_write_token: Annotated[str | None, Header()] = None,
):
    _require_write(kb_id, x_write_token)
    doc_id        = str(uuid.uuid4())
    chunks_stored = document_service.run_ingest(
        req.source, req.title, req.is_file, session_id=None, doc_id=doc_id, kb_id=kb_id,
    )
    return DataResponse(data={"doc_id": doc_id, "title": req.title, "chunks_stored": chunks_stored})


@router.post("/{kb_id}/ingest/upload", status_code=202)
async def ingest_upload_into_kb(
    kb_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_write_token: Annotated[str | None, Header()] = None,
):
    _require_write(kb_id, x_write_token)

    dest = Path(DOCS_PATH) / file.filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(await file.read())

    job_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    title  = file.filename

    state_repository.set_job(job_id, {
        "job_id":        job_id,
        "doc_id":        None,
        "title":         title,
        "status":        "pending",
        "chunks_stored": 0,
        "error":         None,
    })

    background_tasks.add_task(
        document_service.run_ingest_background,
        job_id=job_id,
        source=str(dest),
        title=title,
        is_file=True,
        session_id=None,
        doc_id=doc_id,
        kb_id=kb_id,
    )
    return DataResponse(data={"job_id": job_id, "title": title})


@router.get("/{kb_id}/documents")
def list_kb_documents(kb_id: str):
    docs = document_service.list_documents(session_id=None, kb_id=kb_id)
    return DataResponse(data={"documents": docs})


@router.delete("/{kb_id}/documents/{doc_id}")
def delete_kb_document(
    kb_id: str,
    doc_id: str,
    x_write_token: Annotated[str | None, Header()] = None,
):
    _require_write(kb_id, x_write_token)
    chunks_deleted = document_service.delete_document(doc_id, session_id=None, kb_id=kb_id)
    return DataResponse(data={"doc_id": doc_id, "chunks_deleted": chunks_deleted})
