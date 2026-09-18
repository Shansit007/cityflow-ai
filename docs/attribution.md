# Attribution

## Backdrops

There are no photographs in this repository, on purpose.

Each city's backdrop is generated: two soft gradient washes in colours chosen for that
city, and an outline drawing of one of its landmarks. Both are produced in the browser
from a few hundred bytes of CSS and SVG. Nothing is downloaded, they stay sharp at any
size, and they follow the theme control rather than being fixed to one of the two.

The alternative was a photograph per city, and it was rejected on its merits. Every image
would need terms permitting redistribution, a credit line that has to stay accurate for
as long as the repository exists, and a check that nobody has since changed the licence.
Six photographs at full resolution also came to 36 MB, which is a real cost to a commuter
on mobile data for something displayed at low opacity behind text.

`apps/traveller/components/landmark.tsx` holds the drawings: India Gate, Vidhana Soudha,
the Gateway of India, Charminar, Howrah Bridge, Hawa Mahal, Napier Bridge, Shaniwar Wada
and the Sidi Saiyyed jali. They are original work made for this project, built from arcs
and straight lines, and they are stylised impressions rather than architectural drawings.
No institution depicted has any connection to CityFlow or has endorsed it.

`apps/traveller/components/city-backdrop.tsx` holds the colours, each with a line saying
what it is reaching for, so anyone changing one knows what they would be breaking.

## Map tiles

MapLibre renders tiles from [OpenFreeMap](https://openfreemap.org), which serves
OpenStreetMap data with no key and no quota. Map data is © OpenStreetMap contributors,
ODbL. The attribution control on every map states this and should not be removed.

## Road network

`road_segments` is derived from OpenStreetMap via Overpass. © OpenStreetMap
contributors, ODbL. `scripts/build_city_map.py` can draw that same geometry as an SVG,
which is an option for a backdrop that is literally the city's own streets.

## Capacity model

Saturation flow rates and green ratios follow Indo-HCM (CSIR-CRRI, 2017). The lane-width
adjustment is from the HCM 6th edition. Neither organisation has any connection to this
project; `docs/engine.md` sets out exactly which numbers came from where and which are
this project's own assumptions.
