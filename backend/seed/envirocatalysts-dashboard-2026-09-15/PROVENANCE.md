# Where this dataset comes from

**Source:** EnviroCatalysts Air Quality Dashboard
(https://www.envirocatalysts.com/airquality-dashboard, the Streamlit app
envirocatalysts-airquality-dashboard.streamlit.app). The dashboard cites *CPCB AQI Daily Bulletins &
Station Monitoring Data*.

**Why the dashboard:** the assignment's source files were requested but hadn't arrived by
15 Sep 2026. The brief invites using the public dashboard "like any regular user would", and the
dashboard offers a "Download CSV" button under each chart. This dataset is built only from those
downloads.

**Exported:** 15 Sep 2026, with Frequency = Financial Year, Geography = All India,
Category = All Categories, Show Top Cities = All Cities, Rank by = Highest No. of Good Days.

| Download | What it gives |
|---|---|
| Chart 1, AQI Category Days (base and comparison panel) | Days in each CPCB category, per city |
| Chart 2, Average Concentration, once per variable (PM2.5, PM10, NO2, O3, CO) | Mean concentration per city |
| Chart 3, Days as Dominant Pollutant | Days each pollutant was dominant, per city |
| Chart 1's labels, which read "City, State" | Each city's state (the downloads name only the city). Cross-checked against per-state downloads for 142 cities, with no disagreement |
| Chart 1 with each city-group button on | Each city's groups (NCAP, MPC, IGP, Delhi NCR, State Capitals) |
| The city map's points | Latitude and longitude, for the cities the map shows |

**Why each download was taken twice:** the dashboard's base panel lists only the cities that meet
the 70% coverage rule in the base year, and the comparison panel shows those same cities. So
everything was exported once with FY 2024-25 as the base and once with FY 2025-26 as the base. The
converter merges the two runs, and stops if they disagree on any city-year they share (they didn't).

**Converted with:**

    python -m app.importer convert-dashboard <export-dir> seed/envirocatalysts-dashboard-2026-09-15 --exported-on 2026-09-15

(`backend/app/importer/dashboard_export.py`)

**Known limits:**
- A city that fails the 70% rule in *both* years is in neither run, so it's missing here. The
  dashboard counts 325 cities in scope, and this dataset has the ones that qualify in at least one
  year.
- The download gives each pollutant's mean but not how many days it averages. The loader needs a
  count, so the city's AQI day count for that year stands in. No Overview rule reads that column.
- The dashboard's map has coordinates for 171 of the 235 cities. The others are in every list, but
  not on the map.
- There is no station-level hourly data here. The dashboard's Hourly page exports summaries, not
  hours, so the Hourly screen runs on a labelled demo dataset (`python -m app.importer demo … --hourly-only`).

**Use:** EnviroCatalysts' data, used for their own assignment, with attribution. Ask them before
reusing it anywhere else.
