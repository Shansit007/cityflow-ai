-- Readings stop being useful once they have been aggregated, and they are the only
-- rows in the traveller schema that place a City ID at an exact coordinate. Schedule
-- this; do not rely on remembering to run it.
--
--   psql "$DATABASE_URL" -f infra/prune_anomalies.sql
--
-- Unpromoted readings are kept for a fortnight so a second traveller has time to hit
-- the same hole. After that they are evidence of one person's journey and nothing else.

DELETE FROM road_anomalies
 WHERE promoted_at IS NOT NULL
    OR recorded_at < now() - interval '14 days';
