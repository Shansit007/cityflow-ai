from core.fleet import INDIAN_URBAN_PEAK
from core.osm import build_segment, resolve_lanes

STRAIGHT = [(77.60, 12.97), (77.61, 12.98)]


def segment(**overrides: object):
    attributes: dict[str, object] = {
        "highway": "primary",
        "osmid": 12345,
        "length": 240.0,
        "oneway": True,
        "lanes": "4",
    }
    attributes.update(overrides)
    return build_segment(1, 2, attributes, STRAIGHT, INDIAN_URBAN_PEAK)


def test_two_way_street_is_halved_because_osm_tags_the_whole_carriageway() -> None:
    assert resolve_lanes("4", "primary", oneway=False) == (2, True)
    assert resolve_lanes("4", "primary", oneway=True) == (4, True)


def test_a_single_lane_two_way_street_keeps_one_lane_per_direction() -> None:
    assert resolve_lanes("1", "residential", oneway=False) == (1, True)


def test_missing_lane_tag_falls_back_to_the_class_default() -> None:
    assert resolve_lanes(None, "motorway", oneway=True) == (3, False)
    assert resolve_lanes(None, "residential", oneway=True) == (1, False)


def test_lane_tag_arriving_as_a_list_from_merged_ways() -> None:
    assert resolve_lanes(["3", "2"], "primary", oneway=True) == (3, True)


def test_unparseable_lane_tag_does_not_drop_the_road() -> None:
    assert resolve_lanes("two", "secondary", oneway=True) == (2, False)
    assert resolve_lanes("0", "secondary", oneway=True) == (2, False)


def test_edge_without_capacity_parameters_is_skipped_not_guessed() -> None:
    assert segment(highway="cycleway") is None
    assert segment(highway="footway") is None


def test_highway_and_osmid_lists_are_reduced_to_their_first_value() -> None:
    built = segment(highway=["primary", "secondary"], osmid=[999, 1000])

    assert built is not None
    assert built.highway_class == "primary"
    assert built.osm_way_id == 999


def test_edge_without_a_usable_length_is_skipped() -> None:
    assert segment(length=0) is None
    assert segment(length=None) is None


def test_geometry_is_written_as_lon_lat_wkt() -> None:
    built = segment()

    assert built is not None
    assert built.wkt == "LINESTRING(77.6 12.97, 77.61 12.98)"


def test_untagged_lanes_are_marked_so_capacity_provenance_survives() -> None:
    built = segment(lanes=None)

    assert built is not None
    assert built.lanes_tagged is False
    assert segment(lanes="4").lanes_tagged is True  # type: ignore[union-attr]


def test_capacity_is_attached_and_positive() -> None:
    built = segment()

    assert built is not None
    assert built.capacity_vph > 0
