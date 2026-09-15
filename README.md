# EnviroCatalysts Air Quality: mobile rebuild

A native mobile rebuild of two screens from the EnviroCatalysts air quality dashboard. It has its
own API, database and a scheduled scraper of the CAMS air-quality model (via Open-Meteo).

**Screens built:**
1. **Main Overview & Comparison**
2. **Hourly Analysis**

Both compare **FY 2024-25** (base) with **FY 2025-26** (comparison), as the brief sets.

| Folder | What's in it |
|--------|--------------|
| `backend/` | FastAPI API, database models and migrations, the importer, and the Open-Meteo scraper |
| `mobile/` | React Native (Expo) app |
| `docs/discovery.md` | Analysis of the existing Streamlit dashboard, and the design proposals |
| `docs/accessibility.md` | Accessibility check results: what was tested, what broke and how it was fixed |
| `docs/DECISIONS.md` | Every design and engineering decision, one line each, with the reason |

> **Data note.**
> - **Overview:** EnviroCatalysts' source files never arrived, so the numbers come from their
>   public dashboard's own "Download CSV" buttons (FY 2024-25 and FY 2025-26, all cities, exported
>   15 Sep 2026). See [Data and assumptions](#data-and-assumptions).
> - **Hourly:** the station history is still a labelled demo dataset, because no openly licensed
>   archive of two years of hourly station data exists. Each screen says where its numbers come
>   from.
> - **Right now:** hourly estimates from the CAMS air-quality model, fetched from Open-Meteo with
>   no key or sign-up, and labelled as estimates wherever they appear (see [Scraper](#scraper)).

## Quick start

You need Python 3.12+, Node 20+ and, for the iOS simulator, Xcode.

**1. Start the API** (terminal 1):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # optional: an ADMIN_TOKEN for POST /v1/admin/scrape
alembic upgrade head
python -m app.importer load seed/envirocatalysts-dashboard-2026-09-15 --replace  # real city data
python -m app.importer demo data/demo-hourly --hourly-only                       # demo station hours
python -m app.importer load data/demo-hourly
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API docs are then at http://localhost:8000/docs. The scraper runs at startup and then every hour;
it needs no key or account.

**2. Start the app** (terminal 2):

```bash
cd mobile
npm install
npm start               # press i for the iOS simulator, or scan the QR code with Expo Go
```

A phone on the same Wi-Fi works too, because the app finds the API on the machine running
`npm start`.

**Android APK** (installs without Expo Go; needs Android Studio's JDK and SDK):

```bash
cd mobile
npx expo prebuild -p android            # generates android/ (not in git)
cd android
EXPO_PUBLIC_API_URL=http://<your-computer's-wifi-ip>:8000 \
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk
```

The phone reaches the API over plain http on your Wi-Fi, which `app.json` allows through
`expo-build-properties`. On an 8 GB machine, raise Gradle's metaspace in
`android/gradle.properties` (`-XX:MaxMetaspaceSize=1024m`), or the build runs out of memory.

**3. Checks:**
- `pytest` in `backend/`: 152 tests. They also run on PostgreSQL if you set `TEST_DATABASE_URL`.
- `npm run typecheck` in `mobile/`.
- `npm run check:contrast` in `mobile/`: every colour pairing against WCAG AA.

## What I changed and why

The page exists to answer one question: *did air quality in these cities get better or worse
between two years?* On a phone it answers badly. About 30 options sit above the first chart, the
years sit in side-by-side panels, and "All cities" draws a chart 325 rows tall. The rebuild keeps
the data and the rules, and changes how you reach them.

- **Filters behind one button.** A one-line summary ("All India · NCAP · Top 10 by good days")
  opens a filters sheet. Its button counts the matches before you apply ("Show top 10 of 96
  cities"), and applying sends one request. The 11-option "Rank by" radio is now two choices: a
  metric, and best or worst first.
- **One year at a time, plus Change.** The panels became a toggle: *FY 24-25 · FY 25-26 · Change*.
  Change states the difference ("▲ +18 good days · better") instead of leaving you to compare two
  bars.
- **The answer comes first.** The Overview opens with one sentence worked out from the listed
  cities: "8 of 10 cities had fewer good days in FY 25-26", with the median change and the biggest
  drop underneath. On the Pollutants lens it counts lower averages as better and says so. The card
  shows exactly what a screen reader hears, and tapping it switches the list to Change.
- **Less to scroll past.** Four stacked banners (offline, demo data, data age, cities not ranked)
  became one row of small capsules, each opening its explanation. The live card became a row of
  city capsules, with how the estimate is made behind ⓘ and the source credit still visible.
- **Controls stay in reach.** The year toggle and the lens chips stay pinned while the city list
  scrolls under them. At large text sizes they would cover much of the screen, so there they
  scroll with the page.
- **A list, not a chart that grows.** Each city is a fixed-height row in a virtualised list, so
  "All cities" is just a longer scroll.
- **Every lens as a table.** *View as table* swaps the bars for the numbers: each category or
  pollutant in its own column, for either year or as the change. The city column stays put while
  the numbers scroll sideways, and a screen reader reads each row as one sentence.
- **Hourly follows one station, its city's current estimate first.** Of the source's 12 charts,
  it keeps those that answer different questions. The pollution clock is dropped: it repeated the
  hour-of-day chart.
- **Hourly reads at a glance.** The station is the screen's title, and tapping it changes the
  station. The live estimate sits on a bar of CPCB's six bands (0–500), so "80" reads as "low
  Satisfactory". Night hours (19:00–06:00) are shaded behind the hour-of-day bars, so a night-time
  peak stands out. The share of hours above the Indian and WHO limits is drawn as a meter.
- **Each year in days.** A city's detail shows each financial year as 365 squares, one per day,
  grouped by category, with empty squares for days without data. Side by side, the two years show
  how the mix shifted and how much is missing. The caption says the squares aren't in date order,
  so no one reads square N as the same day in both years.
- **Groups explained.** In the filters, NCAP, MPC and IGP are cards that say what they are
  ("Indo-Gangetic Plain cities") instead of bare acronyms.
- **Feels native.** A haptic tick confirms a changed choice and each point crossed while scrubbing
  the trend, but it is never the only feedback. Both tabs pull to refresh.

Five additions, and why each matters to someone checking air quality on a phone:

1. **Coverage pill on every city.** "96% data" or "⚠ PM2.5 flagged" explains in one tap why a city
   is or isn't ranked. It replaces an expander repeated three times, and keeps the list clean
   without hiding the rules.
2. **Drag to read the hourly trend.** Phones have no hover. Dragging along the line shows the exact
   hour and value above the chart, clear of your thumb. Screen-reader users step through the same
   points with a swipe.
3. **Works offline, says how old the data is.** Air quality gets checked on the move, on weak
   connections. The app opens on its last data, says "Updated 2 h ago" or "Offline", and never
   spins forever.
4. **Colour is never the only signal.** The source's yellow "Moderate" was 1.07:1 on white, and
   about 1 in 12 men can't tell its greens apart. Every category now also has its name and a level
   meter, and every colour pairing passes WCAG AA.
5. **Charts that speak.** The source's charts were silent to screen readers. Each chart now
   carries a generated sentence ("PM2.5 at Anand Vihar, 25 to 31 March: averaged 140…") that is
   both its caption and its spoken label.

Two fixes along the way:
- **The map works.** The source's map was covered by an "API KEY REQUIRED" watermark; Apple Maps
  needs no key.
- **Live values say what they are.** They are model estimates, so every live number carries that
  label and the source credit, and the estimated AQI leaves out ozone, which the model gets badly
  wrong over India (see [Scraper](#scraper)).

## Stack choice

**React Native with Expo (TypeScript).**
- **Chart performance.** Dragging along the hourly chart runs on the UI thread. A Gesture Handler
  pan moves the crosshair through a Reanimated shared value without a React render, and React
  re-renders only when the finger crosses into a new hour. That keeps scrubbing smooth over 744
  points drawn with `react-native-svg`.
- **Accessibility.** React Native renders real UIKit and Android views, so VoiceOver and TalkBack
  get native semantics and Dynamic Type for every button and label without extra work. The custom
  pieces map straight onto platform concepts: the chart is an `adjustable` element with custom
  actions ("Jump to the highest value"), and chips are radio buttons with a checked state.
- **What I'd do differently in Flutter.** I would draw the chart with a `CustomPainter` inside a
  `GestureDetector`; Flutter's own renderer would make scrubbing just as smooth. But Flutter paints
  everything itself, so I'd have to build the screen-reader tree by hand with `Semantics` widgets,
  node by node. In exchange, identical rendering on both platforms would have removed the
  iOS/Android differences I had to handle, such as sending TalkBack an explicit announcement for
  each step of the chart.

**FastAPI + SQLAlchemy, SQLite by default, PostgreSQL-ready.**
- **FastAPI:** the original dashboard is Python. Pydantic models also validate every query
  parameter against the allowed values and generate the interactive docs at `/docs`.
- **SQLite by default:** reviewers can run the API with zero setup, and WAL mode lets the
  scraper write while the API reads.
- **PostgreSQL:** the same models and Alembic migrations run on it, and the test suite passes on
  both.

**One repository for the app and the API,** so a change to an endpoint and to the screen that uses
it land in the same commit.

## Architecture

```
                 +------------------------------------------+
 CSV / Excel --> |  importer   ->  SQLite / PostgreSQL       |  <-- scraper (hourly, APScheduler)
 (canonical      |                cities, periods, AQI days, |      Open-Meteo: CAMS model,
  layout)        |                means, dominant days,      |      one point per city
                 |                stations, station_hourly,  |
                 |                live_readings, scrape_runs |
                 |  FastAPI  /v1/...                         |
                 +---------------------+--------------------+
                                       | JSON
                 +---------------------v--------------------+
                 |  Expo app: React Query cache, saved on    |
                 |  the phone (AsyncStorage), Overview +     |
                 |  Hourly tabs, filter / coverage / station |
                 |  sheets                                   |
                 +------------------------------------------+
```

- **Normalised historical data.** A city can belong to several groups, and each period is a row
  with start and end dates. AQI category days, mean concentrations and dominant-pollutant days are
  stored per city and period. Station data is hourly, and each timestamp marks the *end* of the
  hour, as CPCB labels it.
- **Live data is kept apart.** Scraped values go to `live_readings`, one row per city, pollutant
  and hour, never mixed with the import.
- **Two kinds of endpoint.** Resource endpoints (`/v1/cities`, `/v1/aqi-summary`,
  `/v1/coverage/{id}`, `/v1/stations/{id}/hourly`, `/v1/live/cities/{id}`) serve one thing
  each. Screen-shaped endpoints (`/v1/overview`, `/v1/hourly/summary`) fill a whole screen in one
  request, so switching tabs or periods doesn't wait on the network.
- **The rules live in the API.** Coverage (≥ 70% of days) and the PM2.5 floor (> 2 µg/m³) are
  applied there. They come back as reason codes (`low_coverage`, `pm25_floor`, `no_data`) that the
  app turns into words.
- **Caching.** Historical answers are fresh for an hour and live ones for five minutes. Revisiting
  a filter combination is instant, and the cache is saved on the phone for a week.

## Filters and charts: what was built, what was skipped

| In the source dashboard | In the app | Why |
|---|---|---|
| Geography, city group | Filters sheet: searchable states, group chips | Same behaviour, touch-sized |
| Frequency: FY / CY / Month, base and comparison pickers | FY only; base and comparison periods come from the API | The brief fixes FY 2024-25 vs FY 2025-26. The API's period table already holds CY and Month, so adding them means loading data and adding picker options, not a redesign. |
| Show top 10 / 20 / all | Kept | |
| Rank by (11 options) | Metric (good days, PM2.5, PM10, NO2, O3, CO) plus best or worst first | Same 11 outcomes, two controls |
| AQI days, concentration, dominant-pollutant charts, both periods side by side | One list, with tabs for AQI days, pollutant levels and dominant pollutant; toggle for FY 24-25, FY 25-26 or Change | Readable at 375 pt; Change is new |
| Category checkboxes that hide bar segments | Skipped | A legend that is also a filter is hard to use by touch and to explain to a screen reader. Each row speaks all its categories instead. |
| Map with category buttons | Map tab: dots coloured by each city's most common category, or by the CPCB band of its average PM2.5, PM10, NO2, O3 or CO; the legend gives each band's range | The source map was broken |
| CSV download per panel | Skipped | Not a phone task; the API serves the same data as JSON |
| Calendars, overshoot, FY trend, multi-city series (lower on the page) | Skipped | Outside the two screens in the brief |
| Hourly: state → city → station dropdowns, "City average" | One searchable station list with favourites and recents; the city average was dropped | The hourly series belongs to a station (the live estimate above it is for the station's city) |
| Hourly: base and comparison date ranges | Windows of 24 h, 7 days, 30 days or the full year inside the chosen FY; Change overlays the same days of the other year | Keeps the brief's FY scope; "today" is in neither FY |
| KPIs, hour of day, box plot, station heatmap, single-day heatmap | Kept. The box plot is monthly boxes, and the heatmap is transposed to fit a portrait screen | |
| Pollution clock | Dropped | Same data as the hour-of-day chart |

## Accessibility

- Every control has a spoken label and a role, and every selected option shows a ✓ and a fill,
  not just a colour change.
- Charts carry spoken summaries. The hourly trend can be stepped through by swiping, with actions
  to jump to the highest and lowest values.
- All colour pairings pass WCAG 2.1 AA, and layouts were checked at the largest text sizes, in dark
  mode and at 375 pt wide.
- CPCB's Good green is `#009A47` rather than the dashboard's `#00B050`. The Good and Satisfactory
  greens were only ΔE 14.0 apart (OKLab), under the 15 that neighbouring category colours need to
  be told apart at a glance; now the closest neighbouring pair is ΔE 19.6. The hue is unchanged, so
  the category is still recognisable, and the label on it stays black, at 5.71:1.

What was checked, what broke and how it was fixed: [docs/accessibility.md](docs/accessibility.md).

## Data and assumptions

- **Overview data comes from the dashboard's own downloads.** The source files weren't sent, so
  the city numbers were taken from the public dashboard's "Download CSV" buttons, as a visitor
  would, which the brief invites. The settings were Financial Year, All India and All Cities.
  - The dashboard lists only the cities that meet the 70% rule in the base year. So everything was
    downloaded twice, once with each year as the base.
  - Per-state and per-group downloads give each city's state and groups, and the dashboard's map
    gives coordinates.
  - `python -m app.importer convert-dashboard` turns the downloads into the canonical layout.
  - The result has 235 cities, FY 2024-25 and FY 2025-26.
  - What was downloaded, and the known limits:
    [PROVENANCE.md](backend/seed/envirocatalysts-dashboard-2026-09-15/PROVENANCE.md).
  - **Checked against the dashboard.** Loaded into this API, the numbers match what the dashboard
    shows:
    - 218 cities qualify for the FY 2024-25 ranking, as on the dashboard.
    - The top 10 by good days are the same cities with the same counts (Chamarajanagar 319,
      Madikeri 314, …).
    - NCAP has 96 ranked cities, as on the dashboard.
  - The dashboard reports 66 cities excluded for coverage in FY 2024-25. This dataset can show 17
    of them, the ones that qualify in FY 2025-26. The rest fail in both years, so they are in
    neither download.
- **Canonical layout.** The importer reads one CSV layout, described in
  `backend/app/importer/canonical.py`.
  - City numbers are aggregated per period, which is how the dashboard's downloads come.
  - Coverage is days with data divided by days in the period.
  - Hourly timestamps mark the end of each hour, in IST.

  The importer is the only code that changes when the original files arrive.
- **Live data is a model estimate.** The CAMS model's values for the ~45 km square around each
  city, with CPCB's AQI formula applied and ozone left out. It answers "what is the air like
  around this city now", not "what does CPCB's monitor read".

## Trade-offs made for time

- **Hourly history is demo data.**
  - The Overview runs on the dashboard's real numbers, but two years of hourly station data only
    exist in CPCB's CCR archive. CPCB's terms need its approval to reuse that archive, and the
    dashboard's Hourly page exports summaries, not hours.
  - So the Hourly screen keeps a labelled synthetic history. Its live card is real: the current
    model estimate for the station's city.
  - Datasets record which screen they cover, so the demo banner appears only on the screen whose
    numbers are generated.
- **Hourly history covers the two financial years, not 2015 to today.** The model and the series
  endpoint take any window, up to 400 days per request. I kept the UI to the brief's FY window and
  imported only that range.
- **Live values come from a model, not CPCB's monitors.** CPCB's real-time feed on data.gov.in
  needs an API key, and a key needs a government sign-up with a phone number. Open-Meteo needs
  neither, so anyone can run the scraper as it is. The cost: the values are estimates for a
  ~45 km square rather than station readings, and the model's ozone is too far off over India to
  use. The first version, a data.gov.in scraper with station matching, is in the git history.
- **Tested on iOS only.** Android and TalkBack haven't been tried. The code uses cross-platform
  APIs, and TalkBack gets explicit announcements where it behaves differently.
- **System font and Expo's icon.** The app keeps the system font, and Expo Go shows its own icon
  and splash, so a brand typeface and a custom icon were left for a development build.

### Next steps

- **Home-screen widget and Live Activity** for a chosen station's estimate. These need a
  development build, not Expo Go.
- **A daily calendar per station:** the "year in days" in date order. It needs a daily endpoint
  built from `station_hourly`, using CPCB's 16-valid-hours rule.
- **A peek card on the map** in place of the callout, and loading skeletons shaped like the
  content.
- **A CPCB monitor feed** for the live card, if a data.gov.in key becomes available. The first
  version of the scraper is in the git history.

## Backend

Requires Python 3.12+. No database server is needed: by default the API uses a SQLite file at
`backend/data/aq.db`. The same code runs on PostgreSQL if you set `DATABASE_URL`
(install with `pip install -e ".[postgres]"`).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env        # optional: an ADMIN_TOKEN
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

**Real city data.** `seed/envirocatalysts-dashboard-2026-09-15/` holds the Overview's numbers.
They were converted from the dashboard's CSV downloads with:

```bash
python -m app.importer convert-dashboard <export-dir> seed/envirocatalysts-dashboard-2026-09-15 --exported-on 2026-09-15
```

The converter merges the two download runs (one per base year) and stops if they disagree about a
city-year. Its [PROVENANCE.md](backend/seed/envirocatalysts-dashboard-2026-09-15/PROVENANCE.md)
records exactly what was downloaded and the known limits.

**Scopes.** A dataset's manifest says which screen it provides:
- `overview`: cities and their period aggregates;
- `hourly`: stations and their hours, for cities already loaded;
- `all`: both.

`/v1/meta` reports the dataset behind each screen, and the app shows the "demo data" banner only on
a screen whose dataset is synthetic. Loading an hourly dataset with `--replace` replaces only the
station data.

**Synthetic data.** For development, the full synthetic dataset covers both screens:

```bash
python -m app.importer demo data/demo
python -m app.importer load data/demo --replace
```

`demo data/demo-hourly --hourly-only` writes just the demo stations for Delhi, Mumbai and
Chennai, to load on top of the real city data.

### Endpoints

Every path is under `/v1`, so the API can change shape later without breaking installed apps.

**Resources**, one thing per request:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/cities?category=NCAP&state=` | Cities, filtered by group (`NCAP`, `MPC`, `IGP`, `DELHI_NCR`, `STATE_CAPITALS`) and state, with their station counts |
| GET | `/v1/aqi-summary?city_ids=1,2,3&period=FY2024-25` | For each city: AQI category days, mean concentrations, dominant-pollutant days and coverage |
| GET | `/v1/coverage/{city_id}?period=FY2024-25` | The 70% coverage and low-PM2.5 rules as booleans and reason codes, with which charts each rule removes the city from |
| GET | `/v1/stations/{id}/hourly?from=2025-03-01&to=2025-03-08&pollutant=PM2.5` | One station's series. Hourly up to 31 days and daily means (with min/max) beyond, so a full FY is 365 points. Gaps come back as `null` |
| GET | `/v1/live/cities/{city_id}` | The city's newest hour of **scraped** model values and its estimated AQI, from the live table, never the historical import |

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
| GET | `/v1/live/cities?state=&group=&order=desc&limit=10` | Cities ranked by estimated AQI at their newest hour, leaving out stale ones |
| GET | `/v1/live/status` | Last scraper run and how fresh the data is |
| POST | `/v1/admin/scrape` | Run the scraper now (header `X-Admin-Token`) |

Hourly timestamps are **hour-ending IST**, as CPCB publishes them: `2025-03-01T01:00+05:30` is
the hour 00:00–01:00. So `from=2025-03-01&to=2025-03-02` returns the 24 hours of 1 March, and
`from=2025-04-01&to=2026-04-01` returns FY 2025-26.

## Scraper

**Source:** Open-Meteo's [Air Quality API](https://open-meteo.com/en/docs/air-quality-api). It
serves the **CAMS global atmospheric composition forecast** from the EU's Copernicus Atmosphere
Monitoring Service: hourly PM2.5, PM10, NO2, SO2, CO and O3 on a 0.4° grid (about 45 km), with a
new model run every 12 hours.

**Why this source:** CPCB's real-time feed on data.gov.in would be the obvious choice, but it needs
an API key, and a key needs a government sign-up (MeriPehchaan) with a phone number. data.gov.in's
public sample key is shared by everyone and answered "Rate limit exceeded" when tried on
15 Sep 2026. Open-Meteo needs no key or account, so anyone can run the scraper as it is.

**Terms:** free for non-commercial use, under 10,000 calls a day, 5,000 an hour and 600 a minute.
The data is licensed CC BY 4.0, with credit to Open-Meteo and to CAMS shown next to it
([terms](https://open-meteo.com/en/terms), [licence](https://open-meteo.com/en/licence), checked
15 Sep 2026). This app is a non-commercial job assignment. A run is 171 cities in 4 requests, so
even counting every city as a call it is about 4,100 calls a day. Both live cards show the credit,
linked.

**What the values are, and what the app does with them:**
- Concentrations from a model of the ~45 km square around each city, not a monitor reading. The
  API labels them `"measure": "model_estimate"`, and the app says so next to every number.
- CO arrives in µg/m³ and is stored in mg/m³, the unit CPCB and the historical data use.
- **Estimated AQI:** CPCB's formula applied to the model's values.
  - Averages: 24-hour averages for PM2.5, PM10, NO2 and SO2 (at least 16 hours of data), and the
    highest 8-hour average for CO.
  - Sub-indices come from CPCB's breakpoints, and the AQI is the highest one.
  - It is reported only when three pollutants, one of them PM2.5 or PM10, have values.
  - The code is in `backend/app/analytics/live.py`.
- **Ozone is stored but left out of the AQI.**
  - Checked against CPCB monitors, CAMS ozone over India runs far too high: mean biases of
    42–108 µg/m³ where the observed daily means were 7–58 µg/m³
    ([Bulletin of Atmospheric Science and Technology, 2025](https://link.springer.com/article/10.1007/s42865-025-00109-x)).
  - The first scrape here showed the same thing. With ozone included, 8-hour peaks near 200 µg/m³
    put Delhi and most of north India in "Poor" on 15 Sep 2026.

**How it runs:**
- Hourly at :35 IST inside the API process (APScheduler), and once at startup. The model's values
  fall on the UTC hour, which is :30 in India, and are published ahead of time, so each run stores
  the hour that began five minutes earlier.
- On demand with `python -m app.scraper` or `POST /v1/admin/scrape`.

**Being a polite client:** it asks for 50 cities per request (`OPENMETEO_BATCH_SIZE`), waits
1 second between requests, and sends a real `User-Agent` (`SCRAPER_USER_AGENT`). It retries with
backoff on 429, 5xx and network errors. A failed run is recorded and logged, and it never takes
the API down.

**What a run does:**
- Asks for every city with coordinates (171 of the 235; the others aren't on the dashboard's map)
  for yesterday and today. So a new database has a full day after one run, and a missed run is
  filled in by the next.
- Checks every answer. The arrays must line up with the hours and the units must still be µg/m³;
  if not, that city is skipped rather than misread. Hours after now are forecasts and aren't
  stored.
- Inserts into `live_readings`, one row per city, pollutant and hour, separate from the historical
  import. An hour already stored is never rewritten.
- Deletes readings older than 30 days.
- Records the run in `scrape_runs` and logs one line. This was the first real run, on
  15 Sep 2026; later runs add about 1,000 new hours each:

```
Scrape run 1 success in 13.8s: 171 of 171 cities, 43092 hourly values (0 empty), 43092 readings inserted, 0 purged
```

**Replaced:** the first version scraped CPCB's station-level feed on data.gov.in. It is in the git
history, and migration `0005` swapped the tables.

**Attribution:** CAMS air-quality model (Copernicus Atmosphere Monitoring Service), via
[Open-Meteo.com](https://open-meteo.com/), CC BY 4.0.
