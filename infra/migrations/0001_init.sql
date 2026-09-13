CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE DOMAIN geohash_cell AS char(6)
    CHECK (VALUE ~ '^[0-9bcdefghjkmnpqrstuvwxyz]{6}$');

COMMENT ON DOMAIN geohash_cell IS
    'A six-character geohash. At Indian latitudes one cell spans roughly 1.2 km east-west '
    'by 0.6 km north-south. Every origin and destination in this schema uses this type and '
    'not a point: the exact address is resolved in the browser and never transmitted, so a '
    'database dump cannot place anyone at a doorstep. Enforced as a domain rather than a '
    'convention so that no later migration can quietly add a precise column.';

CREATE TABLE cities (
    code            char(3) PRIMARY KEY,
    name            text NOT NULL,
    centroid        geography(Point, 4326) NOT NULL,
    timezone        text NOT NULL DEFAULT 'Asia/Kolkata',
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cities IS
    'Cities the system is deployed for. Not in the original table list; added because every '
    'other table is scoped by city and a text column repeated nine times drifts.';

CREATE TABLE city_identities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id       text NOT NULL UNIQUE,
    recovery_hash   text NOT NULL,
    home_city       char(3) NOT NULL REFERENCES cities(code),
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT public_id_shape CHECK (public_id ~ '^[A-Z]{3}-[0-9A-Z]{4}-[0-9A-Z]{4}$')
);

COMMENT ON TABLE city_identities IS
    'The anonymous account. There is deliberately no name, email, phone or device column, '
    'and no place to add one without a migration that has to justify itself.';
COMMENT ON COLUMN city_identities.recovery_hash IS
    'Salted password hash (PHC string) of the recovery phrase. The phrase is generated in '
    'the browser and shown once; the server never sees it and cannot recover an account '
    'whose owner has lost it.';

CREATE TABLE road_segments (
    id              bigserial PRIMARY KEY,
    city            char(3) NOT NULL REFERENCES cities(code),
    osm_way_id      bigint NOT NULL,
    geom            geometry(LineString, 4326) NOT NULL,
    lanes           smallint NOT NULL CHECK (lanes > 0),
    length_m        numeric(9, 2) NOT NULL CHECK (length_m > 0),
    highway_class   text NOT NULL,
    capacity_vph    integer NOT NULL CHECK (capacity_vph > 0),

    UNIQUE (city, osm_way_id)
);

COMMENT ON COLUMN road_segments.capacity_vph IS
    'Vehicles per hour the segment can absorb. Derived, not measured: see docs/engine.md '
    'for the formula and its source.';

CREATE INDEX road_segments_geom_idx ON road_segments USING gist (geom);

CREATE TYPE travel_mode AS ENUM ('car', 'two_wheeler', 'bus', 'metro', 'walk', 'cycle');

CREATE TABLE routines (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id     uuid NOT NULL REFERENCES city_identities(id) ON DELETE CASCADE,
    label           text NOT NULL,
    origin_cell     geohash_cell NOT NULL,
    destination_cell geohash_cell NOT NULL,
    days_of_week    smallint[] NOT NULL,
    arrive_by       time NOT NULL,
    arrive_window_minutes smallint NOT NULL DEFAULT 15 CHECK (arrive_window_minutes >= 0),
    mode            travel_mode NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT days_of_week_valid
        CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_length(days_of_week, 1) > 0)
);

CREATE INDEX routines_identity_idx ON routines (identity_id);

CREATE TYPE trip_status AS ENUM ('planned', 'allocated', 'completed', 'cancelled');

CREATE TABLE trips (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id     uuid NOT NULL REFERENCES city_identities(id) ON DELETE CASCADE,
    routine_id      uuid REFERENCES routines(id) ON DELETE SET NULL,
    city            char(3) NOT NULL REFERENCES cities(code),
    origin_cell     geohash_cell NOT NULL,
    destination_cell geohash_cell NOT NULL,
    travel_date     date NOT NULL,
    arrive_by       timestamptz NOT NULL,
    arrive_window_minutes smallint NOT NULL DEFAULT 15 CHECK (arrive_window_minutes >= 0),
    mode            travel_mode NOT NULL,
    status          trip_status NOT NULL DEFAULT 'planned',
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN trips.routine_id IS
    'Null for an ad-hoc trip. Nulled rather than cascaded when a routine is deleted, so '
    'that deleting a routine does not erase the history the allocator learned from.';

CREATE INDEX trips_allocation_idx ON trips (city, travel_date, status);
CREATE INDEX trips_identity_idx ON trips (identity_id, travel_date);

CREATE TABLE departure_slots (
    segment_id      bigint NOT NULL REFERENCES road_segments(id) ON DELETE CASCADE,
    window_start    timestamptz NOT NULL,
    allocated       integer NOT NULL DEFAULT 0 CHECK (allocated >= 0),
    background_load integer NOT NULL DEFAULT 0 CHECK (background_load >= 0),
    capacity        integer NOT NULL CHECK (capacity > 0),

    PRIMARY KEY (segment_id, window_start),
    CONSTRAINT window_is_quarter_hour
        CHECK (date_part('minute', window_start AT TIME ZONE 'UTC') IN (0, 15, 30, 45)
               AND date_part('second', window_start AT TIME ZONE 'UTC') = 0)
);

COMMENT ON COLUMN departure_slots.background_load IS
    'Vehicles from people who do not use the app. The allocator treats this as fixed and '
    'places participants in what is left, rather than assuming it controls the whole road.';

CREATE TABLE recommendations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    depart_at           timestamptz NOT NULL,
    naive_depart_at     timestamptz NOT NULL,
    predicted_travel_seconds    integer NOT NULL CHECK (predicted_travel_seconds > 0),
    naive_travel_seconds        integer NOT NULL CHECK (naive_travel_seconds > 0),
    shift_minutes       integer NOT NULL,
    accepted            boolean,
    followed            boolean,
    created_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (trip_id)
);

COMMENT ON TABLE recommendations IS
    'Both the recommended and the counterfactual naive departure are stored, because the '
    'comparison is what the traveller is shown and what the evaluation measures.';
COMMENT ON COLUMN recommendations.accepted IS
    'Null until the traveller answers. Distinct from followed, which is whether they '
    'actually left at that time.';

CREATE TYPE defect_status AS ENUM ('reported', 'triaged', 'assigned', 'in_progress', 'resolved', 'rejected');
CREATE TYPE municipal_role AS ENUM ('head', 'employee');

CREATE TABLE municipal_users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city            char(3) NOT NULL REFERENCES cities(code),
    email           citext NOT NULL,
    password_hash   text NOT NULL,
    display_name    text NOT NULL,
    role            municipal_role NOT NULL,
    active          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (city, email)
);

COMMENT ON TABLE municipal_users IS
    'Named council staff, with email and password. The opposite of city_identities on '
    'purpose: accountability for someone acting in an official capacity, anonymity for a '
    'citizen going to work. docs/privacy.md sets out why the two differ.';

CREATE TABLE defect_reports (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city                char(3) NOT NULL REFERENCES cities(code),
    location            geography(Point, 4326) NOT NULL,
    segment_id          bigint REFERENCES road_segments(id) ON DELETE SET NULL,
    severity            numeric(4, 3) NOT NULL CHECK (severity BETWEEN 0 AND 1),
    confirmations       integer NOT NULL CHECK (confirmations >= 2),
    evidence            jsonb NOT NULL,
    status              defect_status NOT NULL DEFAULT 'reported',
    assigned_to         uuid REFERENCES municipal_users(id) ON DELETE SET NULL,
    first_seen_at       timestamptz NOT NULL,
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN defect_reports.location IS
    'An exact point, unlike every origin and destination in this schema. It describes a '
    'hole in a public road, is only created once several identities independently report '
    'the same place, and is not attributable to any of them.';
COMMENT ON COLUMN defect_reports.confirmations IS
    'Independent identities that registered the anomaly. The CHECK is the aggregation rule '
    'itself: a single report is not a defect, which is what keeps one bad phone mount and '
    'one speed bump out of the municipal queue.';

CREATE INDEX defect_reports_location_idx ON defect_reports USING gist (location);
CREATE INDEX defect_reports_queue_idx ON defect_reports (city, status, severity DESC);

CREATE TYPE points_source AS ENUM ('followed_recommendation', 'defect_confirmed', 'routine_kept', 'adjustment');

CREATE TABLE points_ledger (
    id              bigserial PRIMARY KEY,
    identity_id     uuid NOT NULL REFERENCES city_identities(id) ON DELETE CASCADE,
    points          integer NOT NULL,
    source          points_source NOT NULL,
    reference_id    uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE points_ledger IS
    'Append-only. A balance is the sum of the rows, never a stored figure, so a balance can '
    'always be explained by the entries that produced it. Rewards are a proposed model and '
    'are not redeemable anywhere.';

CREATE INDEX points_ledger_identity_idx ON points_ledger (identity_id, created_at DESC);
