import logging
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    database: Literal["up", "down"]


@router.get("/health", response_model=Health, tags=["ops"])
async def health(request: Request) -> Health:
    database = await _database_state(request)

    return Health(
        status="ok" if database == "up" else "degraded",
        version=get_settings().version,
        database=database,
    )


async def _database_state(request: Request) -> Literal["up", "down"]:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        return "down"

    try:
        async with pool.connection() as connection:
            await connection.execute("SELECT 1")
        return "up"
    except Exception:
        # Health must answer even when the database is unreachable, so the failure
        # is logged and reported rather than raised.
        logger.warning("health check could not reach the database", exc_info=True)
        return "down"
