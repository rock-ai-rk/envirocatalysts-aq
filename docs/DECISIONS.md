# Decisions

One line per decision, and why. Where the brief said nothing, I picked the option that is
simplest to explain. The README has the longer reasoning.

## Stack

- **React Native with Expo (TypeScript), not Flutter.** Native views give VoiceOver and TalkBack real semantics and Dynamic Type without extra work, and the chart's drag runs on the UI thread with Reanimated.
- **FastAPI, SQLAlchemy and Alembic.** The source dashboard is Python, and Pydantic validates every query parameter and generates the `/docs` page.
- **SQLite by default, PostgreSQL-ready.** Reviewers can run the API without a database server, and the same models, migrations and tests run on PostgreSQL.
- **The scheduler runs inside the API process (APScheduler), not as a separate worker.** There is one process to start, and a failed run is caught and logged without taking the API down.
- **One repository for the app and the API.** A change to an endpoint and to the screen that uses it land in the same commit.
- **Expo Go for development, a release APK for Android phones.** Development needs no Apple developer account, and the APK installs without Expo Go.

## Data

- **Overview numbers come from the dashboard's own "Download CSV" buttons.** The source files never arrived, and the downloads match the dashboard: 218 ranked cities, the same top 10, and 96 NCAP cities.
- **Downloaded twice, once with each year as the base.** The dashboard lists only the cities that pass the 70% rule in its base year.
- **The Hourly station history is labelled demo data.** Reusing two years of CPCB's hourly data needs CPCB's approval, so the demo banner appears on that screen only.
- **FY 2024-25 against FY 2025-26 only.** The brief fixes this scope. The period table already holds calendar years and months, so adding them means loading the data and adding picker options.
- **Hourly covers the two financial years, not 2015 onwards.** The same scope rule applies. The series endpoint takes any window up to 400 days.
- **Timestamps mark the end of each hour, in IST.** CPCB labels its hours that way, so imported files need no shifting.
- **CSV files are loaded once.** The importer loads them into the database, and no endpoint reads a file.

## API

- **Every path is under `/v1`.** Installed apps keep working if the API changes shape later.
- **Screen-shaped endpoints alongside the resource ones.** `/v1/overview` returns a whole screen's data in one request, so switching the period or the lens needs no new request.
- **The coverage rules live in the API.** The 70% rule and the PM2.5 floor (> 2 µg/m³) come back as reason codes (`low_coverage`, `pm25_floor`, `no_data`), and the app only turns them into words.
- **The manual scrape needs a shared secret.** `POST /v1/admin/scrape` checks the `X-Admin-Token` header, and without an `ADMIN_TOKEN` set it refuses every call.

## Scraper

- **Open-Meteo (the CAMS model), not CPCB on data.gov.in.** A data.gov.in key needs a government sign-up with a phone number, and its shared sample key answered "Rate limit exceeded" on 15 Sep 2026.
- **Terms checked on 15 Sep 2026.** It is free for non-commercial use under 10,000 calls a day, and the data is CC BY 4.0 with credit, which both live cards show, linked.
- **An official JSON API, not HTML scraping.** A JSON API is quicker to build, doesn't break when a page layout changes, and is easier to explain.
- **Every live number is labelled an estimate.** The values are a model's estimate for a ~45 km square, not a monitor reading.
- **Ozone is stored but left out of the estimated AQI.** CAMS ozone over India runs 42–108 µg/m³ too high (a 2025 study), and with ozone included Delhi showed as "Poor".
- **Runs at :35 past each hour, IST.** The model's hours fall on the UTC hour, which is :30 in India, so each run stores the hour that started five minutes earlier.
- **Each run fetches yesterday and today.** A new database has a full day of data after one run, and the next run fills in a missed one.
- **Stored hours are never rewritten.** Inserts use `ON CONFLICT DO NOTHING`, so a second run of the same hour adds nothing.
- **Answers are checked before they are stored.** If the units are wrong or the arrays don't line up, that city is skipped rather than stored misread.
- **Live readings are kept for 30 days.** That is enough for the 24-hour averages, and the table stays small.
- **A polite client.** It asks for 50 cities per request, waits 1 second between requests, sends a real User-Agent and backs off on 429 and 5xx answers.
- **Old data is never shown as fresh.** Every live value shows its hour and age, and cities with no reading in the last 3 hours drop out of "Right now".

## Mobile design

- **Filters sit in a sheet behind one button.** The button shows how many filters changed, and one "Show results" sends one request.
- **The sheet's button counts the matches before you apply.** It sends the drafted filters' own Overview request, so it reads "Show top 10 of 96 cities", and the list is already cached when the sheet closes.
- **"Rank by" is a metric plus best or worst first.** It gives the same outcomes as the source's 11-option radio with two controls.
- **The periods are a toggle: FY 24-25 · FY 25-26 · Change.** Change states the difference in words and arrows instead of leaving two bars to compare.
- **The verdict comes first.** It is one sentence worked out from the listed cities, and the same sentence is its screen-reader label.
- **Status notes are capsules, not banners.** Offline, demo data, data age and not-ranked cities fit in one row, and each opens its explanation.
- **The controls stay pinned while the list scrolls, except at large text sizes,** where they would cover most of the list.
- **Fixed-height rows in a virtualised list.** "All cities" is a longer scroll, never a taller chart.
- **"View as table" is a checkbox chip beside the legend, not a separate screen.** The table keeps the same filters, year and lens, and shows every category or pollutant as a column instead of only the ranked one.
- **The table's city column stays put while the numbers scroll sideways.** Seven columns don't fit 375 pt, and a row is useless once its name has scrolled away.
- **Screen readers get one element per table row.** The city cell reads the whole row ("Good 319 days, Satisfactory 23 days…") and the number cells are hidden, so no one has to swipe through 8 cells per city.
- **Table cells stop growing at 2× text, and past 1.3× the table stacks.** At large text sizes one column fills the screen, so each city becomes a block of label-and-value lines with nothing hidden off to the side.
- **Hourly follows one station, and the station's name is the title.** Tapping it opens a searchable picker with favourites and recents.
- **Hourly opens on the latest 7 days of hours.** A week shows the daily cycle clearly, and 30 days or the full year is one tap away.
- **The estimated AQI sits on CPCB's 0–500 bands,** so "80" reads as low Satisfactory.
- **Night hours (19:00–06:00) are shaded** on the hour-of-day chart, so a night-time peak stands out.
- **The pollution clock was dropped.** It showed the same data as the hour-of-day chart.
- **Category checkboxes that hide bar segments were skipped.** A legend that is also a filter is hard to use by touch and to explain to a screen reader.
- **CSV download was skipped.** It isn't a phone task, and the API serves the same data as JSON.
- **Apple Maps on iOS.** It needs no key, and the source's map was covered by an "API KEY REQUIRED" watermark.
- **The map colours cities by category or by one pollutant's average, chosen in one chip row.** With a pollutant chosen, the rows and the verdict switch to it too, and the legend gives each CPCB band's range, so the map, the rows and the key always agree.
- **A hollow dot means no value for that year.** The map doesn't fall back to the other year's data.
- **Skeletons shaped like the content, not spinners.** The screen keeps its layout while it loads, so nothing jumps when the data arrives. They pulse gently, hold still under Reduce Motion, and each is one screen-reader element that says what is loading.
- **Offline, a skeleton becomes a message.** Requests pause without a connection, so a pulsing placeholder would wait forever; it says "Waiting for a connection" instead.
- **Only the first load shows a skeleton.** A new filter combination keeps the previous list on screen until the new one arrives.
- **Haptics only confirm a change.** A tick marks a changed choice or a crossed chart point, and the screen always changes too.
- **System font and Expo's icon.** A brand typeface and a custom icon need a development build.

## Colour and accessibility

- **Category colours stay CPCB's,** so people recognise them. The label on each is black or white, whichever contrasts more; the lowest is 5.25:1, on Very Poor.
- **Good is `#009A47`, not `#00B050`.** Good and Satisfactory were ΔE 14.0 apart (OKLab), and now the closest neighbouring pair is 19.6. The label on Good is black, at 5.71:1.
- **Moderate stays `#FFFF00`.** It is 1.07:1 on white, so badges, swatches and every stacked-bar segment get an outline that passes 3:1, and each category also shows its name and a level meter.
- **Halogen blue for the app's own colours** (accent `#0A5197` light, `#93C9FA` dark). No CPCB category is blue, so buttons and selections never look like an air-quality reading.
- **Pollutant colours are the Okabe-Ito palette,** which stays distinguishable with colour-vision deficiencies.
- **Mobile tests cover the words and the behaviour, not pixels.** Jest with React Native Testing Library: the sentences built from the numbers, the filters sheet against a faked API (draft, count, apply), and the loading, offline and error states.
- **Reanimated gets a small hand-written mock in tests.** Its own Jest mock loads the native worklets runtime, which isn't there under Jest, and these tests check what renders, not the animation.
- **Contrast is checked by a script.** `npm run check:contrast` tests all 75 pairings, light and dark, against WCAG 2.1 AA. It covers the text pairings and, for 1.4.11, each AQI category against the card it is drawn on, counting the segment's outline where the fill alone is under 3:1.
- **A lens is a screen, not a chip.** Four lenses sharing one layout forced the worst case on all of
  them: a colour key that changed under you, a table switch that applied to whichever was showing,
  and the map wedged between the controls and the list. Three are routes now, so each gets the whole
  width. The lens lives in the path, which makes it deep-linkable and keeps the screen's state out of
  a chip.
- **The entry points preview their answer.** Each card at the foot of the Overview draws the real
  numbers it would show — a pollutant's spread, the share of days each pollutant led, the map's dots.
  A card that shows nothing until you open it is a button wearing a chart's clothes.
- **The card does not morph into the screen, and the code no longer pretends it does.** The intent
  was Material's container transform, with the card keeping its bounds across the push. Reanimated's
  `sharedTransitionTag` was wired on both ends, but on a release build on iOS 26 it never fired: a
  frame-by-frame look at the push shows the standard native slide, not a morph. Rather than leave a
  tag in the tree that reads as a feature and does nothing, it is removed. The navigation is a plain
  push, which is what the app actually does.
- **Bento grid was considered and rejected.** It is the current fashion for this kind of landing
  surface, but an asymmetric tile grid breaks the uniform scanning a ranked list depends on, and it
  would have put the ranking two taps away. The cards are a single column, in the order the questions
  get asked.
- **Each platform's own material for the pinned bar.** On iOS 26 `expo-glass-effect` draws it as
  Liquid Glass, so rows refract through it. Android has no glass, and chasing it with a blur would
  have meant a new dependency, wrapping the virtualised list in a `BlurTarget`, and the most
  expensive case there is — a blur behind a scrolling list — with no blur at all below Android 12.
  So Android gets Material's own answer instead: the bar is flat with a hairline at rest, and once
  rows pass under it the hairline gives way to elevation. The raised state flips at a threshold, so
  a scroll re-renders the bar twice rather than every frame. Either way the bar stays opaque, which
  is what the contrast check measures; the glass and the shadow are both additions on top, never
  what makes the controls legible.
- **Plus Jakarta Sans, not the system face.** Every type size keeps the `fontSize` and `lineHeight` it was checked at, so the Dynamic Type work still holds; only the glyphs change. Android does not synthesise weights for a custom family, so each weight is its own family name (`FontFamily`) and no style sets a `fontWeight`.
- **Cards lift with a shadow instead of only a colour change.** Three `elevation()` steps: list rows and section cards at 1, the verdict at 2, and 3 for anything over the page. Shadows are decorative, so nothing depends on seeing them.
- **Radii are named** (`Radius`), one step per surface size, with `medium` set to the 16pt that most surfaces already used so naming them reshaped nothing.
- **Rows fade in and lift as they arrive,** staggered 45ms for the first eight. Opacity and transform only, so a row holds its final space from the first frame and the list scrolls to the same offsets either way; `ReduceMotion.System` hands the choice to the OS setting.
- **Every chart has a generated sentence** that is both its caption and its spoken label.
- **The hourly trend is an adjustable element,** with actions that jump to the highest and lowest values.
- **Text scaling is capped only where it would break the layout** (titles at 2×, the AQI figure at 1.5×). Everything else follows the system size.

## Android

- **`removeClippedSubviews={false}` on the Overview list.** With the pinned controls, Android's default clipping crashed Fabric ("addViewAt: failed to insert view") when the rows arrived.
- **The release build allows plain http** (`usesCleartextTraffic`), so a phone can reach the API over the same Wi-Fi. A deployed API would use https and drop this setting.
- **No Google Maps key, so the Android build says so instead of crashing.** Google Maps needs a key and a billing account; the Map lens checks for one and falls back to a card explaining it, with the same cities in the list below. iOS keeps Apple Maps, which needs no key.
- **The APK is built for arm64 only.** Current Android phones are arm64, and one architecture keeps the build within an 8 GB machine's memory.
