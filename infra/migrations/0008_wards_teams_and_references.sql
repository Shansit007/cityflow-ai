-- The municipal dashboard needs four things the queue did not have: a report number a
-- crew can read out over a radio, the ward a defect falls in, when it was last hit, and
-- somewhere to assign work other than one named person.

CREATE SEQUENCE defect_reference_seq;

ALTER TABLE defect_reports
    ADD COLUMN reference text NOT NULL DEFAULT (
        'PTH-' || to_char(now(), 'YYYY') || '-' ||
        lpad(nextval('defect_reference_seq')::text, 5, '0')
    ),
    ADD COLUMN ward smallint CHECK (ward > 0),
    ADD COLUMN last_seen_at timestamptz;

UPDATE defect_reports SET last_seen_at = first_seen_at WHERE last_seen_at IS NULL;

ALTER TABLE defect_reports
    ALTER COLUMN last_seen_at SET NOT NULL,
    ADD CONSTRAINT last_seen_after_first CHECK (last_seen_at >= first_seen_at);

CREATE UNIQUE INDEX defect_reports_reference_idx ON defect_reports (reference);

COMMENT ON COLUMN defect_reports.reference IS
    'Human-readable report number. The primary key is a uuid because it is generated
     client-side and never collides; nobody reads a uuid aloud to a crew on a road.';
COMMENT ON COLUMN defect_reports.ward IS
    'Ward number, null until the point has been matched against a ward boundary. No
     boundary set is loaded yet, so infra/seed_demo.py assigns these and the dashboard
     shows the column as coming from the seed.';
COMMENT ON COLUMN defect_reports.last_seen_at IS
    'When travellers last registered this defect. first_seen_at drives time-to-resolve;
     this one says whether a hole reported in March is still being hit in September.';

CREATE TABLE municipal_teams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city        char(3) NOT NULL REFERENCES cities(code),
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    UNIQUE (city, name)
);

COMMENT ON TABLE municipal_teams IS
    'Work goes to a crew as often as to a person. A team is assignable in its own right
     rather than being a label on an employee, because the roster changes between the
     day a defect is assigned and the day somebody drives out to it.';

ALTER TABLE municipal_users
    ADD COLUMN team_id uuid REFERENCES municipal_teams(id) ON DELETE SET NULL,
    ADD COLUMN job_title text;

ALTER TABLE defect_reports
    ADD COLUMN assigned_team uuid REFERENCES municipal_teams(id) ON DELETE SET NULL,
    ADD CONSTRAINT assigned_to_one_place CHECK (
        assigned_to IS NULL OR assigned_team IS NULL
    );

COMMENT ON CONSTRAINT assigned_to_one_place ON defect_reports IS
    'A defect belongs to one person or one crew, never both. Two owners is the state
     where each assumes the other went.';

-- Confirmation is a count of independent travellers, not a severity. A head of road
-- maintenance decides how many phones have to agree before a report is worth a visit,
-- and that number depends on how many crews they have this month. The severity the
-- detector computes is still shown; it is evidence, not the gate.
ALTER TABLE municipal_settings
    ADD COLUMN confirmation_threshold integer NOT NULL DEFAULT 20
        CHECK (confirmation_threshold >= 2);

ALTER TABLE municipal_settings DROP COLUMN priority_threshold;

COMMENT ON COLUMN municipal_settings.confirmation_threshold IS
    'Independent confirmations at or above which a defect is Confirmed rather than Under
     Review. Never below 2, because the aggregation rule already refuses to create a
     defect from one traveller and a threshold of 1 would imply otherwise.';

-- promote_anomalies predates last_seen_at. Replaced rather than edited in 0007, which
-- has already run: a migration that changes after it has been applied is a migration
-- nobody can trust to describe the database in front of them.
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
               max(recorded_at)                 AS last_seen,
               array_agg(id)                    AS anomaly_ids
          FROM clustered
         WHERE cluster IS NOT NULL
         GROUP BY cluster
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
                city, location, severity, confirmations, evidence, status,
                first_seen_at, last_seen_at
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
                candidate.first_seen,
                candidate.last_seen
            );
            created := created + 1;
        ELSE
            UPDATE defect_reports
               SET confirmations = confirmations + candidate.identities,
                   severity = greatest(severity, round(candidate.mean_magnitude, 3)),
                   last_seen_at = greatest(last_seen_at, candidate.last_seen)
             WHERE id = existing;
        END IF;

        UPDATE road_anomalies
           SET promoted_at = now()
         WHERE id = ANY(candidate.anomaly_ids);
    END LOOP;

    RETURN created;
END;
$$;
