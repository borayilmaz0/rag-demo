from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import CFG
from prompts import Mode, register_mode
from schemas import ErrorResponse

from repositories import vector_repository, kb_repository
from services import llm_service, search_service, rerank_service

from routers import (
    config_router,
    document_router,
    health_router,
    kb_router,
    search_router,
    session_router,
)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register custom modes from config before anything else
    for cm in CFG.modes:
        register_mode(Mode(
            id=cm.id,
            label=cm.label,
            description=cm.description,
            system=cm.system,
            force_search=cm.force_search,
        ))

    # Initialize singletons in dependency order
    kb_repository.init()
    vector_repository.init(
        host=os.getenv("CHROMA_HOST", "localhost"),
        port=int(os.getenv("CHROMA_PORT", "8000")),
    )
    llm_service.init()
    search_service.init()
    rerank_service.init()

    yield
    # Shutdown: in-memory stores need no cleanup


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="RAG Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception handler ─────────────────────────────────────────────────────────

@app.exception_handler(ErrorResponse)
async def handle_error_response(request: Request, exc: ErrorResponse) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(config_router.router)
app.include_router(document_router.router)
app.include_router(kb_router.router)
app.include_router(session_router.router)
app.include_router(search_router.router)
app.include_router(health_router.router)
