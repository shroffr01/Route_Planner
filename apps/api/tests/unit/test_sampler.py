"""Tests for the route waypoint sampler. See implementation.md §6.4."""
from datetime import datetime

import numpy as np

from app.services.router import RouteResult, sample_waypoints


def make_route(coords: list[tuple[float, float]], durations: list[float]) -> RouteResult:
    cum = np.concatenate([[0.0], np.cumsum(durations)])
    return RouteResult(
        coordinates=coords,
        duration_s=float(cum[-1]),
        distance_m=0.0,
        cumulative_s=cum,
        raw={},
    )


def test_short_route_yields_two_waypoints_origin_and_destination():
    # 30 minutes total — less than the 1h interval, so we get origin + destination only.
    route = make_route([(0.0, 0.0), (1.0, 0.0)], [1800.0])
    depart = datetime(2026, 5, 10, 12, 0, 0)
    out = sample_waypoints(route, depart, interval_s=3600)
    assert len(out) == 2
    assert out[0][2] == depart
    # destination time = depart + 30 min
    assert (out[-1][2] - depart).total_seconds() == 1800


def test_three_hour_route_yields_four_waypoints():
    # Single 3-hour segment for simplicity.
    route = make_route([(0.0, 0.0), (3.0, 0.0)], [3 * 3600.0])
    depart = datetime(2026, 5, 10, 12, 0, 0)
    out = sample_waypoints(route, depart, interval_s=3600)
    # offsets: 0, 3600, 7200, then destination at 10800 → 4 waypoints.
    assert len(out) == 4
    times = [(w[2] - depart).total_seconds() for w in out]
    assert times == [0, 3600, 7200, 10800]


def test_interpolation_lands_between_segment_endpoints():
    # Two equal-duration segments, total 2h. Sample at 1h → should land at the joint.
    route = make_route([(0.0, 0.0), (1.0, 0.0), (2.0, 0.0)], [3600.0, 3600.0])
    out = sample_waypoints(route, datetime(2026, 1, 1), interval_s=3600)
    # offsets: 0, 3600, then dest at 7200 → 3 waypoints.
    assert len(out) == 3
    # waypoint at offset 3600 should be at coord (1.0, 0.0) — the segment joint.
    lat, lon, _t = out[1]
    assert abs(lon - 1.0) < 1e-9
    assert abs(lat - 0.0) < 1e-9


def test_destination_is_always_included_even_off_boundary():
    # 90-minute single-segment route. Interval 3600 → samples at 0; destination at 5400.
    route = make_route([(0.0, 0.0), (1.0, 0.0)], [5400.0])
    out = sample_waypoints(route, datetime(2026, 1, 1), interval_s=3600)
    assert len(out) == 3  # 0, 3600, destination
    assert (out[-1][2] - out[0][2]).total_seconds() == 5400
