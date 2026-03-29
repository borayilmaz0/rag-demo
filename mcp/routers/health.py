"""
routers/health.py
-----------------
Health check endpoint.
"""

from fastapi import APIRouter

from config import TOOLS

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "tools": [t["name"] for t in TOOLS]}
