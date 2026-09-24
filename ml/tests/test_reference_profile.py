"""
Tests for the real-data reference profile used by the residual model.

The claim being tested is narrow on purpose: this module supplies one more
shape feature, calibrated from a real dataset, to XGBoost. It must never be
mistaken for -- or accidentally become -- a second demand curve.
"""

from __future__ import annotations

from datetime import date

from app.services import reference_profile


def test_index_stays_in_the_product_scale():
    for hour in range(24):
        for day in (date(2026, 3, 10), date(2026, 3, 14)):  # a Tuesday, a Saturday
            value = reference_profile.reference_index(day, hour * 60)
            assert 0.0 <= value <= 100.0


def test_interpolates_between_hourly_buckets():
    day = date(2026, 3, 10)  # Tuesday
    at_nine = reference_profile.reference_index(day, 9 * 60)
    at_nine_thirty = reference_profile.reference_index(day, 9 * 60 + 30)
    at_ten = reference_profile.reference_index(day, 10 * 60)

    # Halfway between two hours should land close to halfway between their values,
    # not jump straight to one bucket or the other.
    low, high = sorted([at_nine, at_ten])
    assert low - 0.01 <= at_nine_thirty <= high + 0.01


def test_deterministic():
    day = date(2026, 3, 10)
    a = reference_profile.reference_index(day, 9 * 60)
    b = reference_profile.reference_index(day, 9 * 60)
    assert a == b


def test_weekday_and_weekend_use_different_tables():
    weekday = [reference_profile.reference_index(date(2026, 3, 10), h * 60) for h in range(24)]
    weekend = [reference_profile.reference_index(date(2026, 3, 14), h * 60) for h in range(24)]
    assert weekday != weekend


def test_source_citation_is_present_and_readable():
    citation = reference_profile.source_citation()
    assert "Metro Interstate Traffic Volume" in citation
    assert citation.startswith("Metro")
