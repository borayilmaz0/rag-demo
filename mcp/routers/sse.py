"""
routers/sse.py
--------------
SSE transport (GET /sse, POST /message) — legacy, for Claude Desktop.
"""

import json
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from dispatch import dispatch

router = APIRouter()


@router.get("/sse")
async def sse_endpoint(request: Request) -> StreamingResponse:
    async def event_stream() -> AsyncGenerator[str, None]:
        yield f"event: endpoint\ndata: {json.dumps({'uri': '/message'})}\n\n"
        while True:
            if await request.is_disconnected():
                break
            await asyncio.sleep(15)
            yield ": keepalive\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/message")
async def message_endpoint(request: Request):
    body = await request.json()
    response = await dispatch(body)

    async def stream():
        yield f"event: message\ndata: {json.dumps(response)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
