"""Fill an empty database with a municipal queue worth looking at.

Everything written here is invented. It exists so the dashboard can be reviewed
without waiting for real travellers to drive over real potholes, and every row is
reproducible from the seed below.
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

STAFF = [
    ("head@blr.cityflow.example", "Asha Rao", "head"),
    ("crew1@blr.cityflow.example", "Vikram Shetty", "employee"),
    ("crew2@blr.cityflow.example", "Nadia Fernandes", "employee"),
    ("crew3@blr.cityflow.example", "Joseph Mathew", "employee"),
]

# The extract the engine loads, so seeded defects sit on roads that exist.
BENGALURU = (77.54, 12.91, 77.68, 13.03)


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


def seed_staff(cursor) -> dict[str, str]:
    ids: dict[str, str] = {}

    for email, name, role in STAFF:
        cursor.execute(
            """
            INSERT INTO municipal_users (city, email, password_hash, display_name, role)
            VALUES ('BLR', %s, %s, %s, %s)
            ON CONFLICT (city, email) DO UPDATE
                SET display_name = EXCLUDED.display_name, role = EXCLUDED.role
            RETURNING id
            """,
            (email, hash_secret(DEMO_PASSWORD), name, role),
        )
        ids[email] = cursor.fetchone()[0]

    return ids


def seed_defects(cursor, crew: list[str], count: int, seed: int) -> None:
    rng = random.Random(seed)
    west, south, east, north = BENGALURU
    now = datetime.now(UTC)

    for _ in range(count):
        severity = round(min(0.99, max(0.05, rng.betavariate(2.2, 3.0))), 3)
        first_seen = now - timedelta(days=rng.randint(0, 120), hours=rng.randint(0, 23))

        # A severe defect is confirmed by more people because more people hit it, and
        # the aggregation rule needs at least two independent reports either way.
        confirmations = 2 + int(rng.betavariate(1.6, 3.0) * 14 * (0.4 + severity))

        status, assignee, resolved_at = life_stage(rng, crew, first_seen, now)

        cursor.execute(
            """
            INSERT INTO defect_reports (
                city, location, severity, confirmations, evidence,
                status, assigned_to, first_seen_at, resolved_at
            ) VALUES (
                'BLR',
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                round(rng.uniform(west, east), 6),
                round(rng.uniform(south, north), 6),
                severity,
                confirmations,
                json.dumps(evidence(rng, severity)),
                status,
                assignee,
                first_seen,
                resolved_at,
            ),
        )


def life_stage(rng, crew, first_seen, now):
    """Where a defect has got to, and who has it."""
    roll = rng.random()

    if roll < 0.28:
        return "reported", None, None
    if roll < 0.40:
        return "triaged", None, None
    if roll < 0.55:
        return "assigned", rng.choice(crew), None
    if roll < 0.68:
        return "in_progress", rng.choice(crew), None
    if roll < 0.95:
        span = (now - first_seen).total_seconds()
        resolved = first_seen + timedelta(seconds=rng.uniform(0.2, 0.95) * span)
        return "resolved", rng.choice(crew), resolved

    return "rejected", None, None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--defects", type=int, default=180)
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
        cursor.execute("SELECT count(*) FROM defect_reports WHERE city = 'BLR'")
        if cursor.fetchone()[0] > 0:
            print("BLR already has defect reports; nothing seeded.", file=sys.stderr)
            return 1

        staff = seed_staff(cursor)
        crew = [staff[email] for email, _, role in STAFF if role == "employee"]
        seed_defects(cursor, crew, arguments.defects, arguments.seed)

        cursor.execute(
            """
            INSERT INTO municipal_settings (city, priority_threshold, updated_by)
            VALUES ('BLR', 0.600, %s)
            ON CONFLICT (city) DO NOTHING
            """,
            (staff[STAFF[0][0]],),
        )
        connection.commit()

    print(f"Seeded {len(STAFF)} staff accounts and {arguments.defects} defects for BLR.")
    print(f"Sign in as {STAFF[0][0]} with password {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
