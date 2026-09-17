import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from psycopg import AsyncConnection
from psycopg.rows import tuple_row
from pydantic import BaseModel, Field

from app.network import UnknownCity, node_for_cell
from core.geohash import CELL_PRECISION, InvalidCell
from core.liveplan import Plan, Unroutable, plan, segment_key
from core.routing import Route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["planning"])

EXISTING = """
SELECT t.id, r.depart_at, r.naive_depart_at, r.predicted_travel_seconds,
       r.shift_minutes, r.overflow_at_plan, r.overflow_at_usual,
       r.roads_over_at_plan, r.roads_over_at_usual
FROM trips t
JOIN recommendations r ON r.trip_id = t.id
WHERE t.identity_id = %s AND t.travel_date = %s
  AND t.origin_cell = %s AND t.destination_cell = %s AND t.arrive_by = %s
LIMIT 1
"""

SLOTS = """
SELECT segment_id, window_start, allocated, background_load
FROM departure_slots
WHERE segment_id = ANY(%s) AND window_start >= %s AND window_start < %s
"""

INSERT_TRIP = """
INSERT INTO trips (
    identity_id, routine_id, city, origin_cell, destination_cell,
    travel_date, arrive_by, arrive_window_minutes, mode, status
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'allocated')
RETURNING id
"""

INSERT_RECOMMENDATION = """
INSERT INTO recommendations (
    trip_id, depart_at, naive_depart_at, predicted_travel_seconds,
    naive_travel_seconds, shift_minutes, overflow_at_plan, overflow_at_usual,
    roads_over_at_plan, roads_over_at_usual
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

CHARGE_SLOT = """
INSERT INTO departure_slots (
    segment_id, window_start, allocated, background_load, capacity
)
VALUES (%s, %s, 1, 0, %s)
ON CONFLICT (segment_id, window_start)
DO UPDATE SET allocated = departure_slots.allocated + 1
"""


class RecommendationRequest(BaseModel):
    city: str = Field(min_length=3, max_length=3)
    identity_id: str
    routine_id: str | None = None
    origin_cell: str = Field(min_length=CELL_PRECISION, max_length=CELL_PRECISION)
    destination_cell: str = Field(min_length=CELL_PRECISION, max_length=CELL_PRECISION)
    arrive_by: datetime
    arrive_window_minutes: int = Field(default=15, ge=0, le=120)
    mode: str = "car"


class Recommendation(BaseModel):
    depart_at: datetime
    naive_depart_at: datetime
    usual_depart_at: datetime
    travel_seconds: int
    shift_minutes: int
    overflow_at_plan: float
    overflow_at_usual: float
    roads_over_at_plan: int
    roads_over_at_usual: int
    # True when this request found a plan already made for the same journey today.
    # The ledger is charged once, so asking twice must not cost the road twice.
    existing: bool


@router.post("", response_model=Recommendation)
async def recommend(request: Request, body: RecommendationRequest) -> Recommendation:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="The engine has no database.")

    arrive_by = body.arrive_by.astimezone(UTC)

    async with pool.connection() as connection:
        found = await _existing(connection, body, arrive_by)
        if found is not None:
            return found

        route = await _route(request, connection, body)
        made = await _make(request, connection, body, arrive_by, route)

    return made


async def _existing(
    connection: AsyncConnection, body: RecommendationRequest, arrive_by: datetime
) -> Recommendation | None:
    async with connection.cursor(row_factory=tuple_row) as cursor:
        await cursor.execute(
            EXISTING,
            (
                body.identity_id,
                arrive_by.date(),
                body.origin_cell,
                body.destination_cell,
                arrive_by,
            ),
        )
        row = await cursor.fetchone()

    if row is None:
        return None

    (
        _,
        depart_at,
        naive_depart_at,
        travel_seconds,
        shift_minutes,
        at_plan,
        at_usual,
        roads_at_plan,
        roads_at_usual,
    ) = row
    return Recommendation(
        depart_at=depart_at,
        naive_depart_at=naive_depart_at,
        usual_depart_at=datetime.fromtimestamp(
            arrive_by.timestamp() - travel_seconds, tz=UTC
        ),
        travel_seconds=travel_seconds,
        shift_minutes=shift_minutes,
        overflow_at_plan=float(at_plan),
        overflow_at_usual=float(at_usual),
        roads_over_at_plan=roads_at_plan,
        roads_over_at_usual=roads_at_usual,
        existing=True,
    )


async def _route(
    request: Request, connection: AsyncConnection, body: RecommendationRequest
) -> Route:
    try:
        origin = await node_for_cell(connection, body.city, body.origin_cell)
        destination = await node_for_cell(connection, body.city, body.destination_cell)
    except InvalidCell as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    if origin is None or destination is None:
        raise HTTPException(
            status_code=404, detail=f"No road network loaded for {body.city}."
        )
    if origin == destination:
        raise HTTPException(
            status_code=422,
            detail="Origin and destination fall on the same point of the network.",
        )

    try:
        network = await request.app.state.networks.get(connection, body.city)
    except UnknownCity as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    found = network.graph.route(origin, destination)
    if found is None or not found.segment_ids:
        raise HTTPException(
            status_code=422,
            detail="No drivable route between those cells in the loaded network.",
        )
    return found


async def _make(
    request: Request,
    connection: AsyncConnection,
    body: RecommendationRequest,
    arrive_by: datetime,
    route: Route,
) -> Recommendation:
    network = await request.app.state.networks.get(connection, body.city)

    # Wide enough to cover every candidate departure and the whole journey after it.
    window_from = arrive_by.timestamp() - route.duration_s * 2
    window_to = arrive_by.timestamp() + route.duration_s
    background: dict[tuple[str, int], int] = {}
    committed: dict[tuple[str, int], int] = {}

    async with connection.cursor(row_factory=tuple_row) as cursor:
        await cursor.execute(
            SLOTS,
            (
                list(route.segment_ids),
                datetime.fromtimestamp(window_from, tz=UTC),
                datetime.fromtimestamp(window_to, tz=UTC),
            ),
        )
        rows = await cursor.fetchall()

    for segment_id, window_start, allocated, background_load in rows:
        index = int(window_start.timestamp()) // 900
        key = (segment_key(segment_id), index)
        background[key] = background_load
        if allocated:
            committed[key] = allocated

    try:
        made = plan(
            route,
            arrive_by,
            body.arrive_window_minutes,
            network.capacity_vph,
            background=background,
            committed=committed,
            identity=body.identity_id,
        )
    except Unroutable as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    await _persist(connection, body, arrive_by, route, made, network.capacity_vph)

    return Recommendation(
        depart_at=made.depart_at,
        naive_depart_at=made.naive_depart_at,
        usual_depart_at=made.usual_depart_at,
        travel_seconds=made.travel_seconds,
        shift_minutes=made.shift_minutes,
        overflow_at_plan=made.overflow_at_plan,
        overflow_at_usual=made.overflow_at_usual,
        roads_over_at_plan=made.roads_over_at_plan,
        roads_over_at_usual=made.roads_over_at_usual,
        existing=False,
    )


async def _persist(
    connection: AsyncConnection,
    body: RecommendationRequest,
    arrive_by: datetime,
    route: Route,
    made: Plan,
    capacity_vph: dict[str, int],
) -> None:
    """
    The trip, its recommendation and the load it puts on the road, in one transaction.

    Charging the ledger is not bookkeeping: it is what makes the next traveller's plan
    account for this one. A recommendation that was returned but not charged is exactly
    the naive design this project exists to argue against.
    """
    async with (
        connection.transaction(),
        connection.cursor(row_factory=tuple_row) as cursor,
    ):
        await cursor.execute(
            INSERT_TRIP,
            (
                body.identity_id,
                body.routine_id,
                body.city,
                body.origin_cell,
                body.destination_cell,
                arrive_by.date(),
                arrive_by,
                body.arrive_window_minutes,
                body.mode,
            ),
        )
        row = await cursor.fetchone()
        trip_id = row[0]

        await cursor.execute(
            INSERT_RECOMMENDATION,
            (
                trip_id,
                made.depart_at,
                made.naive_depart_at,
                made.travel_seconds,
                # Free-flow routing gives one duration, so the naive alternative takes
                # the same time by construction. Stored rather than left null because a
                # column that is sometimes absent is worse than one that is honestly
                # equal, and phase 2c is what will make them differ.
                made.travel_seconds,
                made.shift_minutes,
                made.overflow_at_plan,
                made.overflow_at_usual,
                made.roads_over_at_plan,
                made.roads_over_at_usual,
            ),
        )

        for charge in made.charges:
            await cursor.execute(
                CHARGE_SLOT,
                (
                    charge.segment_id,
                    charge.window_start,
                    capacity_vph.get(segment_key(charge.segment_id), 1),
                ),
            )

    logger.info(
        "recommendation made",
        extra={
            "city": body.city,
            "segments": len(route.segment_ids),
            "shift_minutes": made.shift_minutes,
            "overflow_avoided": round(made.overflow_at_usual - made.overflow_at_plan, 2),
        },
    )
