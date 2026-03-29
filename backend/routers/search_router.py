from fastapi import APIRouter

from schemas import DataResponse, SearchRequest
from services import search_service
from repositories import vector_repository

router = APIRouter(tags=["search"])


@router.post("/search")
def search(req: SearchRequest, session_id: str | None = None):
    col = (
        vector_repository.get_session_collection(session_id)
        if session_id
        else vector_repository.get_global_collection()
    )
    chunks = search_service.hybrid_search(req.query, col, top_k=req.top_k)
    return DataResponse(data={"query": req.query, "chunks": chunks})
