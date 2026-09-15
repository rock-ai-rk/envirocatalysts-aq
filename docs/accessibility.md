# Accessibility check results

Checked on 15 Sep 2026 against WCAG 2.1 AA and the assignment's accessibility requirements.
The two main screens are covered: Overview & Comparison, and Hourly Analysis.

## What was checked, and how

| Check | How | Result |
|---|---|---|
| Colour contrast (text 4.5:1, UI parts 3:1) | `npm run check:contrast` ([`mobile/scripts/check-contrast.mjs`](../mobile/scripts/check-contrast.mjs)), which checks every text/background pairing in the light and dark palettes and the label colour on every AQI category and pollutant colour | 59 / 59 pairings pass |
| Largest text sizes (Dynamic Type) | iPhone 17 simulator at the *Accessibility Large* text size, both screens and the sheets | 8 problems found, all fixed (below) |
| Small screen, 375 pt wide (iPhone SE width) | The same React Native layout rendered at 375 × 667 in a browser; on 16 Sep, the Overview on the iPhone SE (3rd gen) simulator | Fits without truncation. On the SE the Overview's verdict is fully visible without scrolling. **The Hourly screen on the SE simulator is still to check.** |
| Standard phone, 402 pt (iPhone 17) | iOS simulator | Fits |
| Dark mode | iPhone 17 simulator | All text, chips, badges and the chart stay readable ([screenshot](accessibility/iphone17-dark-hourly.png)) |
| Nested interactive elements | Dev build in a browser, which rejects a `<button>` inside a `<button>` | 1 problem found and fixed (below) |
| Screen reader semantics | Code review of labels, roles and states (details below) | Built in. **A VoiceOver pass on a real iPhone is still to do**, because VoiceOver doesn't run in the simulator. |
| Automated audit | Xcode Accessibility Inspector | **To be run by the author**, steps below |

## What broke, and what was fixed

All of these showed up at the largest text sizes unless noted.

1. **Coverage pill cut off.** "94% data · ⚠ PM2.5 flagged" became "94% dat…", which hid the warning. The pill now wraps instead of truncating.
2. **City names cut off.** "Chamarajanagar" became "Chamara…". Names now wrap.
3. **Numbers inside the stacked bars clipped** at the top and bottom. The bar now grows with its text, and those numbers scale up to 1.6×. The same numbers appear at full size in the row's headline and in its spoken summary.
4. **Period toggle truncated** to "FY 2… · FY 25… · Chan…". Above a 1.3× text scale the three options now stack vertically, as iOS does with its own controls.
5. **The trend window's dates were squeezed** between the Earlier and Later buttons, one word per line. At large text the dates now get their own line above the buttons.
6. **The chart readout's last line was truncated** ("Highest 280 on 29 Mar…"). It is kept to one line at normal sizes, so the plot doesn't shift under the finger while scrubbing, and wraps at large sizes.
7. **Chart axis labels wrapped** ("25 / Mar") into the text below. They now scale up to 1.3× and stay on one line. The readout and the spoken summary carry the same information at full size.
8. **Coverage sheet.** The "70% needed" label under the bar was cut off and overlapped the first rule, and the ✓/✗ marks outgrew their circles.
   - The caption is now ordinary text below the bar, so it wraps.
   - The marks keep a fixed size. The words "met" / "not met" beside them scale.
9. **A button inside a button** (at every text size). The coverage pill sat inside the city row's button: touch worked, but VoiceOver couldn't focus the pill on its own. It is now a separate button below the row.

Screenshot after the fixes, at Accessibility Large: [Overview rows](accessibility/iphone17-large-text-overview.png).

### 16 Sep: the Overview's new top half

The verdict card, status capsules, "Right now" capsules and pinned controls were checked on the
iPhone SE (3rd gen) and iPhone 16 Pro simulators, in light and dark mode, at the default text size
and at the largest one (*Accessibility XXXL*). Screenshots: [`redesign/`](redesign/).

- **City rows at the largest size.** The headline figure ("319 good days") sat beside the city
  name and squeezed it to one letter per line. At large text sizes it now moves below the name.
  This predates the redesign: the earlier pass stopped at *Accessibility Large*.
- **Pinned controls.** The year toggle and lens chips stay pinned above the list, but not at large
  text sizes, where they would cover much of the screen. They then scroll with the page.
- **Rows of capsules.** The status capsules and the "Right now" capsules sit in one sideways row
  normally. At large text sizes they wrap or stack instead, so nothing is out of reach off-screen.
  Each tappable capsule has a 44 pt touch target.
- **Verdict card.** The sentence on the card is the one a screen reader hears, followed by the
  detail with its units written out ("micrograms per cubic metre"). It keeps the same height when
  it switches to Change, so the pinned controls below it don't jump.
- **Good green.** `#00B050` → `#009A47`, so Good and Satisfactory are easier to tell apart (see
  the README). The contrast check still passes all 59 pairings.

## Screen reader design

- **City rows.** Each row is one element that speaks everything its bars show, e.g. "1. Aizawl, Mizoram. FY 2024-25: 320 good and 32 satisfactory days, data on 96% of days". It has a hint that it opens the city's details. The coverage pill that follows is its own button: "data on 96% of days, meets the 70% rule".
- **Charts.**
  - Each chart carries a plain-language summary, which is also shown as a caption.
  - The hourly trend is an *adjustable* element: swipe up or down to step through the hours, each read out ("4 March 2025, hour ending 21:00: 187 micrograms per cubic metre, very poor").
  - Actions jump to the highest and lowest values.
  - TalkBack is sent an announcement on each step, since it doesn't read an adjustable element's new value on its own.
- **Choices.**
  - Filter, pollutant, range and period chips are radio buttons or checkboxes with their checked state.
  - Selected options are filled and show a ✓, so they don't depend on colour.
  - Abbreviated labels are spoken in full ("24 h" is read as "24 hours"; "FY 24-25" as "FY 2024-25").
  - Every touch target is at least 44 pt. The small coverage pill has an extended hit area.
- **Colour is never the only signal.**
  - AQI categories show colour, name and a six-step level meter (1 = Good … 6 = Severe).
  - Rules show ✓/✗ and the words "met" / "not met".
  - The two years in the Change view are told apart by solid versus dashed lines.
  - Warnings carry a ⚠ and words.
- **Live data.** The live cards say "ESTIMATE" and "from an air-quality model, not measured at this station" in words, and the AQI is read as one sentence ("Estimated air quality index 98, Satisfactory, driven by PM2.5…"). Units are spoken in full ("micrograms per cubic metre"). The source credit is a link with a 44 pt target.
- **Changes on screen.**
  - The offline banner and loading/empty/error messages are polite live regions.
  - Moving the trend window announces the new dates.
- **Keyboard and switch access.** Every pressable shows a visible focus ring.

## Still to do

### 1. Xcode Accessibility Inspector audit (author, about 10 minutes)

The assignment asks for an automated check's results. Accessibility Inspector is a separate macOS app, so it has to be run by hand:

1. Start the API and the app in the iOS simulator.
2. In Xcode: **Xcode → Open Developer Tool → Accessibility Inspector**.
3. In the inspector's target menu (top left), choose the **Simulator**.
4. Open the **Audit** tab and click **Run Audit**. Do this on the Overview screen, the Hourly screen, a city's coverage sheet and the station picker.
5. Take a screenshot of each result (⌘⇧4) and save it in [`docs/accessibility/`](accessibility/).
6. List below anything it flags, and whether it was fixed.

| Screen | Issues flagged | Fixed? |
|---|---|---|
| Overview | | |
| Hourly | | |
| Coverage sheet | | |
| Station picker | | |

### 2. VoiceOver on a real iPhone

Turn VoiceOver on (Settings → Accessibility → VoiceOver), open the app in Expo Go, and swipe through both screens. Check in particular:
- stepping through the trend chart, including the Jump to highest/lowest actions
- opening a coverage pill

### 3. The other screen sizes

- **iPhone SE simulator.** The native 375 pt check still needs the simulator access permission.
- **Android (TalkBack).** Not tested: no Android emulator is set up on this machine.
