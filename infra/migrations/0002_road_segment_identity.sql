-- One OSM way becomes several graph edges: it is split at every intersection, and a
-- two-way street yields one edge per direction. UNIQUE (city, osm_way_id) therefore
-- rejects most of a real extract. The identity of a segment is the way plus the pair
-- of nodes it runs between, plus its direction.

ALTER TABLE road_segments
    ADD COLUMN from_node bigint NOT NULL,
    ADD COLUMN to_node   bigint NOT NULL;

ALTER TABLE road_segments
    DROP CONSTRAINT road_segments_city_osm_way_id_key;

ALTER TABLE road_segments
    ADD CONSTRAINT road_segments_identity
    UNIQUE (city, osm_way_id, from_node, to_node);

COMMENT ON COLUMN road_segments.lanes IS
    'Lanes in this direction. OSM tags a two-way street with its total lane count, so a
     bidirectional way is halved when loaded; capacity is always per direction.';
