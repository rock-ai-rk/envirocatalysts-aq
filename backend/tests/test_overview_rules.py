from app.analytics.overview import PeriodStats, change_between, rank_cities

NAMES = {1: "Agra", 2: "Bhopal", 3: "Chennai", 4: "Delhi"}


def stats(good: int, days: int = 360, pm25: float = 40.0, period_days: int = 365) -> PeriodStats:
    return PeriodStats(
        period_days=period_days,
        days_with_data=days,
        aqi_days={"good": good, "satisfactory": days - good},
        pollutant_means={"PM2.5": pm25, "PM10": pm25 * 2},
        dominant_days={"PM2.5": days},
    )


def test_ranks_by_good_days_best_first_with_name_as_tiebreak():
    base = {1: stats(100), 2: stats(300), 3: stats(300), 4: stats(50)}

    ranking = rank_cities(NAMES, base, "good_days", "best", top=None)

    assert ranking.city_ids == [2, 3, 1, 4]


def test_worst_first_and_top_n():
    base = {1: stats(100), 2: stats(300), 3: stats(200), 4: stats(50)}

    ranking = rank_cities(NAMES, base, "good_days", "worst", top=2)

    assert ranking.city_ids == [4, 1]
    assert ranking.eligible == 4


def test_lowest_concentration_is_best():
    base = {1: stats(0, pm25=80), 2: stats(0, pm25=20), 3: stats(0, pm25=50)}

    assert rank_cities(NAMES, base, "PM2.5", "best", top=None).city_ids == [2, 3, 1]
    assert rank_cities(NAMES, base, "PM2.5", "worst", top=None).city_ids == [1, 3, 2]


def test_cities_under_70_percent_coverage_are_excluded_with_their_coverage():
    base = {1: stats(100, days=255), 2: stats(100, days=256)}  # 255/365 = 69.9%

    ranking = rank_cities({1: "Agra", 2: "Bhopal"}, base, "good_days", "best", top=None)

    assert ranking.city_ids == [2]
    [excluded] = ranking.excluded
    assert (excluded.city_id, excluded.reason) == (1, "low_coverage")
    assert round(excluded.coverage, 3) == 0.699


def test_cities_without_base_data_are_excluded():
    ranking = rank_cities({1: "Agra"}, {}, "good_days", "best", top=None)

    assert [(e.city_id, e.reason, e.coverage) for e in ranking.excluded] == [(1, "no_data", None)]


def test_pm25_floor_applies_only_to_pm25_rankings():
    base = {1: stats(200, pm25=1.8), 2: stats(100, pm25=30)}
    names = {1: "Agra", 2: "Bhopal"}

    by_pm25 = rank_cities(names, base, "PM2.5", "best", top=None)
    by_good_days = rank_cities(names, base, "good_days", "best", top=None)

    assert by_pm25.city_ids == [2]
    assert [(e.city_id, e.reason) for e in by_pm25.excluded] == [(1, "pm25_floor")]
    assert by_good_days.city_ids == [1, 2]


def test_cities_missing_the_ranked_pollutant_are_excluded():
    base = {
        1: stats(100),
        2: PeriodStats(period_days=365, days_with_data=360, aqi_days={"good": 50}),
    }

    ranking = rank_cities({1: "Agra", 2: "Bhopal"}, base, "PM2.5", "best", top=None)

    assert ranking.city_ids == [1]
    assert [(e.city_id, e.reason) for e in ranking.excluded] == [(2, "no_data")]


def test_change_is_comparison_minus_base():
    change = change_between(stats(100, pm25=50), stats(130, pm25=42.5))

    assert change.aqi_days["good"] == 30
    assert change.aqi_days["severe"] == 0
    assert change.pollutant_means["PM2.5"] == -7.5


def test_no_change_without_comparison_data():
    assert change_between(stats(100), None) is None
    assert change_between(stats(100), PeriodStats(period_days=365)) is None


def test_change_uses_the_rounded_values_the_app_shows():
    base = stats(100, pm25=18.24)
    comparison = stats(100, pm25=15.36)
    base.pollutant_means["CO"], comparison.pollutant_means["CO"] = 0.874, 0.812

    change = change_between(base, comparison)

    assert change.pollutant_means["PM2.5"] == -2.8  # 18.2 -> 15.4, not the raw -2.88
    assert change.pollutant_means["CO"] == -0.06  # CO keeps two decimals: 0.87 -> 0.81
