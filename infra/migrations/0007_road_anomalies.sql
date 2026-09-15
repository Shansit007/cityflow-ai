-- One phone deciding the road was bad is not a defect. It is a reading, and readings
-- are attributable in a way the rest of the traveller schema deliberately is not: this
-- table holds an exact coordinate next to a City ID, which together say where somebody
-- was at a moment. That is the price of the feature, it is paid only until the reading
-- has been aggregated, and docs/privacy.md states it plainly rather than burying it.

CREATE TABLE road_anomalies (
    id              bigserial PRIMARY KEY,
    city            char(3) NOT NULL REFERENCES cities(code),
    identity_id     uuid NOT NULL REFERENCES city_identities(id) ON DELETE CASCADE,
    location        geography(Point, 4326) NOT NULL,
    magnitude       numeric(4, 3) NOT NULL CHECK (magnitude BETWEEN 0 AND 1),
    features        jsonb NOT NULL,
    recorded_at     timestamptz NOT NULL,
    promoted_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE road_anomalies IS
    'Raw detections from one traveller''s phone. Short-lived by design: once promoted
     into a defect_report the reading has done its job, and infra/prune_anomalies.sql
     deletes it. Deleting a City ID cascades here, which is the one place in this schema
     where a traveller has anything to erase.';

COMMENT ON COLUMN road_anomalies.location IS
    'An exact point, not a geohash cell, because a pothole has to be findable by a
     repair crew. It is also the most identifying column in the traveller schema, which
     is why rows here do not outlive their aggregation.';

CREATE INDEX road_anomalies_location_idx ON road_anomalies USING gist (location);
CREATE INDEX road_anomalies_pending_idx ON road_anomalies (city, promoted_at)
    WHERE promoted_at IS NULL;

-- Roughly 20 m in degrees at Indian latitudes. Clustering is done on the geometry cast
-- rather than the geography because ST_ClusterDBSCAN takes a planar epsilon; over 20 m
-- near 13 degrees north the distortion is under a metre, which is well inside the GPS
-- error this is clustering in the first place.
CREATE OR REPLACE FUNCTION promote_anomalies(target_city char(3))
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    cluster_eps    constant double precision := 0.00018;
    merge_radius_m constant double precision := 25;
    created        integer := 0;
    candidate      record;
    existing       uuid;
BEGIN
    FOR candidate IN
        WITH clustered AS (
            SELECT id, identity_id, location, magnitude, recorded_at,
                   ST_ClusterDBSCAN(
                       location::geometry, eps := cluster_eps, minpoints := 2
                   ) OVER () AS cluster
              FROM road_anomalies
             WHERE city = target_city AND promoted_at IS NULL
        )
        SELECT cluster,
               count(DISTINCT identity_id)      AS identities,
               count(*)                         AS readings,
               ST_Centroid(ST_Collect(location::geometry))::geography AS centre,
               avg(magnitude)                   AS mean_magnitude,
               max(magnitude)                   AS peak_magnitude,
               min(recorded_at)                 AS first_seen,
               array_agg(id)                    AS anomaly_ids
          FROM clustered
         WHERE cluster IS NOT NULL
         GROUP BY cluster
        -- The aggregation rule itself: independent identities, not readings. One
        -- traveller driving the same street twice a day is one opinion about it.
        HAVING count(DISTINCT identity_id) >= 2
    LOOP
        SELECT d.id INTO existing
          FROM defect_reports d
         WHERE d.city = target_city
           AND d.status NOT IN ('resolved', 'rejected')
           AND ST_DWithin(d.location, candidate.centre, merge_radius_m)
         ORDER BY ST_Distance(d.location, candidate.centre)
         LIMIT 1;

        IF existing IS NULL THEN
            INSERT INTO defect_reports (
                city, location, severity, confirmations, evidence, status, first_seen_at
            ) VALUES (
                target_city,
                candidate.centre,
                round(candidate.mean_magnitude, 3),
                candidate.identities,
                jsonb_build_object(
                    'readings', candidate.readings,
                    'independent_identities', candidate.identities,
                    'mean_magnitude', round(candidate.mean_magnitude, 3),
                    'peak_magnitude', round(candidate.peak_magnitude, 3),
                    'detector', 'threshold-v1'
                ),
                'reported',
                candidate.first_seen
            );
            created := created + 1;
        ELSE
            -- More people hitting a hole already in the queue makes it more certain and
            -- can make it worse, but never less severe than it was already measured.
            UPDATE defect_reports
               SET confirmations = confirmations + candidate.identities,
                   severity = greatest(severity, round(candidate.mean_magnitude, 3))
             WHERE id = existing;
        END IF;

        UPDATE road_anomalies
           SET promoted_at = now()
         WHERE id = ANY(candidate.anomaly_ids);
    END LOOP;

    RETURN created;
END;
$$;

COMMENT ON FUNCTION promote_anomalies(char(3)) IS
    'Turns clusters of independent readings into defect reports. Called after a batch of
     anomalies is submitted, and safe to call repeatedly: a reading is marked promoted
     and never counted twice.';
