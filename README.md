# EnviroCatalysts Air Quality: mobile rebuild

> Work in progress. This README grows as the project does; the final version will cover the stack
> choice, the "What I changed and why" notes and the accessibility results.

A mobile rebuild of two screens from the EnviroCatalysts air quality dashboard:
**Main Overview & Comparison** and **Hourly Analysis**. Both are backed by this project's own API,
database and scraper.

| Folder | What's in it |
|--------|--------------|
| `backend/` | FastAPI API, database models and migrations, and the CPCB real-time scraper |
| `mobile/` | React Native (Expo) app |
| `docs/discovery.md` | Analysis of the existing Streamlit dashboard, and the design proposals |

## Backend

Requires Python 3.12+. No database server is needed: by default the API uses a SQLite file at
`backend/data/aq.db`. The same code runs on PostgreSQL if you set `DATABASE_URL`
(install with `pip install -e ".[postgres]"`).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env        # then add DATAGOV_API_KEY and an ADMIN_TOKEN
alembic upgrade head
uvicorn app.main:app --reload
```

Interactive API docs are then at http://localhost:8000/docs.

Run the tests with `pytest`. They use a throwaway SQLite database, or PostgreSQL if
`TEST_DATABASE_URL` points at a database whose name ends in `_test`.

### Historical data

The Overview and Hourly screens read historical data loaded with the importer:

```bash
python -m app.importer load <dataset-dir> [--replace]
```

A dataset directory uses one canonical CSV layout, described in `backend/app/importer/canonical.py`.
The loader validates every row, reports problems by file and line, and loads everything in one
transaction.

Until the EnviroCatalysts files arrive, you can generate a **synthetic** dataset for development.
It is marked synthetic, and the app shows a "demo data" banner while it is loaded:

```bash
python -m app.importer demo data/demo
python -m app.importer load data/demo --replace
```

### Endpoints so far

Every path is under `/v1`, so the API can change shape later without breaking installed apps.

**Resources**, one thing per request:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/cities?category=NCAP&state=` | Cities, filtered by group (`NCAP`, `MPC`, `IGP`, `DELHI_NCR`, `STATE_CAPITALS`) and state, with their station counts |
| GET | `/v1/aqi-summary?city_ids=1,2,3&period=FY2024-25` | For each city: AQI category days, mean concentrations, dominant-pollutant days and coverage |
| GET | `/v1/coverage/{city_id}?period=FY2024-25` | The 70% coverage and low-PM2.5 rules as booleans and reason codes, with which charts each rule removes the city from |
| GET | `/v1/stations/{id}/hourly?from=2025-03-01&to=2025-03-08&pollutant=PM2.5` | One station's series. Hourly up to 31 days and daily means (with min/max) beyond, so a full FY is 365 points. Gaps come back as `null` |
| GET | `/v1/stations/{id}/latest` | The station's newest **scraped** readings and its current AQI, from the live table, never the historical import |

**Screen-shaped**: one request fills a whole screen, so switching tabs needs no new request:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | API and database check |
| GET | `/v1/meta` | Periods, states, city groups, coverage rules, and the loaded dataset |
| GET | `/v1/overview?base=FY2024-25&comparison=FY2025-26&state=&group=&rank_by=good_days&direction=best&top=10` | Ranked cities with both periods, the change between them, and excluded cities with the reason |
| GET | `/v1/cities/{id}` | One city's numbers for both periods |
| GET | `/v1/hourly/cities` | Cities with hourly station data, and their stations |
| GET | `/v1/hourly/summary?city_id=&station_id=&pollutant=PM2.5` | KPIs, 24-hour pattern, daily means and monthly distribution for both periods |
| GET | `/v1/hourly/heatmap?city_id=&pollutant=&period=&top=5` | Station × hour-of-day means |
| GET | `/v1/hourly/day?city_id=&day=` | Station × hour values for one day |
| GET | `/v1/live/latest?state=&city=&station_id=` | Newest reading of each pollutant at each live-feed station |
| GET | `/v1/live/cities?pollutant=PM2.5&order=desc&limit=10` | Cities ranked by their stations' latest fresh sub-index |
| GET | `/v1/live/status` | Last scraper run and how fresh the data is |
| POST | `/v1/admin/scrape[?force=true]` | Run the scraper now (header `X-Admin-Token`) |

Hourly timestamps are **hour-ending IST**, as CPCB publishes them: `2025-03-01T01:00+05:30` is
the hour 00:00–01:00. So `from=2025-03-01&to=2025-03-02` returns the 24 hours of 1 March, and
`from=2025-04-01&to=2026-04-01` returns FY 2025-26.

## Scraper

**Source:** "Real time Air Quality Index from various locations", published by the Central
Pollution Control Board (CPCB) on the Open Government Data Platform India:
https://www.data.gov.in/resource/real-time-air-quality-index-various-locations

**Licence:** Government Open Data License – India
([Gazette notification, PDF](https://www.data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf);
the portal's own licence page currently redirects to "page not found"). It allows use and
adaptation for commercial and non-commercial purposes, with attribution.

The API page on data.gov.in names this licence for resource `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`
(checked 13 Sep 2026). The dataset page lists the publisher as the Ministry of Environment, Forest
and Climate Change / CPCB, with hourly granularity. It also warns that the values come straight
from field instruments without human checking, so the app labels them as provisional.

**What the values are.** For each station and pollutant the feed gives an average, minimum and
maximum on the **AQI sub-index scale (0–500)**, not a concentration. The live records show this:
CO comes through as values like 12 or 25, which would be impossible as mg/m³. The API therefore
labels these readings `"measure": "aqi_sub_index"`. It also computes each station's AQI the way
CPCB does: the highest sub-index, reported only when at least 3 pollutants have values and one of
them is PM2.5 or PM10.

**How it runs:**
- Hourly at :40 IST inside the API process (APScheduler), and once at startup. data.gov.in
  publishes each hour's values about 30 minutes after the hour.
- On demand with `python -m app.scraper [--force]` or `POST /v1/admin/scrape[?force=true]`.

**Being a polite client:**
- **Skips unchanged data.** Each run first asks for a single record and compares the feed's
  `updated` time with the last successful run's. If nothing has changed, the run stops there
  and is logged as `unchanged`. A full fetch is about 3,400 records in 4 pages.
- **Paces requests.** It sends a real `User-Agent` (`SCRAPER_USER_AGENT`) and pauses 1 second
  between pages.
- **Handles failures.** It retries with backoff on 429, 5xx and network errors. A failed run is
  recorded and logged, and it never takes the API down.

**What a run does:**
- Normalises the records: `"NA"` becomes null, `OZONE` becomes `O3`, and timestamps are read as IST.
- Upserts the stations.
- Inserts readings into `live_readings` with a `source` column, separate from the historical
  import. Already-stored readings are skipped, since each is unique per station, pollutant and
  timestamp.
- **Links stations** to the historical data (`station_links`), by location name within the same
  city, then by distance up to 1.5 km. This is what lets `/v1/stations/{id}/latest` find a
  station's live readings. Manual links are never overwritten.
- Deletes readings older than 30 days.
- Records the run in `scrape_runs`, and logs one line per run. The format is below; the numbers
  are illustrative:

```
Scrape run 12 success in 6.2s: 3402 records fetched, 611 skipped, 540 stations, 2791 readings inserted, 0 purged, 11 stations linked
Scrape run 13 unchanged in 0.4s: feed last updated 2026-09-13T06:02:13+00:00, nothing fetched
```

**Security:** the API key never appears in logs or stored errors.

**Attribution:** Air quality data: Central Pollution Control Board, Ministry of Environment,
Forest and Climate Change, Government of India, via data.gov.in, under the Government Open Data
License – India.
