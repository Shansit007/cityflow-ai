#!/usr/bin/env bash
#
# Run the whole CityFlow AI simulation comparison in one command.
#
# WHAT IT DOES
#   1. netconvert   OpenStreetMap extract      → road network
#   2. make-tazs.py network + trips            → zone definitions
#   3. duarouter    trips + zones              → routes, for BOTH scenarios
#   4. sumo         routes                     → metrics,  for BOTH scenarios
#   5. read-metrics.py                         → the five numbers to type in
#
# THE EXPERIMENT
#   Same road network. Same travellers. Same origins and destinations. Same
#   number of trips. The ONLY difference between the two runs is departure
#   time — which is what makes any difference in the result attributable to
#   demand smoothing and nothing else.
#
#   Both runs use IDENTICAL settings on purpose. Changing anything between them
#   would invalidate the comparison.
#
# USAGE
#   ./run-comparison.sh <city.osm.xml> <baseline.trips.xml> <cityflow.trips.xml>
#
set -euo pipefail

if [ "$#" -ne 3 ]; then
  cat <<'USAGE'

Usage:
  ./run-comparison.sh <city.osm.xml> <baseline.trips.xml> <cityflow.trips.xml>

Get the three files first:

  1. The map — openstreetmap.org → navigate to your city → Export →
     drag a box around ONE DISTRICT (not the whole city) → Export.
     Save it as city.osm.xml

  2. The two trip files — Admin Portal → Simulation → download both.

Put all three in the same folder as this script, then run it.

USAGE
  exit 1
fi

OSM="$1"
BASELINE_TRIPS="$2"
CITYFLOW_TRIPS="$3"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for file in "$OSM" "$BASELINE_TRIPS" "$CITYFLOW_TRIPS"; do
  [ -f "$file" ] || { echo "✖ File not found: $file"; exit 1; }
done

for tool in netconvert duarouter sumo; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "✖ '$tool' is not on your PATH."
    echo "  Install SUMO first:  pip install eclipse-sumo"
    exit 1
  }
done

# ---------------------------------------------------------------------------
# Compatibility: trip files exported before the XML-comment fix are not valid
# XML, because their header printed a command line containing a double hyphen —
# which is the sequence that ends an XML comment. Repair them in place rather
# than failing, so an already-downloaded export still works.
# ---------------------------------------------------------------------------
echo
echo "Checking the trip files are valid XML …"
python3 "$HERE/repair-trips.py" "$BASELINE_TRIPS" "$CITYFLOW_TRIPS"

echo
echo "======================================================================"
echo "  STEP 1 of 4 — building the road network from OpenStreetMap"
echo "======================================================================"
# These flags clean up raw OSM data: merge redundant geometry, infer roundabouts
# and motorway ramps, join clustered junctions, guess traffic signals. Without
# them the network has thousands of artificial junctions and the run crawls.
netconvert \
  --osm-files "$OSM" \
  -o city.net.xml \
  --geometry.remove \
  --roundabouts.guess \
  --ramps.guess \
  --junctions.join \
  --tls.guess-signals \
  --tls.discard-simple \
  --remove-edges.isolated \
  --no-warnings

echo
echo "======================================================================"
echo "  STEP 2 of 4 — defining the zones"
echo "======================================================================"
python3 "$HERE/make-tazs.py" city.net.xml "$BASELINE_TRIPS" "$CITYFLOW_TRIPS" -o tazs.add.xml

route () {
  local name="$1" trips="$2"
  echo
  echo "  routing $name …"
  # --ignore-errors skips trips whose origin and destination are not connected,
  # which is common with a clipped network. The count is reported below.
  duarouter \
    -n city.net.xml \
    --taz-files tazs.add.xml \
    -t "$trips" \
    -o "$name.rou.xml" \
    --ignore-errors \
    --no-warnings
}

echo
echo "======================================================================"
echo "  STEP 3 of 4 — routing both scenarios"
echo "======================================================================"
route baseline "$BASELINE_TRIPS"
route cityflow "$CITYFLOW_TRIPS"

simulate () {
  local name="$1"
  echo
  echo "  simulating $name …"
  # IDENTICAL settings for both. Any difference here would invalidate the
  # comparison, which is the whole point of the exercise.
  sumo \
    -n city.net.xml \
    -r "$name.rou.xml" \
    --tripinfo-output "$name.tripinfo.xml" \
    --summary "$name.summary.xml" \
    --no-warnings \
    --no-step-log \
    --time-to-teleport 300
}

echo
echo "======================================================================"
echo "  STEP 4 of 4 — running both simulations"
echo "======================================================================"
simulate baseline
simulate cityflow

python3 "$HERE/read-metrics.py"
