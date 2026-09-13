"""Match stations in the historical data to stations in the CPCB real-time feed.

The two sources name stations independently. The feed uses "<location>, <city> - <agency>"
("Anand Vihar, Delhi - DPCC"); the historical files may use the same form or just the location.
Within the same city, a station is linked to the live station with:

1. the same location name ("anand vihar"), if exactly one live station has it, otherwise
2. the nearest live station within 1.5 km, when both have coordinates.

Links are stored in station_links so they can be inspected and corrected. A manual link is never
replaced, and an existing link is kept if a later pass finds no match.
"""

import math
import re
from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import utcnow
from app.models import LiveStation, Station, StationLink

MAX_DISTANCE_M = 1500.0
EARTH_RADIUS_M = 6_371_000.0


@dataclass
class LinkReport:
    linked: int = 0  # links created or changed by this pass
    unmatched: list[str] = field(default_factory=list)  # historical stations with no live match


def location_key(name: str) -> str:
    """The location part of a station name, normalised.

    "Anand Vihar, Delhi - DPCC" and "Anand Vihar" both become "anand vihar".
    """
    location = name.split(",")[0]
    return re.sub(r"[^a-z0-9]+", " ", location.lower()).strip()


def refresh_links(session: Session) -> LinkReport:
    """Link every historical station that has a live match. Flushes; the caller commits."""
    live_by_city: dict[str, list[LiveStation]] = defaultdict(list)
    for live in session.scalars(select(LiveStation)):
        live_by_city[_place_key(live.city)].append(live)
    links = {link.station_id: link for link in session.scalars(select(StationLink))}

    report = LinkReport()
    for station in session.scalars(select(Station).options(joinedload(Station.city))):
        link = links.get(station.id)
        if link is not None and link.method == "manual":
            continue
        match = _best_match(station, live_by_city.get(_place_key(station.city.name), []))
        if match is None:
            if link is None:
                report.unmatched.append(f"{station.name}, {station.city.name}")
            continue

        live, method, distance = match
        if link is None:
            session.add(
                StationLink(
                    station_id=station.id,
                    live_station_id=live.id,
                    method=method,
                    distance_m=distance,
                )
            )
            report.linked += 1
        elif (link.live_station_id, link.method) != (live.id, method):
            link.live_station_id = live.id
            link.method = method
            link.distance_m = distance
            link.linked_at = utcnow()
            report.linked += 1
    session.flush()
    return report


def _best_match(
    station: Station, candidates: list[LiveStation]
) -> tuple[LiveStation, str, float | None] | None:
    key = location_key(station.name)
    named = [live for live in candidates if location_key(live.name) == key]
    if len(named) == 1:
        return named[0], "name", distance_m(station, named[0])

    # No name match, or an ambiguous one: take the nearest station close enough to be the same
    # site, preferring the ambiguous name matches if there are any.
    nearby = [
        (distance, live)
        for live in (named or candidates)
        if (distance := distance_m(station, live)) is not None and distance <= MAX_DISTANCE_M
    ]
    if not nearby:
        return None
    distance, live = min(nearby, key=lambda pair: pair[0])
    return live, "distance", distance


def distance_m(a: Station | LiveStation, b: Station | LiveStation) -> float | None:
    """Great-circle distance in metres, or None when either side has no coordinates."""
    if None in (a.latitude, a.longitude, b.latitude, b.longitude):
        return None
    lat1, lon1, lat2, lon2 = map(math.radians, (a.latitude, a.longitude, b.latitude, b.longitude))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return round(2 * EARTH_RADIUS_M * math.asin(math.sqrt(h)), 1)


def _place_key(name: str) -> str:
    return name.replace("_", " ").strip().lower()
