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

### Endpoints so far

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | API and database check |
| GET | `/v1/live/latest?state=&city=&station_id=` | Newest reading of each pollutant at each station |
| GET | `/v1/live/cities?pollutant=PM2.5&order=desc&limit=10` | Cities ranked by their stations' latest fresh values |
| GET | `/v1/live/status` | Last scraper run and how fresh the data is |
| POST | `/v1/admin/scrape` | Run the scraper now (header `X-Admin-Token`) |

## Scraper

**Source:** "Real time Air Quality Index from various locations", published by the Central
Pollution Control Board (CPCB) on the Open Government Data Platform India:
https://www.data.gov.in/resource/real-time-air-quality-index-various-locations

**Licence:** [Government Open Data License – India](https://www.data.gov.in/government-open-data-license-india).
It allows use and adaptation for commercial and non-commercial purposes, with attribution.

**How it runs:**
- Every 60 minutes inside the API process (APScheduler), and once at startup.
- On demand with `python -m app.scraper` or `POST /v1/admin/scrape`.

**What a run does:**
- Pages through the feed.
- Normalises the records: `"NA"` becomes null, `OZONE` becomes `O3`, and timestamps are read as IST.
- Upserts the stations.
- Inserts readings, ignoring ones already stored, since readings are unique per station, pollutant and timestamp.
- Deletes readings older than 30 days.
- Records the run in `scrape_runs`.

**Security:** the API key never appears in logs or stored errors.

**Attribution:** Air quality data: Central Pollution Control Board, Ministry of Environment,
Forest and Climate Change, Government of India, via data.gov.in, under the Government Open Data
License – India.
