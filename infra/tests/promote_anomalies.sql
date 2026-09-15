-- Exercises the aggregation rule against a real PostGIS, inside a transaction that is
-- rolled back. The rule this checks -- several independent identities before anything
-- reaches the municipal queue -- is the one claim the defect feature rests on, and it
-- lives in SQL, so testing it anywhere else would test something different.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/tests/promote_anomalies.sql

BEGIN;

-- Seeded demo defects would otherwise sit within merge range of the fixtures and make
-- the result depend on which database this runs against. Rolled back with everything.
DELETE FROM defect_reports WHERE city = 'BLR';
DELETE FROM road_anomalies WHERE city = 'BLR';

INSERT INTO city_identities (id, public_id, recovery_hash, home_city) VALUES
    ('00000000-0000-0000-0000-000000000001', 'BLR-TEST-AAAA', 'x', 'BLR'),
    ('00000000-0000-0000-0000-000000000002', 'BLR-TEST-BBBB', 'x', 'BLR');

-- Two identities at one place, and one identity on its own a kilometre away.
INSERT INTO road_anomalies (city, identity_id, location, magnitude, features, recorded_at)
VALUES
    ('BLR', '00000000-0000-0000-0000-000000000001',
     ST_SetSRID(ST_MakePoint(77.59460, 12.97160), 4326)::geography,
     0.700, '{}'::jsonb, now() - interval '2 hours'),
    ('BLR', '00000000-0000-0000-0000-000000000002',
     ST_SetSRID(ST_MakePoint(77.59468, 12.97164), 4326)::geography,
     0.800, '{}'::jsonb, now() - interval '1 hour'),
    ('BLR', '00000000-0000-0000-0000-000000000001',
     ST_SetSRID(ST_MakePoint(77.60500, 12.98000), 4326)::geography,
     0.900, '{}'::jsonb, now() - interval '3 hours');

DO $$
DECLARE
    created integer;
    defects integer;
    confirmations integer;
    severity numeric;
    lonely integer;
BEGIN
    created := promote_anomalies('BLR');

    SELECT count(*) INTO defects FROM defect_reports WHERE city = 'BLR';
    IF created <> 1 OR defects <> 1 THEN
        RAISE EXCEPTION
            'two identities at one place should make one defect, got % created, % rows',
            created, defects;
    END IF;

    SELECT d.confirmations, d.severity INTO confirmations, severity
      FROM defect_reports d WHERE d.city = 'BLR';
    IF confirmations <> 2 THEN
        RAISE EXCEPTION 'confirmations counts identities, expected 2, got %', confirmations;
    END IF;
    IF severity <> round((0.700 + 0.800) / 2, 3) THEN
        RAISE EXCEPTION 'severity should be the mean magnitude, got %', severity;
    END IF;

    -- The unwitnessed reading is the whole point of the rule: one phone is not a defect.
    SELECT count(*) INTO lonely
      FROM road_anomalies WHERE city = 'BLR' AND promoted_at IS NULL;
    IF lonely <> 1 THEN
        RAISE EXCEPTION 'the single-identity reading should stay unpromoted, % pending', lonely;
    END IF;

    -- Calling it again must not double-count anything already promoted.
    created := promote_anomalies('BLR');
    SELECT count(*) INTO defects FROM defect_reports WHERE city = 'BLR';
    IF created <> 0 OR defects <> 1 THEN
        RAISE EXCEPTION 'a second run created % more defects', created;
    END IF;
END;
$$;

-- The same hole hit again by both travellers a week later.
INSERT INTO road_anomalies (city, identity_id, location, magnitude, features, recorded_at)
VALUES
    ('BLR', '00000000-0000-0000-0000-000000000001',
     ST_SetSRID(ST_MakePoint(77.59462, 12.97162), 4326)::geography,
     0.950, '{}'::jsonb, now()),
    ('BLR', '00000000-0000-0000-0000-000000000002',
     ST_SetSRID(ST_MakePoint(77.59464, 12.97158), 4326)::geography,
     0.910, '{}'::jsonb, now());

DO $$
DECLARE
    created integer;
    defects integer;
    confirmations integer;
    severity numeric;
BEGIN
    created := promote_anomalies('BLR');

    SELECT count(*) INTO defects FROM defect_reports WHERE city = 'BLR';
    IF created <> 0 OR defects <> 1 THEN
        RAISE EXCEPTION 'a nearby cluster should join the existing defect, not add one';
    END IF;

    SELECT d.confirmations, d.severity INTO confirmations, severity
      FROM defect_reports d WHERE d.city = 'BLR';
    IF confirmations <> 4 THEN
        RAISE EXCEPTION 'confirmations should have risen to 4, got %', confirmations;
    END IF;
    IF severity <> 0.930 THEN
        RAISE EXCEPTION 'severity should rise to the new mean 0.930, got %', severity;
    END IF;

    -- first_seen_at anchors time-to-resolve and must not move; last_seen_at must.
    IF (SELECT last_seen_at <= first_seen_at FROM defect_reports WHERE city = 'BLR') THEN
        RAISE EXCEPTION 'a later sighting should advance last_seen_at only';
    END IF;
END;
$$;

-- A resolved defect does not absorb new reports: the hole came back, and that is a new
-- defect with its own clock, not an edit to the row saying the old one was fixed.
UPDATE defect_reports
   SET status = 'resolved', resolved_at = now(), resolution_note = 'Filled.'
 WHERE city = 'BLR';

INSERT INTO road_anomalies (city, identity_id, location, magnitude, features, recorded_at)
VALUES
    ('BLR', '00000000-0000-0000-0000-000000000001',
     ST_SetSRID(ST_MakePoint(77.59461, 12.97161), 4326)::geography,
     0.600, '{}'::jsonb, now()),
    ('BLR', '00000000-0000-0000-0000-000000000002',
     ST_SetSRID(ST_MakePoint(77.59463, 12.97159), 4326)::geography,
     0.640, '{}'::jsonb, now());

DO $$
DECLARE
    created integer;
    defects integer;
BEGIN
    created := promote_anomalies('BLR');
    SELECT count(*) INTO defects FROM defect_reports WHERE city = 'BLR';

    IF created <> 1 OR defects <> 2 THEN
        RAISE EXCEPTION 'a reappearing defect should open a new report, got % created', created;
    END IF;
END;
$$;

ROLLBACK;
