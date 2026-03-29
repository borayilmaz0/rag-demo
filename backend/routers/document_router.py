import os
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, UploadFile

from schemas import DataResponse, ErrorResponse, IngestRequest
from services import document_service
from repositories import state_repository

router = APIRouter(tags=["documents"])

DOCS_PATH = os.getenv("DOCS_PATH", "./docs")


@router.post("/ingest", status_code=201)
def ingest(req: IngestRequest, session_id: str | None = None, kb_id: str | None = None):
    doc_id        = str(uuid.uuid4())
    chunks_stored = document_service.run_ingest(
        req.source, req.title, req.is_file, session_id, doc_id, kb_id,
    )
    return DataResponse(data={
        "doc_id":        doc_id,
        "title":         req.title,
        "chunks_stored": chunks_stored,
    })


@router.post("/ingest/upload", status_code=202)
async def ingest_upload(
    background_tasks: BackgroundTasks,
    file:             UploadFile = File(...),
    session_id:       str | None = None,
    kb_id:            str | None = None,
):
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
        session_id=session_id,
        doc_id=doc_id,
        kb_id=kb_id,
    )
    return DataResponse(data={"job_id": job_id, "title": title})


@router.get("/ingest/jobs/{job_id}")
def get_ingest_job(job_id: str):
    job = state_repository.get_job(job_id)
    if job is None:
        raise ErrorResponse(status_code=404, detail=f"Job {job_id} not found.")
    return DataResponse(data=job)


@router.get("/documents")
def list_documents(session_id: str | None = None, kb_id: str | None = None):
    docs = document_service.list_documents(session_id, kb_id)
    return DataResponse(data={"documents": docs})


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, session_id: str | None = None, kb_id: str | None = None):
    chunks_deleted = document_service.delete_document(doc_id, session_id, kb_id)
    return DataResponse(data={"doc_id": doc_id, "chunks_deleted": chunks_deleted})
