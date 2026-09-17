import math

import pytest

from core.geohash import InvalidCell, decode


def test_agrees_with_the_browser_on_bengaluru() -> None:
    """apps/traveller/lib/geohash.ts encodes this point as tdr1v9; both must agree."""
    cell = decode("tdr1v9")

    assert cell.south <= 12.9716 <= cell.north
    assert cell.west <= 77.5946 <= cell.east


def test_cell_is_the_size_the_privacy_note_claims() -> None:
    cell = decode("tdr1v9")
    _, latitude = cell.centre

    height_m = (cell.north - cell.south) * 111_320
    width_m = (cell.east - cell.west) * 111_320 * math.cos(math.radians(latitude))

    assert width_m == pytest.approx(1192, abs=20)
    assert height_m == pytest.approx(611, abs=20)


@pytest.mark.parametrize("cell", ["tdr1v", "tdr1v9x", "tdr1va", "TDR1V9", ""])
def test_malformed_cells_are_refused(cell: str) -> None:
    with pytest.raises(InvalidCell):
        decode(cell)
