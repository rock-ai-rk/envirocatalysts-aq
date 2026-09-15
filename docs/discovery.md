# Discovery: the existing Streamlit dashboard

Captured 12 Sep 2026 from the live app
(`envirocatalysts-airquality-dashboard.streamlit.app`, embedded at envirocatalysts.com/airquality-dashboard).
Data on the live app runs to **10 Sep 2026**. Source line on the page: *"CPCB AQI Daily Bulletins & Station Monitoring Data"*.
Screenshots referenced below are in [`original-app/`](original-app/).

Everything in sections 1–4 was observed directly. Sections 5 onward are **proposals**. The final design
decisions belong to the author (see "Decisions to make" at the end).

---

## 1. Screen 1: Main Overview & Comparison

### Controls (in page order)

| # | Control | Type | Options / default |
|---|---------|------|-------------------|
| 1 | Geography | select | All India + states |
| 2 | City group | 5 toggle buttons, single-select, click again to clear | NCAP · MPC · IGP · Delhi NCR · State Capitals |
| 3 | Data Conditions / How to use | 2 expanders | rules text (below) |
| 4 | Link to Hourly Analysis | button | top right |
| 5 | Frequency | select | Financial Year · Calendar Year · Month (default **Month**) |
| 6 | Show Top Cities | radio | 10 · 20 · All Cities |
| 7 | Base year (+ base month) | select(s) | FY 2017-18 … FY 2026-27 |
| 8 | Comparison year (+ month) | select(s) | same list |
| 9 | Rank cities by | radio, **11 options** | Highest No. of Good Days; Lowest/Highest conc. of PM2.5, PM10, NO2, O3, CO |

That is **9 control groups and ~30 tappable options before the first chart**.
A summary line then echoes the state:
`Geography: All India · Category: All Categories · Frequency: Financial Year · Ranked by: Highest No. of Good Days · Showing 10 cities (target Top 10) of 325 filtered`.

### Outputs (each one rendered twice, base panel left and comparison panel right)

1. **AQI Category Days.** A horizontal stacked bar per city (Good → Severe). 6 category checkboxes hide or show segments in both charts. Includes a coverage-note expander and a CSV download per panel.
2. **Average Concentration.** A pollutant radio (PM2.5, PM10, NO2, O3 in µg/m³; CO in mg/m³) and one bar per city with a value label. The bar colour is the CPCB band of the value.
3. **Days as Dominant Pollutant.** A stacked bar per city over 7 pollutants (PM2.5, PM10, NO2, O3, CO, SO2, NH3), each with a checkbox filter.
4. **City Map.** Two maps with category buttons inside each one. In PM2.5 mode the bubble colour is the WMO concentration category (FY/CY) or a gradient (Month).
   **The map is currently broken:** the Carto basemap is covered in an "API KEY REQUIRED" watermark ([05](original-app/05-map-api-key-watermark.png)).

Further down the same page, and **out of scope** for this assignment: daily calendars (the same month across years), a single-year calendar with WHO/NAAQS overshoot markers, an FY trend, and a multi-city time series.

### Business rules (verbatim intent from "Data Conditions")

- **Base panel is strict.** A city appears only if its data is sufficient.
- **Comparison panel is lenient.** It shows the same cities as the base: a bar if data exists, the name only if not.
- **Coverage ≥ 70%** applies to charts 1–3 at all frequencies. A city is in the base only if data exists for ≥ 70% of the period's days (Month: 28–31 days; CY/FY: 365/366).
- **PM2.5 > 2 µg/m³** applies to chart 2, PM2.5 only. A city whose average PM2.5 is ≤ 2 is excluded from the base as a likely sensor malfunction. In the comparison panel its name is visible but it has no bar.
- Ranking and Top N are applied **after** the coverage filter.

**Observed for FY 2024-25 vs FY 2025-26, All India:** 325 cities after filtering. 2 were excluded from the base for coverage below 70%: **Palkalaiperur and Tirunelveli**. The top 10 by good days is led by Chamarajanagar (319 good days) and Madikeri (314).

---

## 2. Screen 2: Hourly Analysis (`/Hourly_Analysis`)

### Controls
- **State → City → Station.** Station defaults to "City Average"; Delhi has 54 stations.
- **Pollutant pills:** PM2.5 · PM10 · NO2 · SO2 · CO · O3
- **Base period:** a date or date range (default: the last 30 days).
- **Comparison period:** a date range. It is set automatically to the same window in the previous year.

### Outputs
- **4 KPI cards, each with a delta against the comparison period:**
  - Average
  - Peak hour concentration, with its timestamp
  - % of hours above NAAQS (60 µg/m³ for PM2.5)
  - % of hours above WHO (15 µg/m³)
- **① Hourly pattern.** The mean for each of the 24 hours of the day, coloured by CPCB band, with a WHO line and a peak annotation.
- **② Daily average trend.** Daily bars with NAAQS and WHO reference lines.
- **③ Heatmap.** Station × hour of day, for the top 5, top 10 or all stations; or a city analysis.
- **④ Single-day heatmap.** Station × hour for one chosen date, with a "🎯 Peak day" jump.
- **⑤ Box plot.** Daily or monthly distribution with CPCB band shading.
- **⑥ Pollution clock.** The same data as ① drawn as a polar chart.

Each of the 6 charts is rendered twice (base and comparison), so the page has **12 charts**.

### Conventions to preserve
- **Hours are labelled 01:00 … 00:00.** Each value covers the hour *ending* at that label. The database has to store an explicit hour-ending timestamp.
- **CPCB PM2.5 bands (µg/m³):** 0–30 · 31–60 · 61–90 · 91–120 · 121–250 · 251+.
- **The "Exc. NAAQS/WHO" KPIs compare hourly values against 24-hour limits.** Keep this for parity, but label it "% of hours above the 24-h limit" so it isn't misread.

---

## 3. Problems observed (candidates for "What I changed and why")

1. **Wall of filters.** About 30 options sit above the fold before any data appears. The 11-option "Rank by" radio is really two choices: a metric (good days or a pollutant) and a direction.
2. **Side-by-side base and comparison.** This halves the resolution, and the reader has to jump between panels to answer the real question, "did it get better?". There is **no change view** anywhere.
3. **Chart height scales with city count.** "All Cities" means 325 stacked rows inside one Plotly canvas.
4. **Every control change reruns the whole script** and redraws every chart on the page. That covers ~10 charts on the overview and 12 on the hourly page, including the out-of-scope sections below them.
5. **The coverage rules are hidden and repeated.** The same "Coverage Note" expander appears 3 times, and its text says excluded cities "appear in the comparison panel", while the comparison panel only lists the base's cities.
6. **The map is broken** (Carto API key watermark).
7. **Contrast failures** (section 4).
8. **Redundancy on the Hourly page.** The pollution clock repeats the hourly pattern, and every chart is duplicated per period.
9. **Screen-reader access.** The charts are Plotly canvases or SVGs with no text alternative. The legends are checkboxes that double as filters.
10. **A text bug.** The CSS `uppercase` turns "µg/m³" into "ΜG/M³" in the KPI labels ([06](original-app/06-hourly-filters-kpis.png)).

---

## 4. Contrast audit of the current palette

Colours were read from the Plotly traces. All value labels are rendered in **black**.

| Category | Hex | vs white chart bg (needs 3:1) | black label (needs 4.5:1) | white label |
|----------|-----|------:|------:|------:|
| Good | `#00B050` | 2.87 ✗ | 7.33 ✓ | 2.87 ✗ |
| Satisfactory | `#92D050` | 1.85 ✗ | 11.36 ✓ | 1.85 ✗ |
| Moderate | `#FFFF00` | **1.07** ✗ | 19.56 ✓ | 1.07 ✗ |
| Poor | `#FF9900` | 2.14 ✗ | 9.81 ✓ | 2.14 ✗ |
| Very Poor | `#FF0000` | 4.00 ✓ | 5.25 ✓ | 4.00 ✗ |
| Severe | `#7B0000` | 11.40 ✓ | **1.84** ✗ | 11.40 ✓ |

- Neighbouring stacked segments are all **below 3:1 against each other** (1.55–2.85), so the segments bleed together.
- **Severe fails on a dark background** (1.66 against `#0E1117`).
- **The black label on Severe fails outright.**

**Proposed fix.** Keep the CPCB colours, because users recognise them, and:
- choose each label's colour by computed contrast (black on everything except Severe, which gets white)
- put a 2 px gap in the surface colour between segments
- outline Severe on dark surfaces
- never use colour alone: every segment gets a text name and number, either on the chart or in its accessible label

---

## 5. Proposed data model (PostgreSQL). Provisional until the source files arrive.

The source app reads **pre-aggregated** files: city-level AQI category counts, concentration by year, month and FY, and an overshoot summary. The model stores those as they are and lets the API apply the rules (coverage, PM2.5 floor, rank, Top N).

```
city            (id, name, state, lat, lon)
city_group      (city_id, group_code)            -- NCAP | MPC | IGP | DELHI_NCR | STATE_CAPITAL
period          (id, freq, label, start_date, end_date, n_days)   -- 'FY', 'FY 2024-25', 2024-04-01, 2025-03-31, 365
city_period_aqi (city_id, period_id, good, satisfactory, moderate, poor, very_poor, severe, days_with_data)
city_period_dominant (city_id, period_id, pollutant, days)
city_period_conc     (city_id, period_id, pollutant, mean, days_with_data)

station         (id, city_id, name, source_code, lat, lon)
station_hourly  (station_id, ts_end timestamptz, pm25, pm10, no2, so2, co, o3)   -- PK (station_id, ts_end)
  -> materialized: station_daily (station_id, day, pollutant, mean, max, n_hours)
  -> materialized: station_hour_profile (station_id, period_id, pollutant, hour, mean, n)

live_reading    (id, station_id NULL, raw_state, raw_city, raw_station, pollutant,
                 min, max, avg, observed_at, fetched_at)  -- UNIQUE (raw_station, pollutant, observed_at)
scrape_run      (id, started_at, finished_at, status, seen, inserted, error)
station_alias   (raw_name, station_id)             -- maps scraper names to our stations
```

- **Sizing:** 2 FYs × 8,760 h × roughly 550 stations nationally comes to about **9.6 M wide rows**. That's comfortable for Postgres with a `(station_id, ts_end)` key. Profiles and daily means are precomputed, so the phone never receives raw hourly rows.
- **"Coverage" becomes a computed field** (`days_with_data / n_days`), returned with a reason code (`low_coverage`, `pm25_floor`, `no_data`). The app can then explain each exclusion instead of silently dropping the city.

## 6. Proposed API (FastAPI)

```
GET  /v1/meta                      states, city groups, periods, pollutants, data freshness
GET  /v1/overview?base=FY2024-25&comp=FY2025-26&state=&group=&rank=good_days&dir=desc&top=10
       -> one payload for all four tabs: ranked cities, each with base/comp/delta for
          AQI days, concentrations, dominant days, coverage + exclusion reason, lat/lon;
          plus an `excluded[]` list. Tab switches need no refetch.
GET  /v1/cities/{id}               both periods, all metrics (city detail sheet)
GET  /v1/cities/{id}/stations
GET  /v1/hourly/summary?city=|station=&pollutant=pm25&base=FY2024-25&comp=FY2025-26
       -> KPIs, 24-h profile ×2, daily series ×2, monthly box stats, peak day
GET  /v1/hourly/heatmap?city=&pollutant=&period=&top=5
GET  /v1/hourly/day?city=&pollutant=&date=      single-day station × hour drill-down
GET  /v1/live/latest?city=|station=             scraped latest readings + fetched_at
POST /v1/admin/scrape                            manual trigger (token-protected)
GET  /health
```

- Responses carry `ETag` and `Cache-Control`.
- The app caches with TanStack Query, so going back to a filter set you've already seen is instant.

## 7. Proposed mobile layout (React Native + Expo)

**Navigation:** bottom tabs **Overview · Hourly**. Tapping a city row deep-links into Hourly with that city pre-selected.

### Overview, top to bottom
1. **Filter summary bar** (replaces the summary line): `All India · All groups · Top 10 by good days` with a **Filters (n)** button that opens a bottom sheet containing:
   - Geography: a searchable list
   - City group: single-select chips, same behaviour as the source
   - Rank by: **metric** (Good days / PM2.5 / PM10 / NO2 / O3 / CO) plus **direction** (best first / worst first). Two small controls replace 11 radios.
   - Top 10 / 20 / All
   - Period: FY by default; CY and Month as optional extras

   One **Apply** sends one request.
2. **Latest reading strip** (from the scraper): the most recent CPCB value for the cities in view, with "updated 14:00" and a "provisional real-time data" note.
3. **Period control** (a segmented control): `FY 24-25 | FY 25-26 | Change`. It replaces the two side-by-side panels, and **Change** is new: it answers "better or worse?" directly.
4. **Metric tabs:** `AQI days | Pollutants | Dominant | Map`.
5. **One coverage banner** instead of 3 expanders: *"2 cities hidden in FY 24-25: under 70% data. Why?"* opens a sheet with the rules in plain language and the list of cities.
6. **City list** (a virtualised FlatList with fixed ~64 pt rows, so "All 325" is just a longer list, never a taller chart). Each row shows:
   - the city and state
   - a fixed-width 100% stacked bar
   - the headline number (e.g. *319 good days*)

   In Change mode the row shows a delta chip (*▲ 34 good days, better*). A missing comparison value reads "No data FY 25-26" rather than an empty gap.
7. **Tap a row** to open a city sheet: every metric for both periods, plus **Open hourly analysis**.
8. **Map tab:** city dots coloured by the dominant category, with the list above as the accessible equivalent.

### Hourly, top to bottom
1. **City › Station picker** (a sheet with search; City average by default) and a scrollable row of pollutant chips.
2. **The same period control**: `FY 24-25 | FY 25-26 | Compare`.
3. **Latest card** from the scraper for this station or city: avg/min/max and the timestamp.
4. **2 × 2 KPI grid** with deltas that say better or worse in words, not only red/green.
5. **24-hour profile:** 24 bars across the full width (~14 pt each on a 375 pt screen). In Compare mode the comparison appears as a line over the bars, with WHO and NAAQS reference lines. A generated sentence above it ("Highest at 23:00, 43 µg/m³; lowest at 15:00…") doubles as the screen-reader label.
6. **Monthly distribution** (12 box plots fit an FY exactly), or a daily line. Tapping a day, or "Jump to peak day", opens the single-day heatmap.
7. **Station × hour heatmap, transposed:** hours as 24 rows and stations as columns (top 5). That fits a portrait screen, where 24 columns don't. Tap a cell to see its value.
8. **Dropped:** the pollution clock (a duplicate of step 5) and every per-period duplicate chart.

### Accessibility approach
- Every chart is a single accessible element with a generated summary. List rows carry their own labels ("Chamarajanagar, Karnataka. FY 2024-25: 319 good, 23 satisfactory days. Coverage 98%").
- Selected chips and segments get a filled background, a ✓ icon and `accessibilityState={{selected:true}}`. Visible focus rings for keyboard and switch access.
- Dynamic type is respected: rows grow with the font size and never truncate numbers.
- Test on iPhone SE (375 × 667) and iPhone 16 Pro Max (430 × 932). Run Xcode Accessibility Inspector audits on both screens.

---

## 8. Scraper

> **Update, 15 Sep 2026: replaced.** Getting a data.gov.in key needs a government sign-up
> (MeriPehchaan) with a phone number, and the shared sample key answered "Rate limit exceeded". The
> scraper now reads Open-Meteo's keyless air-quality API (the CAMS model, CC BY 4.0), one point per
> city, and the app shows an estimated AQI from it. See the README's Scraper section. The plan below
> is kept as it was written.

- **Source:** *"Real time Air Quality Index from various locations"* on data.gov.in (OGD Platform India), published by CPCB.
  API: `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`. It was confirmed live on 12 Sep 2026: without a key it returns `400 "Authorization field missing"`.
- **Licence:** Government Open Data License – India (GODL). It allows use, adaptation and redistribution for commercial and non-commercial purposes, **with attribution** to the provider, source and licence. The README must include the attribution statement.
- **Access:** a free API key from data.gov.in → My Account. The author registers for this.
- **Expected fields** (verify once a key is available): `state, city, station, last_update, latitude, longitude, pollutant_id, min_value, max_value, avg_value`.
  - **Verified 13 Sep 2026.** I used the sample key data.gov.in publishes on the resource's API page, which is limited to 10 records.
    - The fields are exactly the ones above, all strings, with `"NA"` for missing values.
    - `last_update` looks like `13-09-2026 11:00:00` (IST).
    - The response metadata includes `total` (3,402 records), `updated` (Unix seconds) and `updated_date`. `updated_date` was 06:02 UTC, i.e. 11:32 IST, for the 11:00 values.
  - **Finding: the values are AQI sub-indices, not concentrations.** CO shows as `12` and `25`, which is impossible as mg/m³. The live card and the `/latest` endpoint must label them that way, and must not use µg/m³.
- **Design:**
  - Fetch with httpx, paging by limit/offset, with retry and backoff.
  - Normalise: pollutant ids, `"NA"` → null, IST timestamps.
  - Upsert idempotently on `(station, pollutant, observed_at)` and write a `scrape_run` row.
  - Runs **hourly** through APScheduler, and on demand via `POST /v1/admin/scrape`.
  - Scraper station names are mapped to our stations through `station_alias`.
- **Fallback:** the OpenAQ v3 API (free key), which also carries CPCB stations.

---

## 9. Blockers and open questions

1. **Source repo and data files.** These are needed to seed the database. When requesting them, also ask *where the hourly station data lives*: the Hourly page serves 2015–present for 54 Delhi stations, so it's probably Parquet files or a database rather than CSV.
2. **data.gov.in API key.** The author registers for it. *(15 Sep: not needed any more; the scraper moved to Open-Meteo, see §8.)*
3. **How much hourly history to import.** Proposal: all stations for FY 2024-25 and FY 2025-26, plus yearly means from 2015 on if the source has them, for a small "long-term" strip.
4. **Map provider.** Maps of India must follow the official (Survey of India) boundaries. Google Maps shows those boundaries to users in India; a generic open GeoJSON outline may not. Options:
   - `react-native-maps`: Apple Maps on iOS, and Google on Android, which needs a key
   - MapLibre with OSM tiles, which needs an Expo dev build

## 10. Decisions to make (author)

- [ ] Confirm React Native + Expo (vs Flutter).
- [ ] Overview: is `Change` a third segment, or the default view?
- [ ] Which filters are always visible and which sit in the sheet.
- [ ] Hourly: which charts to keep (proposal: KPIs, 24-h profile, monthly distribution, heatmap, peak-day drill-down).
- [ ] Map provider (section 9.4).
- [ ] Whether to expose only FY in the UI, or CY and Month too (the API supports all three through the `period` table either way).
