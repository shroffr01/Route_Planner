"""Weather Favorability Grade — see implementation.md §6.3.

Pure functions. No I/O. Trivially unit-testable.
"""
from __future__ import annotations

from app.models.weather import Alert, Forecast, Grade, GradeLetter

# Severity → score contribution for an active NWS alert touching this waypoint.
ALERT_SEVERITY_WEIGHT: dict[str, int] = {
    "Minor": 10,
    "Moderate": 20,
    "Severe": 30,
    "Extreme": 40,
    "Unknown": 10,
}


def _score_letter(score: int) -> GradeLetter:
    if score <= 9:
        return "A"
    if score <= 24:
        return "B"
    if score <= 44:
        return "C"
    if score <= 69:
        return "D"
    return "F"


def grade_waypoint(forecast: Forecast | None, intersecting_alerts: list[Alert]) -> Grade:
    """Compute the favorability grade for a single waypoint."""
    score = 0
    reasons: list[str] = []

    if forecast is None:
        # No forecast available — neutral grade with a note.
        return Grade(letter="C", score=30, reasons=["Forecast unavailable"])

    pop = max(0.0, min(100.0, forecast.pop_pct))
    if pop > 0:
        contrib = min(25, int(round(pop / 4)))
        score += contrib
        if pop >= 50:
            reasons.append(f"{int(pop)}% chance of precipitation")

    gust = forecast.wind_gust_mph or forecast.wind_mph
    if gust > 60:
        score += 30
        reasons.append(f"Wind gusts to {int(gust)} mph")
    elif gust > 45:
        score += 20
        reasons.append(f"Wind gusts to {int(gust)} mph")
    elif gust > 30:
        score += 10
        reasons.append(f"Wind gusts to {int(gust)} mph")

    if forecast.temp_f <= 32 and pop > 0:
        score += 25
        reasons.append("Freezing temperatures with precipitation (ice risk)")

    vis = forecast.visibility_mi
    if vis is not None:
        if vis < 1:
            score += 25
            reasons.append(f"Visibility {vis:.1f} mi")
        elif vis < 3:
            score += 10
            reasons.append(f"Visibility {vis:.1f} mi")

    for alert in intersecting_alerts:
        w = ALERT_SEVERITY_WEIGHT.get(alert.severity, 10)
        score += w
        reasons.append(f"Active {alert.event}")

    score = max(0, min(100, score))
    return Grade(letter=_score_letter(score), score=score, reasons=reasons)


def grade_trip(waypoint_grades: list[Grade]) -> tuple[Grade, int]:
    """Roll up per-waypoint grades into a trip grade. Returns (grade, worst_waypoint_index)."""
    if not waypoint_grades:
        return Grade(letter="A", score=0, reasons=[]), 0
    worst_idx = max(range(len(waypoint_grades)), key=lambda i: waypoint_grades[i].score)
    worst = waypoint_grades[worst_idx]
    # Trip grade leans on the worst stop but takes 60% worst + 40% mean.
    mean = sum(g.score for g in waypoint_grades) / len(waypoint_grades)
    score = int(round(0.6 * worst.score + 0.4 * mean))
    score = max(0, min(100, score))
    reasons = list(dict.fromkeys(worst.reasons))[:3]
    return Grade(letter=_score_letter(score), score=score, reasons=reasons), worst_idx
