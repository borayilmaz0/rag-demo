"""
services/llm_service.py
-----------------------
Manages the per-model AsyncOpenAI client pool and exposes a single
call_llm() entry point for all LLM requests.
Call init() once from the app lifespan.
"""

from __future__ import annotations

from openai import AsyncOpenAI

from config import CFG
from schemas import ErrorResponse

_clients: dict[str, AsyncOpenAI] = {}


# ── Lifecycle ─────────────────────────────────────────────────────────────────

def init() -> None:
    global _clients
    _clients = {
        m.id: AsyncOpenAI(base_url=m.base_url, api_key=m.api_key)
        for m in CFG.models
    }


# ── LLM call ─────────────────────────────────────────────────────────────────

async def call_llm(
    messages:      list[dict],
    system_prompt: str,
    model_id:      str,
) -> str:
    model_cfg = CFG.get_model(model_id)
    if model_cfg is None:
        raise ErrorResponse(status_code=400, detail=f"Unknown model id: '{model_id}'")

    client        = _clients[model_id]
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    response = await client.chat.completions.create(
        model=model_cfg.model,
        messages=full_messages,
    )
    return response.choices[0].message.content.strip()
