"""Fill an empty database with a municipal queue worth looking at.

Everything written here is invented. It exists so the dashboard can be reviewed without
waiting for real travellers to drive over real potholes, and every row is reproducible
from the seed below.
"""

import argparse
import base64
import hashlib
import json
import os
import random
import sys
from datetime import UTC, datetime, timedelta

import psycopg

# Must match packages/secrets: $scrypt$N=..,r=..,p=..$<salt>$<key>, base64url, unpadded.
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 32
SALT_LENGTH = 16

DEMO_PASSWORD = "cityflow-demo"

TEAMS = [
    "North Zone Team",
    "Central Zone Team",
    "South Zone Team",
    "Emergency Road Team",
]

# email, display name, role, job title, team
STAFF = [
    ("head@blr.cityflow.example", "Asha Rao", "head", "Head of Road Maintenance", None),
    (
        "rajesh@blr.cityflow.example",
        "Rajesh Sharma",
        "employee",
        "Road Inspection Officer",
        "North Zone Team",
    ),
    (
        "amit@blr.cityflow.example",
        "Amit Verma",
        "employee",
        "Field Engineer",
        "Central Zone Team",
    ),
    (
        "priya@blr.cityflow.example",
        "Priya Singh",
        "employee",
        "Road Maintenance Officer",
        "South Zone Team",
    ),
    (
        "vikram@blr.cityflow.example",
        "Vikram Patel",
        "employee",
        "Field Supervisor",
        "Central Zone Team",
    ),
    (
        "neha@blr.cityflow.example",
        "Neha Tiwari",
        "employee",
        "Junior Engineer",
        "South Zone Team",
    ),
]

# The extract the engine loads, so seeded defects sit on roads that exist.
BENGALURU = (77.54, 12.91, 77.68, 13.03)

# BBMP divides Bengaluru into 198 numbered wards. No boundary set is loaded, so a ward
# here is a number drawn at random rather than the ward the point really falls in, and
# the dashboard says so where it shows the column.
WARD_COUNT = 198

RESOLUTION_NOTES = [
    "Filled and compacted. Surface level with the carriageway.",
    "Patched as a temporary measure; this stretch is due for resurfacing.",
    "Utility cut backfilled by the water board and reinstated.",
    "Edge break repaired and the shoulder rebuilt.",
    "Nothing found at the location. Likely a speed table reported as a defect.",
]

CONFIRMATION_THRESHOLD = 20


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def hash_secret(secret: str) -> str:
    salt = os.urandom(SALT_LENGTH)
    key = hashlib.scrypt(
        secret.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=KEY_LENGTH
    )
    return f"$scrypt$N={SCRYPT_N},r={SCRYPT_R},p={SCRYPT_P}${b64(salt)}${b64(key)}"


def evidence(rng: random.Random, severity: float) -> dict:
    """A plausible summary of what the phones that reported this defect recorded."""
    return {
        "peak_vertical_g": round(1.1 + severity * 2.4 + rng.uniform(-0.15, 0.15), 2),
        "z_axis_variance": round(0.05 + severity * 0.6, 3),
        "band_energy_8_20hz": round(severity * 100 + rng.uniform(-8, 8), 1),
        "sampling_hz": rng.choice([46, 48, 50]),
        "note": "Synthetic demo evidence from infra/seed_demo.py",
    }


def confirmations_for(rng: random.Random, severity: float) -> int:
    """
    How many independent travellers registered this defect.

    Heavy-tailed on purpose. Most holes are hit by a handful of people and a few on a
    main road are hit by hundreds, and a confirmation threshold only means anything
    against a spread like that: a distribution clustered around ten makes every
    threshold either catch everything or nothing.
    """
    drawn = rng.lognormvariate(2.3, 1.2) * (0.45 + severity)
    return min(400, 2 + int(drawn))


def seed_teams(cursor) -> dict[str, str]:
    ids: dict[str, str] = {}

    for name in TEAMS:
        cursor.execute(
            """
            INSERT INTO municipal_teams (city, name) VALUES ('BLR', %s)
            ON CONFLICT (city, name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (name,),
        )
        ids[name] = cursor.fetchone()[0]

    return ids


def seed_staff(cursor, teams: dict[str, str]) -> dict[str, str]:
    ids: dict[str, str] = {}

    for email, name, role, title, team in STAFF:
        cursor.execute(
            """
            INSERT INTO municipal_users
                (city, email, password_hash, display_name, role, job_title, team_id)
            VALUES ('BLR', %s, %s, %s, %s, %s, %s)
            ON CONFLICT (city, email) DO UPDATE
                SET display_name = EXCLUDED.display_name,
                    role = EXCLUDED.role,
                    job_title = EXCLUDED.job_title,
                    team_id = EXCLUDED.team_id
            RETURNING id
            """,
            (email, hash_secret(DEMO_PASSWORD), name, role, title, teams.get(team)),
        )
        ids[email] = cursor.fetchone()[0]

    return ids


def life_stage(rng, crew, team_ids, first_seen, now):
    """Where a defect has got to, who has it, and when it was closed."""
    roll = rng.random()

    if roll < 0.28:
        return "reported", None, None, None
    if roll < 0.40:
        return "triaged", None, None, None
    if roll < 0.50:
        return "assigned", rng.choice(crew), None, None
    if roll < 0.56:
        # Work goes to a crew as often as to a named person.
        return "assigned", None, rng.choice(team_ids), None
    if roll < 0.68:
        return "in_progress", rng.choice(crew), None, None
    if roll < 0.95:
        span = (now - first_seen).total_seconds()
        resolved = first_seen + timedelta(seconds=rng.uniform(0.2, 0.95) * span)
        return "resolved", rng.choice(crew), None, resolved

    return "rejected", None, None, None


def seed_defects(cursor, crew: list[str], team_ids: list[str], count: int, seed: int):
    rng = random.Random(seed)
    west, south, east, north = BENGALURU
    now = datetime.now(UTC)

    for _ in range(count):
        severity = round(min(0.99, max(0.05, rng.betavariate(2.2, 3.0))), 3)
        first_seen = now - timedelta(days=rng.randint(0, 120), hours=rng.randint(0, 23))

        status, assignee, team, resolved_at = life_stage(
            rng, crew, team_ids, first_seen, now
        )
        note = rng.choice(RESOLUTION_NOTES) if status == "resolved" else None

        # A defect stops being hit once it is fixed; an open one is still being hit.
        latest = resolved_at or now
        last_seen = first_seen + timedelta(
            seconds=rng.uniform(0, (latest - first_seen).total_seconds())
        )

        cursor.execute(
            """
            INSERT INTO defect_reports (
                city, location, severity, confirmations, evidence,
                status, assigned_to, assigned_team, ward,
                first_seen_at, last_seen_at, resolved_at, resolution_note, resolved_by
            ) VALUES (
                'BLR',
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                round(rng.uniform(west, east), 6),
                round(rng.uniform(south, north), 6),
                severity,
                confirmations_for(rng, severity),
                json.dumps(evidence(rng, severity)),
                status,
                assignee,
                team,
                rng.randint(1, WARD_COUNT),
                first_seen,
                last_seen,
                resolved_at,
                note,
                assignee if status == "resolved" else None,
            ),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--defects", type=int, default=180)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete this city's existing demo defects first",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    arguments = parser.parse_args()

    if not arguments.database_url:
        print("no database url: pass --database-url or set DATABASE_URL", file=sys.stderr)
        return 2

    with (
        psycopg.connect(arguments.database_url) as connection,
        connection.cursor() as cursor,
    ):
        if arguments.replace:
            cursor.execute("DELETE FROM defect_reports WHERE city = 'BLR'")
            print(f"Removed {cursor.rowcount} existing defects.", file=sys.stderr)

        cursor.execute("SELECT count(*) FROM defect_reports WHERE city = 'BLR'")
        if cursor.fetchone()[0] > 0:
            print(
                "BLR already has defect reports; nothing seeded. Pass --replace to "
                "start over.",
                file=sys.stderr,
            )
            return 1

        teams = seed_teams(cursor)
        staff = seed_staff(cursor, teams)
        crew = [staff[email] for email, _, role, _, _ in STAFF if role == "employee"]
        seed_defects(
            cursor, crew, list(teams.values()), arguments.defects, arguments.seed
        )

        cursor.execute(
            """
            INSERT INTO municipal_settings (city, confirmation_threshold, updated_by)
            VALUES ('BLR', %s, %s)
            ON CONFLICT (city) DO UPDATE
                SET confirmation_threshold = EXCLUDED.confirmation_threshold
            """,
            (CONFIRMATION_THRESHOLD, staff[STAFF[0][0]]),
        )
        connection.commit()

    print(
        f"Seeded {len(TEAMS)} teams, {len(STAFF)} staff accounts "
        f"and {arguments.defects} defects for BLR."
    )
    print(f"Sign in as {STAFF[0][0]} with password {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
