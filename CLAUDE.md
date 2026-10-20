# CLAUDE.md: Personal Workout Log PWA

A personal-use workout tracker inspired by the *flows and features* of the Arrow workout app (formerly Levels, by LevelUp App Studios). Single user, no accounts. Its sole purpose is to be a personal hub for workouts: plan the week, preview it, log sessions, and review history and progress. No social features and no gamification of any kind (see "Removed on purpose").

## Ground rules
- Recreate features and flows from the descriptions in this file only. Do NOT copy Arrow's code, assets, icons, name, or branding. Use original UI, name, and wording.
- Personal use only: no auth, no analytics, no third-party tracking.
- Offline-first. The app must work with zero network after first load.
- Never lose workout data. Autosave the in-progress workout after every set change. Resuming must always be possible; "discard" requires an explicit confirmation. (A known complaint about Arrow is that ending a restarted session drops it, so avoid that.)

## Removed on purpose (do NOT build, do NOT leave stubs or empty tabs)
The reference app is a social, gamified product. Delete all of that. This app has none of the following, anywhere (screens, copy, data model, settings, notifications):
- Friends tab, followers, feed, other people's profiles, sharing ("Share Workout"), invites, leaderboards, comparing with others
- Levels, XP, level progress bars, scores (the reference's score ring), trophies, achievements, badges, challenges, goals with rewards
- Streaks: no streak counters, streak screens, flame icons, or "you're about to break your streak" copy. Rest days are just a plan type.
- Celebration screens, confetti, or animations whose only job is to reward. The post-workout "streak", "trophy", "level" and "score" screens from the reference are NOT built; after ending a workout, go straight to the plain summary.
- Nutrition tab (out of scope)
- Avatar, username, level badge on the avatar, "Add some friends", the shop/bag icon, the 3 empty "+" slots under the stats, Weekly challenges bar, Streak Multiplier card, Next Trophy card, Friend Leaderboard card, the "Diamond" premium-tier card, and the early-access/beta sign-up banner on the reference Profile tab
- Steps / Apple Health connection (not possible in a PWA, and out of scope)
- Accounts, login, cloud profile, analytics, push notifications
Plain data is fine and wanted: PRs shown as facts, volume, time, history, charts.

## Stack
- React + TypeScript + Vite, `vite-plugin-pwa` (Workbox) for manifest and service worker
- Tailwind CSS, mobile-first (design for a ~390px phone screen, thumb-reachable controls)
- Dexie (IndexedDB) as the primary data store
- Recharts for charts
- Optional phase 2: small Node (Fastify) + SQLite server on the home network that serves the built app and offers backup/sync endpoints

## Hosting on Wi-Fi (important)
Service workers and "Add to Home Screen" install need HTTPS (localhost is the only exception). Plain `http://192.168.x.x` will NOT install as a PWA.
- Default plan: run the server on my computer and expose it with **Tailscale** (`tailscale serve`) for a trusted HTTPS URL that also works away from home.
- Fallback: `mkcert` local certificate for LAN-only use.
- Document the exact commands in README.md.

## Core features (MVP)
1. **Active workout screen**: add exercises, log sets (weight x reps; a set counts as logged once both are filled, there is no separate done checkbox), add/remove/reorder exercises, per-exercise and workout notes, workout timer.
2. ~~Rest timer~~: removed by owner decision (2026-10-19). Do not build, even though the reference has one.
3. **Exercise library (a headline feature)**: a HUGE built-in list (target 800+ exercises) with search, filters (muscle, equipment, category), and custom exercises. Every exercise has a **detail view with a human-body diagram (front and back) that highlights the targeted muscles**: primary muscles in a strong color, secondary muscles in a lighter shade. The same mini diagram appears on exercise cards in the picker and in the active workout. See "Exercise data and muscle diagram" below.
4. **Templates/routines**: save a workout as a template, start a workout from a template, prefill from last session.
5. **History**: list of past workouts, open one to view or edit, delete with confirmation.
6. **Last session + PR at a glance (headline feature)**: while logging any exercise, show a header on that exercise card with (a) **Last workout**: the weight x reps for each set from the most recent completed session of that exercise, with its date, and (b) **PR**: my best weight and the reps I did at it, plus my best reps at other key weights if useful. Also show the matching previous set (weight x reps) inline next to each set row. Tapping a previous value copies it into the current set. This must work fully offline, load instantly (index `sets` by exerciseId + completedAt), and show a clear "No history yet" state for new exercises.
7. **PRs**: detect and flag new records (heaviest weight, best estimated 1RM, rep PRs) during logging. The PR shown in the header (feature 6) must update live the moment a new PR is logged, Mark it with a plain "PR" label on the set; no animation, points, or badges.
8. **Progress**: per-exercise charts (est. 1RM, volume, top set over time) and weekly volume per muscle group.
9. **Week preview and planning**: plan each day (workout, rest, or activity), preview the week, start the planned workout. See "Workout tab" below.
10. **Settings**: kg/lb, weight step, erase-all-data danger zone. Dark UI only (no theme toggle). No export/import (owner decision 2026-10-19).

## Data model (Dexie tables)
- `exercises`: id, name, category, equipment, primaryMuscles[], secondaryMuscles[], instructions[], images[]?, isCustom, notes (muscles use the app's own canonical muscle enum, see below)
- `workouts`: id, name, startedAt, endedAt, status('active'|'done'), notes, templateId?
- `workoutExercises`: id, workoutId, exerciseId, order, notes
- `sets`: id, workoutExerciseId, order, weight, reps, rpe?, done, completedAt, isPR
- `settings`: key, value

Use UUIDs and `updatedAt` on every row so sync can be added later without migration pain.

## Exercise data and muscle diagram
**Data source (license matters):** use an openly licensed dataset, not content scraped from Arrow.
- Preferred: `free-exercise-db` (github.com/yuhonas/free-exercise-db), public-domain JSON with ~800+ exercises, each with primary/secondary muscles, equipment, category, instructions, and photos. Verify the license in the repo before using.
- Alternative: the wger API/dataset (check its per-asset licenses; some are CC-BY-SA and need attribution).
- Write a one-time build script (`scripts/build-exercises.ts`) that downloads the dataset, maps its muscle names to the app's canonical muscle enum, and writes a single `exercises.seed.json` committed to the repo. At runtime, seed Dexie from that file on first launch. No runtime network calls.
- Cache exercise photos with the service worker (or bundle a compressed subset) so they work offline. Keep total install size reasonable; use WebP.
- Flag any exercise whose muscles fail to map, and fix the mapping instead of dropping the exercise.

**Canonical muscle enum:** chest, front-delts, side-delts, rear-delts, biceps, triceps, forearms, abs, obliques, traps, upper-back, lats, lower-back, glutes, quads, hamstrings, adductors, abductors, calves, neck.

**Diagram component** (`<MuscleMap primary={[]} secondary={[]} />`):
- Render a front and a back body silhouette side by side as inline SVG, with one `<path>` per muscle region and `data-muscle` attributes.
- Fill primary muscles with the accent color and secondary muscles with a lighter tint; unselected muscles stay a neutral gray. Must work in dark and light themes.
- Fastest route: try the MIT-licensed `react-body-highlighter` package first (verify license and that the muscle regions cover the enum above). If it falls short, draw original SVG paths. Do not copy Arrow's artwork.
- Provide a small variant (about 64px) for list cards and a large variant for the detail view.
- Tapping a muscle on the diagram filters the exercise list to that muscle (nice-to-have).

## Screens
Bottom tab nav (reference app has Profile | Friends | Workout | Nutrition | Stats): build **Profile** | **Workout** | **Stats** (history + progress charts). Profile is a personal overview page, specified in the "Profile tab" section below. Skip Friends and Nutrition entirely. The exercise library is NOT a tab: it opens from "Add Exercise" inside the Workout tab (see below). The active "log your sets" screen was not in the recording, so use features 1, 2, 6 and 7 above for it.

## Workout tab (spec from a screen recording of the reference app)
Replicate this layout and behavior closely. Use original icons, artwork, wording and name (see ground rules); only the layout, flow, and color mood are being matched.

**Look and feel**
- Dark UI only. App background near-black (~#0c0d0f), cards ~#1b1b1b with a slightly lighter inner panel (~#1e2020), very large corner radii (cards ~24px, buttons fully pill-shaped), generous padding.
- One accent green (~#2bc231) used for the primary CTA, selected segmented-control pill, radio dots, and primary muscle highlights. Secondary muscles use a paler green (~#7baf7f). Muted gray text for secondary info.
- Bold, large-ish sans-serif titles. Bottom tab bar: icon over a small label, active tab white, inactive gray.
- Sheets slide up from the bottom with a dimmed backdrop; loading states use a thin circular spinner.

**1. Workout tab home (the main screen)**
- Header, left: the plan name for the selected day as a large title (e.g. "Leg Day") with the date under it in gray (MM/DD/YYYY). Header, right: a round icon button (kettlebell-style icon, opens the same exercises library) and a pill button labeled "Workouts" (opens the Workouts screen).
- **Week strip** under the header: left and right chevrons to change week, 7 round day buttons (S M T W T F S letters under the day numbers). The selected day has a small white dot under its letter and a brighter circle. The day number color shows what is planned: white = workout planned, light blue = rest day, gray = nothing planned; a **green filled circle = a workout was completed that day** (the header title also turns green for that day). Tapping a day changes the header title/date and the card below.
- **Day card** (large rounded card, horizontally swipeable, with pagination dots below it. Confirmed from the video: one page per workout planned that day plus a trailing page with the "+" button, so a day can hold several workouts, e.g. Leg Day, Chest day, then "+". Start Workout starts the workout on the visible page):
  - *Planned workout*: title, a gray subtitle "Prev. <total volume> · <duration>" from the last time this workout was done (e.g. "Prev. 4.7k kgs · 1h 3m"; shows "Prev. None" if never done), and a round "..." menu button at the top right of the card. Inside, a darker panel with a "Planned Workout" chip, the **front and back body diagrams** showing every muscle the workout hits (primary bright green, secondary pale green), then the exercise names as centered chips (first 3 shown, then a "+N more" chip).
  - *Completed workout*: title "Workout Review" with the workout name under it and an eye icon at top right (opens the saved workout summary). Body diagram of the muscles trained, then three stat tiles: PRs (count), Volume, Time. Start Workout is disabled.
  - *Rest day*: title "Rest Day", subtitle "Recovery day", a big dim moon icon, and a small "Log a workout" chip at the bottom of the panel.
  - *Past day with nothing planned or logged*: title "No Workout", subtitle "Nothing logged", dim moon icon.
  - *Future day with nothing planned*: title "Not Planned Yet!", a centered round "+" button with the text "Tap + to plan a workout or add a rest day."
  - *Today with nothing planned*: the same "+" empty state as above, but "Start Workout" is enabled.
- **Start Workout**: a full-width green pill pinned above the tab bar. Enabled only for today when a workout is planned (or empty-state freestyle). Disabled (dark, dim text) for past/future days and rest days. A day with no plan is titled "Freestyle" and can still start an empty workout.

**2. Plan-the-day sheet** (opens from the "+" button or the "..." menu)
- Full-height sheet with a back chevron on the left, the date centered ("Oct 19, 2026"), and a "+" button on the right (creates a new workout).
- Sections: **Presets** (rows: "Rest" with a moon icon, "Activities" with a shoe icon for cardio/other activities) and **Your Workouts** (the user's saved workouts, e.g. "Leg Day", "Chest day"). Each row has a radio circle on the right; the selected one shows a green dot. Single-select.
- Bottom CTA is context-aware: disabled "Change to Selection" while nothing has changed; "Set <Workout Name> for Today" (or the date) when a workout is selected; "Set as Rest Day" when Rest is selected. The CTA shows a brief loading state, then the sheet closes and the card updates. Observation: the Rest preset was missing from this sheet on one visit (Oct 19, after a workout was already planned that day); treat it as "hide Rest if the day already has a started or logged workout" and confirm with me if unsure.

**3. Workouts screen** (from the "Workouts" pill)
- Back chevron + centered title "Workouts". A two-option segmented control: **Workouts** | **Routines** (selected one is a filled green pill). "Routines" is a multi-day plan list; build it after everything else, as an empty placeholder first.
- List of saved workouts as full-width rows with a trailing chevron; tapping opens the workout editor.
- Green "Create Workout" pill pinned at the bottom.

**4. Create / edit workout flow**
- Tapping "Create Workout" first opens a small centered modal sheet: muscle-icon badge, title "Workout Name", helper text "Name your workout. You can edit it later.", a text input (auto-focused, keyboard opens), and a green "Confirm Workout Name" button that is disabled until text is entered.
- Then the **Create Workout** screen: back chevron, centered title, and a red round trash button at the top right (delete with confirmation). A card shows the workout name with a pencil icon (tap to rename using the same modal), the list of exercises (each row has a drag handle on the right for reordering), and an "+ Add Exercise" row with a plus-in-circle icon.
- "Save Workout" green pill at the bottom. While saving, dim the screen with a spinner; then return to the Workouts list, where the new workout now appears. Opening an existing workout uses this same screen.

**5. Add Exercise (exercise library)**
- Top bar: back chevron, a segmented control **Exercises** | **Activities**, and a "+" button on the right (create custom exercise/activity).
- Search field ("Search") with three filter chips below: **Muscle Group**, **Primary Muscle**, **Classification** (each opens a picker; chips show active state).
- Alphabetical list with sticky letter headers (A, B, C...), rows with the exercise name and a trailing chevron. Some rows also show a small clock icon before the chevron (appears on e.g. Abductor Machine and Adductor Machine; probably "recently used", so show it for exercises I have logged recently).
- Tapping a row opens the **Exercise detail** screen:
  - Back chevron, exercise name centered, a "+" button on the right (adds it to the workout being built, then returns). Under the title: "Class: <classification>" (e.g. "Body Weight/Weighted").
  - Large card with front and back body diagrams, targeted muscles in green.
  - A small stats card: "No data / Log this exercise first" with a green edit icon when there is no history; once logged, show last workout and PR (feature 6 above).
  - **PR Progress** card: a segmented toggle "PR" | "Vol." and a chart, with a range selector "Month | Year | All Time". Empty state: icon, "No Data", "Log this exercise to activate insights and data."
  - **Primary muscles:** and **Secondary muscles:** listed as label + gray value (e.g. "Abs", "Obliques").
- Each exercise needs a "classification" field (e.g. Body Weight/Weighted, Machine, Barbell, Dumbbell, Cable); derive it from the dataset's equipment/category, and add it to the `exercises` table.

**Data model additions**
- `plans`: id, date (YYYY-MM-DD, unique), type ('workout'|'rest'|'activity'), workoutId?  (one row per planned day; drives the week strip and day card)
- `routines`: id, name, days[] (later)
- `workouts` (saved definitions, the "Your Workouts" list) are separate from `workoutLogs` (completed sessions): templates in the earlier model map to saved workouts. Keep `workoutLogs` for history and the "Prev. volume · duration" subtitle.
- `workoutExercises` entries in a saved workout need an `order` field for drag reordering.

**Acceptance checklist for this tab**
- No streak, level, score or trophy UI anywhere.
- Switching days in the week strip updates the title, date, and card instantly, with no network.
- Planning a day from the sheet updates the card and the day-number color without a reload.
- Start Workout is disabled everywhere it is disabled in the reference (past, future, rest).
- Body diagram on the day card is the union of muscles across all exercises in the workout.
- Creating, renaming, reordering, saving and deleting a workout all persist after refresh.

## Active workout (spec from the second screen recording)
Tapping **Start Workout** slides the Workout tab into this screen. The bottom tab bar stays visible. Autosave after every edit (ground rules).

**Header**: workout name (large) with a count-up timer under it (mm:ss). Right side: a red round **X** button (discard workout; always confirm) and a white pill **End Workout**.

**Exercise pager**: one full card per exercise, swiped horizontally (neighbor cards peek at the edges), with page dots under the card (one per exercise). Each card has:
- Exercise name; a small info "i" icon next to it on some exercises (opens form info/instructions from the dataset); a round "..." menu at top right (replace/remove exercise, notes).
- A **Unilateral** toggle under the name. Off: each set is one row. On: each set splits into two stacked rows labeled **R** and **L**, each with its own kgs and reps.
- **Set rows**: set number, a green circular-arrows icon (copies the previous set's values into this set), a weight field ("kgs") then "x" then a reps field ("reps"). Empty fields show **greyed placeholders with last session's values for that same set** (e.g. 20 kgs x 9 reps); typing replaces them. This is the "last workout" feature from the spec above and must be implemented exactly this way. Bodyweight exercises show "BW" in the weight field and use an mm:ss time field instead of reps (e.g. glute bridge).
- The exercise's own front and back **body diagram** below the sets, primary muscles bright green, secondary pale green.
- Three buttons under the diagram: **Remove Set** (red), **Drop Set** (neutral), **Add Set** (green). A drop set adds a linked set row at reduced weight.
- Also show, on this card, the PR header from feature 6 (last workout and PR with weight and reps). The reference does not show it here; that is my addition.

**Custom number pad** (replaces the system keyboard, docked at the bottom, covers the tab bar while open):
- Layout: left column with step buttons (**+2.5 / -2.5** when editing weight, **+1 / -1** when editing reps) and a stacked-lines icon; center digits 1-9, 0, "." (dimmed for reps) and backspace; right column with a copy icon (copy previous set's value), a tall **Next** button (jumps to the next field: weight, then reps, then the next row), and a keyboard-hide icon.
- The field being edited shows a text cursor. Weight step size should be configurable (2.5 kg / 5 lb default).

**Rest timer bar**: NOT built (owner decision 2026-10-19). Workout notes live in the exercise card's "..." menu and the review screen instead.

**Ending a workout**
1. **End Workout** (the white pill) opens the **review screen** (not a confirmation). Header: back chevron, workout name centered, pencil icon on the right (edit sets). Content, top to bottom: a note "Review your workout before you finish. You can go back to edit your sets", two stat tiles (**Total Time**, **Volume** in kgs), the body diagram of muscles trained with a muscle-name chip (e.g. "Quads"), a **PRs** card listing each new PR as exercise name + weight x reps with a star icon, then one card per exercise with every set listed (Set 1, Set 2... with R/L rows and weight x reps).
2. Two pinned buttons at the bottom: white **Save Workout** and green **End Workout**. End Workout shows a spinner, logs the session, and goes to the summary. Save Workout = save this session's exercises, sets, and weights back to the saved workout (so next time starts from them) and keep the session open (confirmed by owner 2026-10-19).
3. **Workout summary** screen: back chevron, workout name, large body diagram of muscles trained, two tiles (**Time**, **Volume**), and a **Back to Home** button. No Share button.
4. Back on the Workout tab, that day's circle is now green and its card shows the "Workout Review" card described above.

**Definitions**
- Volume = sum of weight x reps over every logged set, counting R and L rows separately (e.g. 20kg x 25 x2 + 25kg x 6 x2 = 1,300 kg, shown as "1.3k kgs"). Show "k" above 1,000.
- A PR is any set that beats the stored best for that exercise (heaviest weight; ties broken by reps; also best e1RM). Count unilateral sides separately.
- The "Prev. 4.7k kgs - 1h 3m" subtitle on the planned card is the previous session's volume and duration for that workout.

**Data model additions for this screen**
- `sets`: add `side` ('R'|'L'|null), `isDrop` (bool), `durationSec?` (for timed/bodyweight holds), and make `weight` nullable (null = bodyweight).
- `workoutExercises`: add `unilateral` (bool).

## Profile tab (spec from the third screen recording)
The reference Profile tab is mostly social and gamified. Build ONLY the parts below, in this order, as one scrolling page with the same dark card style as the Workout tab. Everything else on that tab is deleted (see "Removed on purpose").
1. **Top bar**: a gear icon button at the top right that opens Settings (kg/lb, weight step, danger zone to erase data). No avatar, name, level badge, flame/streak chip, or shop icon.
2. **All-time totals row**: three centered stats separated by thin vertical dividers, each with a small icon above a value and a label: total training **time** (e.g. "1h 4m"), total **volume** (e.g. "6k kgs"), and number of **workouts** (e.g. "2 workouts"). These are sums over every logged workout (checked against the video: 4.7k + 1.3k volume = 6k, 2 workouts).
3. **Muscles this week** card: a title with a large green percentage under it (e.g. "9%"), a small expand icon at the top right (opens the diagram full screen), and a big front and back body diagram with every muscle trained this week highlighted in green (primary bright, secondary pale). My reading of the percentage (not stated in the video): the share of the app's muscle regions that were trained at least once in the current Monday-to-Sunday week. Show the formula in a tooltip or the full-screen view so it is not a mystery.
4. **Week Overview** card: title "Week Overview" with a "Start Workout" pill at the right (starts today's planned workout; disabled if none), and the same 7-day strip as the Workout tab (green circle = completed day, light blue number = rest day, white = planned). Tapping a day jumps to that day on the Workout tab.
Nothing else on this tab. No streaks, no levels, no trophies, no leaderboard, no upsell cards.

## Build order
1. Scaffold Vite + PWA, Tailwind, Dexie schema
2. Exercise dataset build script, canonical muscle mapping, seeding, `MuscleMap` component, exercise library and detail screens
3. Workout tab: week strip, day cards, plan-the-day sheet, Workouts screen, Create/Edit workout flow (see "Workout tab" section)
4. Active workout logging with autosave and resume (Start Workout from the tab opens this)
6. History and previous-performance display
7. Templates
8. PR detection and progress charts
9. Profile tab (totals, muscles this week, week overview)
10. PWA polish (icons, install prompt, offline test)
11. Phase 2: Fastify + SQLite backup/sync

## Quality bar
- Logging a set should take at most 2 taps after entering numbers.
- Large tap targets, number inputs use `inputmode="decimal"`, no zoom-on-focus.
- Lighthouse PWA checks pass; app loads in airplane mode.
- Unit tests for e1RM, PR detection, and volume totals.
- Keep README.md updated with run, build, and hosting steps.

## My preferences (fill these in)
- Training style: <e.g. push/pull/legs, upper/lower, powerlifting>
- Units: <kg or lb>
- Must-have features not listed above: <...>
- Things I disliked in Arrow: <...>
- App name: <...>
