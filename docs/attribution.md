# Attribution

Every photograph in `apps/*/public/city/` is listed here with its source and licence.
An image that is not on this list is not in the repository: a public repository that
redistributes a photograph without a licence permitting redistribution is a liability,
and "found on the internet" is not a licence.

## City backdrops

The apps look for `public/city/<iata>.jpg` — `blr.jpg`, `del.jpg`, `bom.jpg` and so on.
Where there is no photograph the city's landmark line drawing is used instead, so the
app is complete without any of these files.

| File       | City | Source | Author | Licence |
| ---------- | ---- | ------ | ------ | ------- |
| _none yet_ |      |        |        |         |

### Where to get images that can go here

- **Wikimedia Commons** — filter to CC0, CC BY or CC BY-SA. Most Indian landmarks have
  good photographs under these terms. Record the author and licence in the table above;
  CC BY and CC BY-SA require it.
- **Unsplash** and **Pexels** — their licences permit commercial use without
  attribution, though crediting the photographer here anyway costs nothing.
- **Your own photographs** — put "own work" in the author column.

Avoid Google Images results, stock previews and anything with a watermark, whatever the
site says about "free". Most of those are neither free nor licensed for redistribution.

### What makes a good one

Landscape, at least 1920px wide, and busy in the middle only if it is also dark there —
the image sits at 13% opacity behind text, so a bright sky behind pale ink is the one
thing that breaks it. Compress to around 200 KB; nobody should wait on a backdrop to
read a departure time.

## Line drawings

`apps/traveller/components/landmark.tsx` contains original drawings made for this
project, built from geometric primitives. They are stylised impressions of public
monuments and are decoration: no institution depicted has any connection to CityFlow,
and none has endorsed it.

## Map tiles

MapLibre renders tiles from [OpenFreeMap](https://openfreemap.org), which serves
OpenStreetMap data. Map data is © OpenStreetMap contributors, ODbL. The attribution
control on every map states this, and it should not be removed.

## Road network

`road_segments` is derived from OpenStreetMap via Overpass. © OpenStreetMap
contributors, ODbL.
