-- OSM tags lanes on arterials and almost never on residential streets, so most
-- segments take a class default. Without this column the capacity figure looks
-- uniformly derived from map data when most of it rests on an assumption, and a
-- reviewer asking where the number comes from deserves to see which is which.

ALTER TABLE road_segments
    ADD COLUMN lanes_tagged boolean NOT NULL DEFAULT false;

ALTER TABLE road_segments
    ALTER COLUMN lanes_tagged DROP DEFAULT;

COMMENT ON COLUMN road_segments.lanes_tagged IS
    'True when OSM supplied a usable lane count for this way. False means lanes came
     from the per-class default in core/osm.py, and capacity_vph inherits that
     uncertainty.';
