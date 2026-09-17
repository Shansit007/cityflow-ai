import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool

from app.logging import configure_logging
from app.network import NetworkCache
from app.routes import health, recommendations
from app.settings import get_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)

    # open=False keeps startup from blocking on a database that is still booting;
    # /health reports the pool as down until the first connection succeeds.
    pool = AsyncConnectionPool(settings.database_url, open=False, min_size=1, max_size=4)
    await pool.open()
    app.state.pool = pool
    # One graph per city, built on first request rather than at startup: the service
    # should come up and answer /health even when the network has never been loaded.
    app.state.networks = NetworkCache()
    logger.info("engine started", extra={"version": settings.version})

    try:
        yield
    finally:
        await pool.close()
        logger.info("engine stopped")


app = FastAPI(
    title="CityFlow AI engine",
    version=get_settings().version,
    summary="Capacity model, departure-slot allocation and travel-time prediction.",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(recommendations.router)
