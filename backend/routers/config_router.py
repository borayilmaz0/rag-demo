from fastapi import APIRouter

from config import CFG
from prompts import list_modes
from schemas import DataResponse

router = APIRouter(tags=["config"])


@router.get("/config")
def get_config():
    return DataResponse(data={
        "models": [
            {"id": m.id, "label": m.label, "model": m.model}
            for m in CFG.models
        ],
        "embedding": {
            "model":    CFG.embedding.model,
            "base_url": CFG.embedding.base_url,
        },
        "modes": list_modes(),
    })


@router.get("/modes")
def get_modes():
    return DataResponse(data={"modes": list_modes()})
