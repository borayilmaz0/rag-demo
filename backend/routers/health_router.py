from fastapi import APIRouter

from schemas import DataResponse
from repositories import vector_repository

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    col = vector_repository.get_global_collection()
    return DataResponse(data={
        "status":     "ok",
        "collection": vector_repository.COLLECTION_NAME,
        "chunks":     col.count(),
    })
