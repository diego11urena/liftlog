# CLAUDE.md: Personal Workout Log PWA

A personal-use workout tracker inspired by the *flows and features* of the Arrow workout app (formerly Levels, by LevelUp App Studios). Single user, no accounts. Its sole purpose is to be a personal hub for workouts: plan the week, preview it, log sessions, and review history and progress. No social features and no gamification of any kind (see "Removed on purpose").

## Ground rules
- Recreate features and flows from the descriptions in this file only. Do NOT copy Arrow's code, assets, icons, name, or branding. Use original UI, name, and wording.
- Personal use only: no auth, no analytics, no third-party tracking.
- Offline-first. The app must work with zero network after first load.
- Every color comes from theme tokens defined in one file (see "Look and feel"). No hard-coded colors in components.
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
- Routines (multi-day plans) and Activities (cardio/other activities: the library's Activities tab, the plan sheet's Activities preset, activity day cards, cardio entries in the exercise list). Removed by owner decision 2026-10-19.
Plain data is fine and wanted: PRs shown as facts, volume, time, history, charts.

## Stack
- React + TypeScript + Vite, `vite-plugin-pwa` (Workbox) for manifest and service worker
- Tailwind CSS, mobile-first (design for a ~390px phone screen, thumb-reachable controls). The app is only ever used as an installed PWA on a phone, so it ALWAYS renders as a phone: max 430px wide and centered, even on a desktop browser. Fixed bars and sheets stay inside that frame.
- Dexie (IndexedDB) as the primary data store
- Recharts for charts
- Optional phase 2: small Node (Fastify) + SQLite server on the home network that serves the built app and offers backup/sync endpoints

## Hosting (owner decision 2026-10-19)
The app is a free PWA used only on the owner's iPhone, anywhere (Wi-Fi or cellular), never on the Mac.
- Hosted as a static site on the owner's free Vercel Hobby account: project `liftlog`, https://liftlog-livid.vercel.app. Deploy with `npx vercel deploy --prod`. Install from Safari → Share → Add to Home Screen.
- All data lives on the phone (IndexedDB, persistent storage requested). There is no server in production: `/api/sync` returns 404 there and the app stops trying to sync.
- The Mac sync server (`server/`, `npm run serve`, `npm run install-service`) still exists for local use, and `scripts/export-link.ts` turns its SQLite copy into a one-time `#import=` link that moves data to a new address. The Tailscale plan is dropped.

## Core features (MVP)
1. **Active workout screen**: add exercises, log sets (weight x reps; a set counts as logged once both are filled, there is no separate done checkbox), add/remove/reorder exercises, per-exercise and workout notes, workout timer.
2. ~~Rest timer~~: removed by owner decision (2026-10-19). Do not build, even though the reference has one.
3. **Exercise library (a headline feature)**: a CURATED built-in list of about 300 exercises people actually do in a gym (not the full 800+ dataset), with common gym names and aliases, search, filters (muscle, equipment, classification), and custom exercises. Every exercise has a **detail view with a detailed human-body diagram (front and back) that highlights the targeted muscles**: primary muscles in the accent color, secondary muscles in a lighter shade. The same mini diagram appears on exercise cards in the picker and in the active workout. See "Exercise data and muscle diagram" below.
4. **Saved workouts (templates)**: save a workout as a template, start a workout from a template, prefill from last session.
5. **History**: list of past workouts, open one to view or edit, delete with confirmation.
6. **Last session + PR at a glance (headline feature)**: while logging any exercise, show a header on that exercise card with (a) **Last workout**: the weight x reps for each set from the most recent completed session of that exercise, with its date, and (b) **PR**: my best weight and the reps I did at it, plus my best reps at other key weights if useful. Also show the matching previous set (weight x reps) inline next to each set row. Tapping a previous value copies it into the current set. This must work fully offline, load instantly (index `sets` by exerciseId + completedAt), and show a clear "No history yet" state for new exercises.
7. **PRs**: detect and flag new records (heaviest weight, best estimated 1RM, rep PRs) during logging. The PR shown in the header (feature 6) must update live the moment a new PR is logged. Mark it with a plain "PR" label on the set; no animation, points, or badges.
8. **Progress**: per-exercise charts (est. 1RM, volume, top set over time) and weekly volume per muscle group.
9. **Week preview and planning**: plan each day (workout or rest), preview the week, start the planned workout. See "Workout tab" below.
10. **Settings** (opens from the gear on the Profile tab): a "Move data here" box (paste a one-time `#import=` link; needed because iPhone Home Screen apps don't share Safari's storage; this is a migration tool, not the removed backup export/import) and the erase-all-data danger zone. There is no app-wide kg/lb or weight-step setting: units are chosen per exercise while logging (owner decision 2026-10-19). That is the complete list; there is no reference recording to match (owner, 2026-10-19). Light UI only, no theme toggle (the palette lives in theme tokens so a dark theme could be added later). No export/import (owner decision 2026-10-19).

## Data model (Dexie tables)
- `exercises`: id, name, aliases[], category ('strength'), classification, equipment, primaryMuscles[], secondaryMuscles[], instructions[], images[]?, isCustom, notes, timed?, unit? ('kg'|'lb', default kg) (muscles use the app's own canonical muscle enum, see below)
- `workouts`: id, name, startedAt, endedAt, status('active'|'done'), notes, templateId?
- `workoutExercises`: id, workoutId, exerciseId, order, notes
- `sets`: id, workoutExerciseId, order, weight, reps, rpe?, done, completedAt, isPR
- `settings`: key, value

Use UUIDs and `updatedAt` on every row so sync can be added later without migration pain.

## Exercise data and muscle diagram
**Curated list, not the whole dataset.** The big open dataset has many obscure entries ("Venn press") and files common ones under odd names (the pec deck is "Butterfly" in some datasets).
- Target about 300 exercises that people actually do in a commercial gym, named the way gym machines are labeled: "Seated Leg Extension Machine", "Pec Deck (Machine Fly)", "Lat Pulldown", "Incline Dumbbell Press", "Cable Crossover".
- Build `scripts/curated-exercises.json`: each entry has `name`, `aliases[]`, `classification`, `primaryMuscles`, `secondaryMuscles`. Use the open dataset only as a source of instructions and photos when a curated entry matches one; otherwise write the entry by hand.
- Preferred dataset: `free-exercise-db` (github.com/yuhonas/free-exercise-db), public domain; verify the license in the repo. Alternative: wger (check per-asset licenses; some are CC-BY-SA and need attribution).
- Search must match aliases: "pec deck", "pec fly", "chest fly machine", "machine fly" and "butterfly" all find the same exercise.
- Must include at minimum: pec deck, reverse pec deck, cable fly, cable crossover, dumbbell fly, bench press (barbell, dumbbell, incline, decline, machine), chest press machine, lat pulldown, seated cable row, T-bar row, leg press, hack squat, leg extension, leg curl (seated and lying), hip abductor and adductor machines, calf raise (standing and seated), shoulder press (machine and dumbbell), lateral raise (dumbbell, cable, machine), face pull, preacher curl, hammer curl, triceps pushdown, overhead triceps extension, dips, pull-ups, deadlift variations, Romanian deadlift, hip thrust, glute bridge, cable kickback, ab crunch machine, cable crunch, hanging leg raise, plank.
- Everything not on the curated list is not imported. Custom exercises (the "+" button) cover the long tail.
- A `scripts/check-exercises.ts` report prints curated entries missing primary muscles, aliases or classification; the build fails if any are incomplete.
- As built (2026-10-19): 281 entries (activities removed). Entries may use region shorthands (`chest`, `quads`, `triceps`, `mid-back`, ... defined in `src/muscles.ts`) that the build expands, and an optional `timed: true` (logged as mm:ss). 164 entries carry dataset instructions/photos via exact name/alias match or the hand-confirmed `DATASET` table in the build script. On upgrade, logged history on old dataset exercises moves to the curated entry that replaced them; old exercises in use without a replacement are kept as custom.
- A one-time build script (`scripts/build-exercises.ts`) merges the curated list with the dataset and writes a single `exercises.seed.json` committed to the repo. At runtime, seed Dexie from that file on first launch. No runtime network calls.
- Cache exercise photos with the service worker (or bundle a compressed subset) so they work offline. Keep total install size reasonable; use WebP.

**Muscle regions (the canonical enum), about 40:** chest-upper, chest-lower, delt-front, delt-side, delt-rear, rotator-cuff, biceps, brachialis, triceps-long, triceps-lateral, triceps-medial, forearm-flexors, forearm-extensors, brachioradialis, abs-upper, abs-lower, obliques, serratus, hip-flexors, traps-upper, traps-middle, traps-lower, rhomboids, lats, teres, erector-spinae, glutes-max, glutes-med, quads-rectus-femoris, quads-vastus-lateralis, quads-vastus-medialis, adductors, abductors, hamstrings-biceps-femoris, hamstrings-semitendinosus, calves-gastrocnemius, soleus, tibialis, neck.
- Curated entries set regions by hand. When mapping a coarse dataset muscle (chest, shoulders, quadriceps, hamstrings, etc.), map it to a sensible default set of regions and flag it for review; never drop an exercise because a muscle failed to map.

**Diagram component** (`<MuscleMap primary={[]} secondary={[]} />`): MUCH more detail than a basic silhouette.
- The current diagram (react-body-highlighter) is too coarse: few regions and no internal detail. Replace it.
- Requirement: a detailed anatomical figure, front and back, in the style of a muscle chart: a light gray silhouette with visible muscle separation lines and fiber-like shading, where highlighted muscles light up in the accent color.
- Each region is its own SVG `<path>` with a `data-muscle` attribute, independently highlightable.
- Do NOT copy or trace the Arrow app's artwork. Find an openly licensed, detailed anatomical illustration (public domain, CC0, or MIT-licensed SVG assets) and turn it into per-region SVG paths. Record the source and license in `docs/ASSETS.md`. If no suitable asset exists, draw an original one; stop and tell me before settling for a low-detail figure.
- Primary muscles use the accent color, secondary muscles the soft accent, unselected muscles stay the neutral figure color.
- Variants: small (about 64px) for list cards and a large variant for detail views. Quality check: render at 64px, 180px and 340px wide; at 340px the separation lines and individual muscle shapes must be clearly visible. Add a `/dev/muscles` page that lights each region one at a time.
- Tapping a muscle on the diagram filters the exercise list to that muscle (nice-to-have).
- As built (2026-10-19, owner chose this source): MuscleMap (MIT, github.com/Jsplice/MuscleMap) male front/back paths, split into our regions by `scripts/build-body.ts` → `src/data/body.json`; separation lines and per-muscle fiber hatching are our own. 38 of 39 regions have art: `neck` lights the upper traps; `brachialis` is one small shape on one arm. Details in `docs/ASSETS.md`. Check page: `/dev/muscles`.

## Screens
Bottom tab nav (reference app has Profile | Friends | Workout | Nutrition | Stats): build **Profile** | **Workout** | **Stats** (history + progress charts). Profile is a personal overview page, specified in the "Profile tab" section below. Skip Friends and Nutrition entirely. The exercise library is NOT a tab: it opens from "Add Exercise" inside the Workout tab (see below). The active workout screen is specified in the "Active workout" section below.

## Workout tab (spec from a screen recording of the reference app)
Replicate this layout and behavior closely. Use original icons, artwork, wording and name (see ground rules); only the layout, flow, and color mood are being matched.

**Look and feel (LIGHT theme, our own palette: not Arrow's green)**
- Light UI. The app is a phone-width PWA (see Stack). Define these as CSS variables / Tailwind theme tokens in one file: `--bg #F6F6F3` (page), `--card #FFFFFF` with a soft shadow (`0 1px 2px rgba(17,19,24,.06)`) and a hairline border `#E6E6E1`, `--panel #F0F0EC` (inner panels), `--text #111318`, `--text-2 #6B6F7A`, `--accent #2F5BFF` (primary buttons, selected pills, radio dots, primary muscles, completed-day circle), `--on-accent #FFFFFF`, `--accent-soft #9DB4FF` (secondary muscles), `--figure #D9DBE1` and `--figure-lines #B4B8C4` (body figure base and muscle separation lines), `--rest #14B8A6` (rest-day marker), `--danger #E5484D` (remove set, discard, delete).
- Very large corner radii (cards ~24px, buttons fully pill-shaped), generous padding. Bold, large-ish sans-serif titles. Bottom tab bar: icon over a small label, active tab in `--accent`, inactive `--text-2`.
- The reference's white pill buttons (End Workout in the header, Save Workout, Back to Home) become: header End Workout = solid `--text` pill with white text; Save Workout = outlined pill; the reference's green pills (Start Workout, Create Workout, Save Workout in the editor, End Workout on the review screen, Add Exercise) = solid `--accent` pills with `--on-accent` text. Disabled buttons use a muted `--panel` fill with `--text-2` text.
- Sheets slide up from the bottom with a dimmed backdrop; loading states use a thin circular spinner.
- Check contrast: text and the accent must meet WCAG AA on their backgrounds. The accent may change later; changing the tokens must be enough.
- Contrast check results (2026-10-19): three spec values failed AA and were darkened the minimum needed: `--text-2` #6B6F7A → #676B76 (4.40 → 4.66 on `--panel`), `--rest` #14B8A6 → #0D7D70 (2.5 → 5.0 as text on white), `--danger` #E5484D → #D04146 (3.9 → 4.6 with white text). Tokens live in `src/index.css`.

**1. Workout tab home (the main screen)**
- Header, left: the plan name for the selected day as a large title (e.g. "Leg Day") with the date under it in gray (MM/DD/YYYY). Header, right: a round icon button (kettlebell-style icon, opens the same exercises library) and a pill button labeled "Workouts" (opens the Workouts screen).
- **Week strip** under the header: left and right chevrons to change week, 7 round day buttons (S M T W T F S letters under the day numbers). The selected day has a small dot under its letter and a stronger circle. The day number shows what is planned: `--text` (dark) = workout planned, `--rest` (teal) = rest day, `--text-2` (gray) = nothing planned; a **filled accent circle with a white number = a workout was completed that day** (the header title also turns `--accent` for that day). Tapping a day changes the header title/date and the card below.
- **Day card** (large rounded card, horizontally swipeable, with pagination dots below it. Confirmed from the video: one page per workout planned that day plus a trailing page with the "+" button, so a day can hold several workouts, e.g. Leg Day, Chest day, then "+". Start Workout starts the workout on the visible page):
  - *Planned workout*: title, a gray subtitle "Prev. <total volume> · <duration>" from the last time this workout was done (e.g. "Prev. 4.7k kgs · 1h 3m"; shows "Prev. None" if never done), and a round "..." menu button at the top right of the card. Inside, an inner `--panel` with a "Planned Workout" chip, the **front and back body diagrams** showing every muscle the workout hits (primary in `--accent`, secondary in `--accent-soft`), then the exercise names as centered chips (first 3 shown, then a "+N more" chip).
  - *Completed workout*: title "Workout Review" with the workout name under it and an eye icon at top right (opens the saved workout summary). Body diagram of the muscles trained, then three stat tiles: PRs (count), Volume, Time. Start Workout is disabled.
  - *Rest day*: title "Rest Day", subtitle "Recovery day", a big dim moon icon, and a small "Log a workout" chip at the bottom of the panel.
  - *Past day with nothing planned or logged*: title "No Workout", subtitle "Nothing logged", dim moon icon.
  - *Future day with nothing planned*: title "Not Planned Yet!", a centered round "+" button with the text "Tap + to plan a workout or add a rest day."
  - *Today with nothing planned*: the same "+" empty state as above, but "Start Workout" is enabled.
- **Start Workout**: a full-width accent pill pinned above the tab bar. Enabled for any planned workout on any day (starts now, logged today) and for today's empty state (freestyle). Disabled (muted fill, dim text) for rest days, finished-workout cards and empty non-today days (owner decision 2026-10-19). A day with no plan is titled "Freestyle" and can still start an empty workout.

**2. Plan-the-day sheet** (opens from the "+" button or the "..." menu)
- Full-height sheet with a back chevron on the left, the date centered ("Oct 19, 2026"), and a "+" button on the right (creates a new workout).
- Sections: **Presets** (one row: "Rest" with a moon icon; the reference's "Activities" preset is not built) and **Your Workouts** (the user's saved workouts, e.g. "Leg Day", "Chest day"). Each row has a radio circle on the right; the selected one shows an accent dot. Single-select.
- Bottom CTA is context-aware: disabled "Change to Selection" while nothing has changed; "Set <Workout Name> for Today" (or the date) when a workout is selected; "Set as Rest Day" when Rest is selected. The sheet closes immediately and the plan saves in the background (owner: the reference's loading delay felt too slow, 2026-10-19). Observation: the Rest preset was missing from this sheet on one visit (Oct 19, after a workout was already planned that day); treat it as "hide Rest if the day already has a started or logged workout" and confirm with me if unsure.

**3. Workouts screen** (from the "Workouts" pill)
- Back chevron + centered title "Workouts". No Workouts | Routines toggle: routines are not built (owner, 2026-10-19).
- List of saved workouts as full-width rows with a trailing chevron; tapping opens the workout editor.
- Accent "Create Workout" pill pinned at the bottom.

**4. Create / edit workout flow**
- Tapping "Create Workout" first opens a small centered modal sheet: muscle-icon badge, title "Workout Name", helper text "Name your workout. You can edit it later.", a text input (auto-focused, keyboard opens), and an accent "Confirm Workout Name" button that is disabled until text is entered.
- Then the **Create Workout** screen: back chevron, centered title, and a red round trash button at the top right (delete with confirmation). A card shows the workout name with a pencil icon (tap to rename using the same modal), the list of exercises (each row has a drag handle on the right for reordering), and an "+ Add Exercise" row with a plus-in-circle icon.
- "Save Workout" accent pill at the bottom. While saving, dim the screen with a spinner; then return to the Workouts list, where the new workout now appears. Opening an existing workout uses this same screen.

**5. Add Exercise (exercise library)**
- Top bar: back chevron, the title "Exercises" (the reference's Exercises | Activities toggle is not built), and a "+" button on the right (create custom exercise).
- Search field ("Search") with three filter chips below: **Muscle Group**, **Primary Muscle**, **Classification** (each opens a picker; chips show active state).
- Alphabetical list with sticky letter headers (A, B, C...), rows with the exercise name and a trailing chevron. Some rows also show a small clock icon before the chevron (appears on e.g. Abductor Machine and Adductor Machine; probably "recently used", so show it for exercises I have logged recently).
- Tapping a row opens the **Exercise detail** screen:
  - Back chevron and the exercise name centered, with "Class: <classification>" under the title (e.g. "Body Weight/Weighted"). When the library was opened to add to a workout, a full-width accent **Add Exercise** button is pinned at the bottom (adds it, then returns). The reference's small "+" in the top bar was too easy to miss, so it was replaced (owner request 2026-10-19). Custom exercises show a pencil (edit) in the top bar instead.
  - No "How to" section (instructions or photos) on this screen (owner request 2026-10-19). The active-workout card's "i" icon still opens them.
  - Large card with front and back body diagrams, targeted muscles in the accent color.
  - A small stats card: "No data / Log this exercise first" with an accent edit icon when there is no history; once logged, show last workout and PR (feature 6 above).
  - **PR Progress** card: a segmented toggle "PR" | "Vol." and a chart, with a range selector "Month | Year | All Time". Empty state: icon, "No Data", "Log this exercise to activate insights and data."
  - **Primary muscles:** and **Secondary muscles:** listed as label + gray value (e.g. "Abs", "Obliques").
- Each exercise needs a "classification" field (e.g. Body Weight/Weighted, Machine, Barbell, Dumbbell, Cable); derive it from the dataset's equipment/category, and add it to the `exercises` table.

**Data model additions**
- `plans`: id, date (YYYY-MM-DD, unique), type ('workout'|'rest'), workoutId?  (one row per planned day; drives the week strip and day card)
- `workouts` (saved definitions, the "Your Workouts" list) are separate from `workoutLogs` (completed sessions): templates in the earlier model map to saved workouts. Keep `workoutLogs` for history and the "Prev. volume · duration" subtitle.
- Saved workouts store their exercises as an ordered embedded array (`workouts.exercises[{exerciseId, unilateral, sets[]}]`); array order is the drag order. `workoutExercises` rows belong to logged sessions only.

**Acceptance checklist for this tab**
- No streak, level, score or trophy UI anywhere.
- Switching days in the week strip updates the title, date, and card instantly, with no network.
- Planning a day from the sheet updates the card and the day-number color without a reload.
- Start Workout: enabled for any planned workout on any day (it's logged as today's session) and for today's empty "+" page (freestyle); disabled on rest days, finished-workout cards and non-today empty days. Changed from the reference by owner decision 2026-10-19.
- Body diagram on the day card is the union of muscles across all exercises in the workout.
- Creating, renaming, reordering, saving and deleting a workout all persist after refresh.

## Active workout (spec from the second screen recording)
Tapping **Start Workout** slides the Workout tab into this screen. The bottom tab bar stays visible. Autosave after every edit (ground rules).

**Header**: workout name (large) with a count-up timer under it (mm:ss). Right side: a red round **X** button (discard workout; always confirm) and a solid `--text` pill **End Workout** (the reference's is white).

**Exercise pager**: one full card per exercise, centered and full width (neighbor cards do NOT peek; owner decision 2026-10-19), swiped horizontally to the next exercise, with page dots under the card (one per exercise). Each exercise starts with ONE empty set; the user adds more, up to a maximum of 4 sets (Add Set and Drop Set disable at 4; owner decision 2026-10-19). Each card has:
- Exercise name; a small info "i" icon next to it on some exercises (opens form info/instructions from the dataset); a round "..." menu at top right (replace/remove exercise, notes).
- A **Unilateral** toggle under the name. Off: each set is one row. On: each set splits into two stacked rows labeled **R** and **L**, each with its own kgs and reps.
- **Set rows**: set number, an accent circular-arrows icon (copies the previous set's values into this set), a weight field ("kgs") then "x" then a reps field ("reps"). Empty fields show **greyed placeholders with last session's values for that same set** (e.g. 20 kgs x 9 reps); typing replaces them. This is the "last workout" feature from the spec above and must be implemented exactly this way. Bodyweight exercises show "BW" in the weight field and use an mm:ss time field instead of reps (e.g. glute bridge).
- The exercise's own front and back **body diagram** below the sets, primary muscles in `--accent`, secondary in `--accent-soft`.
- Three buttons under the diagram: **Remove Set** (red), **Drop Set** (neutral), **Add Set** (accent). A drop set adds a linked set row at reduced weight.
- Also show, on this card, the PR header from feature 6 (last workout and PR with weight and reps). The reference does not show it here; that is my addition.

**Number entry: the iPhone's native numeric keypad** (owner decision 2026-10-19; the reference's custom number pad with ±step / copy / Next / plate keys is NOT built). Weight fields use `inputmode="decimal"`, reps and time fields `inputmode="numeric"`. Time is typed as digits (`130` = 1:30). Empty time fields show `--:--`.

**kg / lb per exercise** (owner decision 2026-10-19): the unit sits inside each set's weight box, right after the number (`62.5 kg ⌄`); it is a `<select>`, so iPhone shows its native wheel. All rows of an exercise share the value. The choice is saved on the exercise (`exercises.unit`, default kg) and used everywhere that exercise's weights are shown. Weights are always stored in kg; totals that mix exercises (volume tiles, profile totals) show kg. Drop sets step down in 2.5 kg / 5 lb.

**Rest timer bar**: NOT built (owner decision 2026-10-19). Workout notes live in the exercise card's "..." menu and the review screen instead.

**Ending a workout**
1. **End Workout** (the header pill) opens the **review screen** (not a confirmation). Header: back chevron, workout name centered, pencil icon on the right (edit sets). Content, top to bottom: a note "Review your workout before you finish. You can go back to edit your sets", two stat tiles (**Total Time**, **Volume** in kgs), the body diagram of muscles trained with a muscle-name chip (e.g. "Quads"), a **PRs** card listing each new PR as exercise name + weight x reps with a star icon, then one card per exercise with every set listed (Set 1, Set 2... with R/L rows and weight x reps).
2. Two pinned buttons at the bottom: outlined **Save Workout** and accent **End Workout**. End Workout shows a spinner, logs the session, and goes to the summary. Save Workout = save this session's exercises, sets, and weights back to the saved workout (so next time starts from them) and keep the session open (confirmed by owner 2026-10-19).
3. **Workout summary** screen: back chevron and the title "Workout Summary"; a card with the workout name, large body diagram of muscles trained, two tiles (**Time**, **Volume**), and a **Back to Home** button. No Share button.
4. Back on the Workout tab, that day's circle is now a filled accent circle and its card shows the "Workout Review" card described above.

**Definitions**
- Volume = sum of weight x reps over every logged set, counting R and L rows separately (e.g. 20kg x 25 x2 + 25kg x 6 x2 = 1,300 kg, shown as "1.3k kgs"). Show "k" above 1,000.
- A PR is any set that beats the stored best for that exercise (heaviest weight; ties broken by reps; also best e1RM). Count unilateral sides separately.
- The "Prev. 4.7k kgs - 1h 3m" subtitle on the planned card is the previous session's volume and duration for that workout.

**Data model additions for this screen**
- `sets`: add `side` ('R'|'L'|null), `isDrop` (bool), `durationSec?` (for timed/bodyweight holds), and make `weight` nullable (null = bodyweight).
- `workoutExercises`: add `unilateral` (bool).

## Profile tab (spec from the third screen recording)
The reference Profile tab is mostly social and gamified. Build ONLY the parts below, in this order, as one scrolling page with the same card style as the Workout tab. Everything else on that tab is deleted (see "Removed on purpose").
1. **Top bar**: a gear icon button at the top right that opens Settings (danger zone to erase data). No avatar, name, level badge, flame/streak chip, or shop icon.
2. **All-time totals row**: three centered stats separated by thin vertical dividers, each with a small icon above a value and a label: total training **time** (e.g. "1h 4m"), total **volume** (e.g. "6k kgs"), and number of **workouts** (e.g. "2 workouts"). These are sums over every logged workout (checked against the video: 4.7k + 1.3k volume = 6k, 2 workouts).
3. **Muscles this week** card: a title with a large accent-colored percentage under it (e.g. "9%"), a small expand icon at the top right (opens the diagram full screen), and a big front and back body diagram with every muscle trained this week highlighted (primary `--accent`, secondary `--accent-soft`). My reading of the percentage (not stated in the video): the share of the app's muscle regions that were trained at least once in the current Monday-to-Sunday week. Show the formula in a tooltip or the full-screen view so it is not a mystery.
4. **Week Overview** card: title "Week Overview" with a "Start Workout" pill at the right (starts today's planned workout; disabled if none), and the same 7-day strip as the Workout tab (filled accent circle = completed day, teal number = rest day, dark number = planned). Tapping a day jumps to that day on the Workout tab.
Nothing else on this tab. No streaks, no levels, no trophies, no leaderboard, no upsell cards.

## Build order
1. Scaffold Vite + PWA, Tailwind, Dexie schema
2. Curated exercise list and build script, muscle region mapping, seeding, detailed `MuscleMap` component (with `/dev/muscles` check page), exercise library and detail screens
3. Workout tab: week strip, day cards, plan-the-day sheet, Workouts screen, Create/Edit workout flow (see "Workout tab" section)
4. Active workout logging with autosave and resume (Start Workout from the tab opens this)
5. History and previous-performance display
6. Templates
7. PR detection and progress charts
8. Profile tab (totals, muscles this week, week overview)
9. PWA polish (icons, install prompt, offline test)
10. Phase 2: Fastify + SQLite backup/sync — built 2026-10-19 (`server/`, `src/sync.ts`): `npm run serve` serves the app on :4173 and `/api/sync`; devices push/pull rows, last write wins by `updatedAt`, deletes travel as tombstones.

## Quality bar
- Logging a set should take at most 2 taps after entering numbers.
- Large tap targets, number inputs use `inputmode="decimal"`, no zoom-on-focus: every input/select/textarea is at least 16px, and the viewport sets `maximum-scale=1` so iOS never auto-zooms (it got stuck zoomed in the Home Screen app, 2026-10-19).
- Lighthouse PWA checks pass; app loads in airplane mode.
- Unit tests for e1RM, PR detection, and volume totals.
- Keep README.md updated with run, build, and hosting steps.

## My preferences (fill these in)
- Training style: <e.g. push/pull/legs, upper/lower, powerlifting>
- Units: <kg or lb>
- Must-have features not listed above: <...>
- Things I disliked in Arrow: <...>
- App name: <...>
