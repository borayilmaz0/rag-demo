"""
routers/mcp.py
--------------
Streamable HTTP transport (POST /mcp) — preferred for Claude Code.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from dispatch import dispatch

router = APIRouter()


@router.post("/mcp")
async def http_endpoint(request: Request) -> JSONResponse:
    body = await request.json()
    response = await dispatch(body)
    return JSONResponse(response)
