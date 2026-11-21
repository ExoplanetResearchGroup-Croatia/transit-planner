"""
Generate astropy reference values for the TypeScript tests
(tests/fixtures/astropy-reference.json).

Run:  python3 tools/reference/make_fixtures.py
Needs: astropy >= 5 (tested with 6.1.3). No network access: IERS auto-download is
disabled, so UT1-UTC for future dates falls back to 0 (affects altitudes by
< 0.005 deg, far below the test tolerance).
"""
import json
import sys
import warnings
from pathlib import Path

import astropy
import astropy.units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord, get_sun
from astropy.time import Time
from astropy.utils import iers

iers.conf.auto_download = False
iers.conf.iers_degraded_accuracy = "warn"
warnings.simplefilter("ignore")

SITE = {"name": "Rijeka", "lat": 45.3271, "lon": 14.4422, "elevation": 0.0}
loc = EarthLocation(lat=SITE["lat"] * u.deg, lon=SITE["lon"] * u.deg, height=SITE["elevation"] * u.m)

TARGETS = [
    {"name": "WASP-12", "ra": 97.6366250, "dec": 29.6722778},
    {"name": "HD 189733", "ra": 300.1821223, "dec": 22.7097759},
    {"name": "55 Cnc", "ra": 133.1492125, "dec": 28.3308211},
    {"name": "WASP-19", "ra": 148.4167000, "dec": -45.6591667},
    {"name": "TOI-1758", "ra": 354.7415810, "dec": 75.6852317},
]

UTC_TIMES = [
    "2026-01-15T21:30:00", "2026-03-20T02:10:00", "2026-06-21T22:45:00",
    "2026-09-23T01:00:00", "2026-11-21T23:59:30", "2027-02-10T19:20:00",
    "2027-05-05T00:30:00", "2027-08-12T03:15:00",
]

bjd_cases = []
for tg in TARGETS:
    c = SkyCoord(ra=tg["ra"] * u.deg, dec=tg["dec"] * u.deg, frame="icrs")
    for s in UTC_TIMES:
        t = Time(s, scale="utc", location=loc)
        ltt = t.light_travel_time(c, kind="barycentric")
        bjd = (t.tdb + ltt).jd
        bjd_cases.append({"target": tg["name"], "ra": tg["ra"], "dec": tg["dec"], "utc": s + "Z",
                          "bjd_tdb": bjd, "romer_s": float(ltt.to(u.s).value)})

alt_cases = []
for tg in TARGETS:
    c = SkyCoord(ra=tg["ra"] * u.deg, dec=tg["dec"] * u.deg, frame="icrs")
    for s in UTC_TIMES:
        t = Time(s, scale="utc")
        aa = c.transform_to(AltAz(obstime=t, location=loc, pressure=0 * u.hPa))
        alt_cases.append({"target": tg["name"], "ra": tg["ra"], "dec": tg["dec"], "utc": s + "Z",
                          "alt": float(aa.alt.deg), "az": float(aa.az.deg)})

sun_cases = []
for s in UTC_TIMES + ["2026-12-21T16:00:00", "2026-06-21T19:30:00", "2026-11-22T05:00:00"]:
    t = Time(s, scale="utc")
    aa = get_sun(t).transform_to(AltAz(obstime=t, location=loc, pressure=0 * u.hPa))
    sun_cases.append({"utc": s + "Z", "alt": float(aa.alt.deg)})

out = {
    "generator": "tools/reference/make_fixtures.py",
    "astropy": astropy.__version__,
    "python": sys.version.split()[0],
    "site": SITE,
    "bjd": bjd_cases,
    "altaz": alt_cases,
    "sun": sun_cases,
}
dest = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "astropy-reference.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, indent=1))
print(f"wrote {dest} ({len(bjd_cases)} BJD, {len(alt_cases)} alt/az, {len(sun_cases)} sun cases)")
