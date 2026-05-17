"""Table-driven tests for the favorability grader. See implementation.md §6.3."""
from app.models.weather import Alert, Forecast
from app.services.grading import grade_trip, grade_waypoint


def make_forecast(**overrides) -> Forecast:
    base = dict(
        temp_f=70,
        feels_like_f=70,
        pop_pct=0,
        wind_mph=5,
        wind_gust_mph=10,
        visibility_mi=10,
        cloud_pct=20,
        condition_code="01d",
        summary="Clear",
    )
    base.update(overrides)
    return Forecast(**base)


def test_perfect_conditions_get_an_A():
    g = grade_waypoint(make_forecast(), [])
    assert g.letter == "A"
    assert g.score == 0


def test_heavy_precipitation_drops_grade():
    g_clear = grade_waypoint(make_forecast(), [])
    g_rain = grade_waypoint(make_forecast(pop_pct=80), [])
    assert g_rain.score > g_clear.score
    assert any("precipitation" in r.lower() for r in g_rain.reasons)


def test_severe_wind_gusts_drop_grade_meaningfully():
    g = grade_waypoint(make_forecast(wind_gust_mph=65), [])
    # Per §6.3 table: gust > 60 adds 30. Alone that's a C; combined with anything else it
    # tips to D/F. Here we just assert the boundary moved a full letter from A.
    assert g.letter in {"C", "D", "F"}
    assert g.score >= 30


def test_freezing_plus_precip_flags_ice_risk():
    g_warm = grade_waypoint(make_forecast(pop_pct=60), [])
    g_ice = grade_waypoint(make_forecast(temp_f=28, pop_pct=60), [])
    assert any("ice" in r.lower() for r in g_ice.reasons)
    assert g_ice.score > g_warm.score  # ice risk adds 25


def test_low_visibility_adds_score():
    g_low = grade_waypoint(make_forecast(visibility_mi=0.5), [])
    g_med = grade_waypoint(make_forecast(visibility_mi=2.0), [])
    g_ok = grade_waypoint(make_forecast(visibility_mi=10), [])
    assert g_low.score > g_med.score > g_ok.score


def test_active_severe_alert_adds_30():
    alert = Alert(
        event="Severe Thunderstorm Warning",
        severity="Severe",
        starts_at="2026-05-10T15:00:00+00:00",
        ends_at="2026-05-10T17:00:00+00:00",
    )
    g_with = grade_waypoint(make_forecast(), [alert])
    g_without = grade_waypoint(make_forecast(), [])
    assert g_with.score == g_without.score + 30


def test_missing_forecast_is_neutral():
    g = grade_waypoint(None, [])
    assert g.letter == "C"


def test_trip_grade_picks_worst():
    grades = [
        grade_waypoint(make_forecast(), []),
        grade_waypoint(make_forecast(pop_pct=90, wind_gust_mph=50), []),
        grade_waypoint(make_forecast(), []),
    ]
    trip, worst_idx = grade_trip(grades)
    assert worst_idx == 1
    assert trip.score >= grades[0].score
