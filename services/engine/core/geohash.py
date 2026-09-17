"""Decoding the coarsened cells the browser sends instead of coordinates."""

from dataclasses import dataclass

BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
CELL_PRECISION = 6

_INDEX = {character: position for position, character in enumerate(BASE32)}


@dataclass(frozen=True)
class Cell:
    south: float
    north: float
    west: float
    east: float

    @property
    def centre(self) -> tuple[float, float]:
        """Longitude and latitude of the middle of the cell, in that order."""
        return ((self.west + self.east) / 2, (self.south + self.north) / 2)


class InvalidCell(ValueError):
    pass


def decode(cell: str) -> Cell:
    """
    The box a six-character cell covers.

    The traveller's device never sends a coordinate, so this box is the most precise
    thing the engine can know about where someone starts. Routing from its centre is
    the honest consequence: the plan is for the neighbourhood, not the doorstep.
    """
    if len(cell) != CELL_PRECISION:
        raise InvalidCell(
            f"Expected {CELL_PRECISION} characters, got {len(cell)}: {cell!r}"
        )

    south, north = -90.0, 90.0
    west, east = -180.0, 180.0
    splitting_longitude = True

    for character in cell:
        position = _INDEX.get(character)
        if position is None:
            raise InvalidCell(f"{character!r} is not a geohash character.")

        for shift in (4, 3, 2, 1, 0):
            bit = (position >> shift) & 1
            if splitting_longitude:
                middle = (west + east) / 2
                if bit:
                    west = middle
                else:
                    east = middle
            else:
                middle = (south + north) / 2
                if bit:
                    south = middle
                else:
                    north = middle
            splitting_longitude = not splitting_longitude

    return Cell(south=south, north=north, west=west, east=east)
