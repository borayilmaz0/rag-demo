import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from schemas import (
    AskRequest,
    CreateSessionRequest,
    DataResponse,
    ExportToKbRequest,
    SwitchModeRequest,
    SwitchModelRequest,
    ToggleRequest,
)
from services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", status_code=201)
def create_session(req: CreateSessionRequest):
    return DataResponse(data=session_service.create(req.mode_id, req.model_id, req.kb_ids))


@router.get("/{session_id}")
def get_session(session_id: str):
    return DataResponse(data=session_service.get_state(session_id))


@router.patch("/{session_id}/mode")
def switch_mode(session_id: str, req: SwitchModeRequest):
    return DataResponse(data=session_service.switch_mode(session_id, req.mode_id))


@router.patch("/{session_id}/model")
def switch_model(session_id: str, req: SwitchModelRequest):
    return DataResponse(data=session_service.switch_model(session_id, req.model_id))


@router.delete("/{session_id}")
def delete_session(session_id: str):
    return DataResponse(data=session_service.delete(session_id))


# ── KB attachment management ──────────────────────────────────────────────────

@router.post("/{session_id}/kbs/{kb_id}", status_code=201)
def attach_kb(session_id: str, kb_id: str):
    return DataResponse(data=session_service.attach_kb(session_id, kb_id))


@router.delete("/{session_id}/kbs/{kb_id}")
def detach_kb(session_id: str, kb_id: str):
    return DataResponse(data=session_service.detach_kb(session_id, kb_id))


@router.patch("/{session_id}/kbs/{kb_id}/toggle")
def toggle_kb(session_id: str, kb_id: str, req: ToggleRequest):
    return DataResponse(data=session_service.toggle_kb(session_id, kb_id, req.enabled))


# ── Document toggle ───────────────────────────────────────────────────────────

@router.patch("/{session_id}/docs/{doc_id}/toggle")
def toggle_doc(session_id: str, doc_id: str, req: ToggleRequest):
    return DataResponse(data=session_service.toggle_doc(session_id, doc_id, req.enabled))


# ── Export ────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/export-to-kb", status_code=201)
def export_to_kb(session_id: str, req: ExportToKbRequest):
    return DataResponse(data=session_service.export_to_kb(session_id, req.name, req.description))


# ── Q&A ───────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/ask")
async def ask(session_id: str, req: AskRequest):
    result = await session_service.ask(
        session_id=session_id,
        message=req.message,
        search_enabled=req.search_enabled,
        top_k=req.top_k,
    )
    return DataResponse(data=result)


@router.post("/{session_id}/ask/stream")
async def ask_stream(session_id: str, req: AskRequest):
    async def generate():
        async for event in session_service.ask_stream(
            session_id=session_id,
            message=req.message,
            search_enabled=req.search_enabled,
            top_k=req.top_k,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
