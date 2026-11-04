# DESIGN.md — Liftlog visual redesign

Source of truth for the new look of Liftlog. Hand this to Claude Code together with `CLAUDE.md`.
Behavior, data model, stack and the "Removed on purpose" list in `CLAUDE.md` stay as they are.
**This file REPLACES the "Look and feel (LIGHT theme…)" section of CLAUDE.md** (tokens, radii, button styles, tab bar). Everything else in CLAUDE.md about screens and behavior still applies.

The design lives on a canvas artifact (boards named below). When this file and a board disagree, the board wins.

| Board | Screen |
|---|---|
| Main | Workout tab home, planned day (Tue Nov 3, Push Day) |
| Day-Done | Workout tab home, finished day (Mon Nov 2, Pull Day) |
| Day-States | Rest day / past empty / future empty cards |
| Active | Active workout logging |
| Library | Exercise library (list) |
| Exercise | Exercise detail |
| Review | Review before finishing |
| Summary | Workout summary |
| Profile | Profile tab |

Not designed yet (keep the old structure, restyle with these tokens): plan-the-day sheet, Workouts list, create/edit workout, Stats tab, Settings, confirm dialogs, full-screen muscle map.

---

## 1. Direction: "gym logbook"

Calm, private, utilitarian. A chalk-gray page, white-ish cards, and **ink-black panels where the muscle diagrams glow orange**. Numbers are the hero; chrome is quiet. No social, no gamification (no flames, badges, trophies, confetti). The streak is plain text.

Principles
1. One accent color (burnt orange). Everything else is ink, gray, or a single teal for rest.
2. Few boxes. Prefer whitespace and hairlines over boxes inside boxes.
3. Dark = upcoming / in focus (planned card, muscle hero panels). Light = done.
4. Thumb-first: primary actions are pill buttons, tap targets are at least 44px (see §8 for the few exceptions to double-check).
5. Never leave dead space: no blank band above titles, no empty padding under the tab bar icons.

---

## 2. Tokens (single file, e.g. `src/index.css` + Tailwind theme)

No hard-coded colors in components. Changing tokens must be enough to re-theme.

```css
:root {
  --ground:   #E8EAE5; /* page */
  --paper:    #F7F8F4; /* cards */
  --inset:    #DDE0D8; /* inner fields/panels, disabled fill */
  --line:     #CBCFC5; /* hairlines, card borders */
  --ink:      #141618; /* text, dark panels, primary dark buttons */
  --mute:     #586060; /* secondary text (AA on ground/paper/inset) */
  --acc:      #C94418; /* primary buttons, completed day, PR tag, accent dot (white text = 4.6:1) */
  --acc-t:    #B33A12; /* accent used AS TEXT on light surfaces (4.8:1) */
  --glow:     #FF6F31; /* accent on ink panels only (labels, big %) */
  --rest:     #1E6B66; /* rest-day number/ring (5.9:1 on paper) */
  --danger:   #B3261E; /* discard, remove set, delete */
  --onink:    #F1F2EC; /* text on ink */
  --muteink:  #9CA4A0; /* secondary text on ink (6.8:1) */
  --on-acc:   #FFFFFF;

  /* muscle figure, light surfaces */
  --fig-l: #D2D6CD; --ln-l: #AEB4A9; --p-l: #C94418; --s-l: #F0B49C;
  /* muscle figure, ink panels */
  --fig-d: #2B3034; --ln-d: #474E53; --p-d: #FF6F31; --s-d: #9B4C2D;
}
```

Rest-day panel (Day-States): bg `#12403C`, text `#E4F0EE`, secondary `#9FC4BF`, moon `#4C8782`, chip border `#6FA39D`. Put these in tokens too (`--rest-panel*`).

Ink panels get a subtle dot texture: `background-image: radial-gradient(#ffffff12 1px, transparent 1px); background-size: 14px 14px;`

### Typography (self-host, the app must work offline)

- **UI text and titles: Instrument Sans.** Weights 400, 500, 600 only. **Never 700 or heavier** (the bold looked bad). Titles are 600 with letter-spacing −0.02 to −0.025em.
- **All numbers (weights, reps, times, dates, volume, stats, calendar days, labels): Inter**, with `font-variant-numeric: tabular-nums`. No monospace anywhere. Set tabular-nums on the app root.
- Install via `@fontsource-variable/instrument-sans` and `@fontsource-variable/inter` (or `@fontsource/*`), not Google Fonts links, so the service worker can precache them.
- Small labels: Inter 11px, uppercase, letter-spacing .08em, weight 500, color `--mute` (or `--muteink` on ink).

| Role | Size / weight |
|---|---|
| Screen title (Push Day, Good afternoon…) | 30–38px / 600 |
| Card title | 22–26px / 600 |
| Exercise name (active) | 26px / 600 |
| Body | 15–17px / 400–500 |
| Set field number | 17px / 600 (Inter) |
| Stat numbers | 20–30px / 600 (Inter) |
| Big percentage (Profile) | 60px / 600, `--glow` |
| Labels | 11px / 500 uppercase |

### Shape and spacing
- Radii: ink/hero cards 28px; light cards 24–28px; inner panels 14–18px; fields 10px; buttons and chips fully pill (999px); round icon buttons 46px circle.
- Screen padding: 18px sides. **Top padding 28px** from the top of the safe area (use `calc(28px + env(safe-area-inset-top))`). No decorative blank band.
- Gap between cards 16px. Inside cards 14–16px between blocks, card padding 18–22px.
- Hairlines 1px `--line`. Outlines on round/outline buttons 1.5px `--ink`.

---

## 3. Components

**Round icon button** 46px circle, 1.5px ink outline, transparent. On ink: 44px, border `#ffffff3a`. Icons: 22px stroke 1.8, round caps (inline SVG sprite, `currentColor`).

**Buttons** (56px tall full width unless noted)
- Primary: `--acc` bg, white text, 17px/600, pill. (Start Workout, End Workout on review, Add Exercise, Back to Home)
- Header "End Workout": `--ink` bg, white text, 46px tall.
- Outline: 1.5px ink border (Save Workout, "Workouts" pill 46px).
- Disabled: `--inset` bg, `--mute` text (also Drop Set / Add Set at 4 sets, Start Workout on finished days).
- Small pill (Start Workout in Week Overview): 40px tall, `--acc`.
- Set action buttons (Remove / Drop / Add Set): 42px tall, 14px/600. Remove = danger outline; others neutral/disabled fill; Add = accent when enabled.

**Chips (on ink)** 30px tall pill, bg `#ffffff16`, 13px/500. "+N more" chip: transparent, dashed 1.5px `#ffffff4a`, `--muteink`.

**Filter chips (library)** 40px pill, 1.5px ink outline; active = ink fill, white text, with ✕.

**Segmented control** (PR | Vol., Month | Year | All Time): `--inset` track with 3px padding, 36px segments, selected = ink fill white text.

**Tab bar** Profile | Workout | Stats. Bg `--paper`, 1px top hairline. Compact: icon (22px) over 11px/600 label, centered in a 56px band **plus** `env(safe-area-inset-bottom)` — nothing else. Active = ink + a 28×3px accent tab at the very top edge; inactive `--mute`. (The mock draws it 66px tall including a ~10px bottom allowance.) Stays visible on Workout, Active workout, Profile.

**Week strip** (Workout home and Profile Week Overview)
- Row: chevron (26×46) + 7 day columns (42px) + chevron. Column = letter (Inter 11px, `--mute`) over a 34px circle with the day number (Inter 15px/600).
- Planned workout: ink number, 1.5px solid ink ring.
- Rest day: `--rest` number, 1.5px **dashed** `--rest` ring.
- Nothing planned: `--mute` number, no ring.
- Workout completed: **filled `--acc` circle, white number**.
- Selected: column gets a `--paper` capsule with 1px `--line` border and soft shadow, plus a 4px ink dot under the circle.
- On the Workout tab, the screen title turns `--acc-t` when the selected day is a completed workout.

**Pager dots** 8px circles `#14161833`; active = 22×8 pill (ink on the Workout card, accent in Active workout). An exercise with an unread note = accent dot, 11px.

**Dotted-leader ledger rows** (Review): label left (`--mute`), dotted 1.5px line, value right (Inter 14.5px/600). PR set shows a small `PR` tag (accent bg, white 11px/600) before the value.

**PR tag**: plain "PR" text label, accent bg, white, 11px/600, radius 6, no animation.

---

## 4. Muscle diagram (replaces the old figure)

Use the original **MuscleMap** art (MIT, github.com/Jsplice/MuscleMap, `packages/assets/src/male-front.ts` and `male-back.ts`), as already chosen in CLAUDE.md. Record source and license in `docs/ASSETS.md`.

- Use the traced path data only (the `d` strings of the `BODY` outline and each muscle). Do not use the bundled photos.
- viewBox for rendering: `170 39 680 1411` (aspect ≈ 0.482). Width = height × 0.482.
- Draw the `BODY` path in `--fig`. Draw each muscle path with `fill: var(--c, var(--fig))`, `stroke: var(--ln)`, `stroke-width: .6px`, `vector-effect: non-scaling-stroke`, `stroke-linejoin: round`. That gives the separation lines at every size.
- Build front and back once as an SVG sprite (`<g id="front">`, `<g id="back">`) and instantiate with `<use href="#front">`. Highlighting is done with CSS custom properties set on the `<svg>` or its wrapper; custom properties inherit into `<use>`.
- Surface variants: wrapper class `fig-l` (light surfaces) or `fig-d` (ink panels) sets `--fig --ln --p --s` from the tokens above. A muscle is highlighted by setting its variable to `var(--p)` (primary) or `var(--s)` (secondary).
- Highlight variables (one per path, `style="--c: var(--m-xx)"`). Keep these names:

| Variable | MuscleMap ids (front / back) |
|---|---|
| `--m-t1` | TRAPEZIUS (front); first two TRAPEZIUS paths (back, upper) |
| `--m-t2` | RHOMBOID_* (back, mid back) |
| `--m-t3` | remaining TRAPEZIUS paths (back, mid/lower) |
| `--m-ch1` (falls back to `--m-ch2`) | CHEST_* |
| `--m-dF` / `--m-dS` / `--m-dR` | SHOULDER_FRONT / SHOULDER_SIDE / SHOULDER_REAR |
| `--m-bi` | BICEPS_* |
| `--m-tr` | TRICEPS_* |
| `--m-fo` | FOREARM_* |
| `--m-ob` | OBLIQUE_* |
| `--m-ab1` (falls back to `--m-ab2`) | CORE_* |
| `--m-la` | LATISSIMUS_* |
| `--m-er` | LOWER_BACK_* |
| `--m-gl` | GLUTEUS_* |
| `--m-gm` | ABDUCTOR_* (hip abductors / glute med) |
| `--m-ad` | ADDUCTOR_* |
| `--m-qd` | QUADRICEPS_* and the two unnamed QUADS paths |
| `--m-ha` | HAMSTRINGS_* |
| `--m-ca` (falls back to `--m-so`) | CALVES_* |

Mapping from the app's canonical muscle enum (CLAUDE.md, ~40 regions) to these variables is a lookup table in code; several enum regions share one variable (e.g. `chest-upper` and `chest-lower` → `--m-ch1`, `soleus` → `--m-so`/calves). MuscleMap has no separate serratus, hip flexor, tibialis or brachialis art: those enum values fall back to the nearest drawn group (or are skipped on the diagram and still listed in the text lists).

Sizes in use: 25×58 (library thumbs, two figures side by side in a 62px rounded tile), 40×93 (active workout strip), 88×204 (home card), 92×213 (review), 104×241 (exercise detail, profile), 108×251 (summary). Always show front and back together, side by side, with FRONT / BACK labels only on the large home card and exercise detail.

---

## 5. Screens

Sample data in the boards is placeholder. Real data comes from Dexie.

### 5.1 Workout tab home (Main, Day-Done, Day-States)
- Header: title = plan name (38px/600), date under it (`MM/DD/YYYY · Today|Done`, Inter 13px, `--mute`). Right: kettlebell round button (opens library) and "Workouts" outline pill.
- Week strip (see Components), 18px below the header.
- Day card, swipeable, pager dots below:
  - **Planned** (ink panel, radius 28, height fills the space above Start Workout, ~460px on a 844px screen): label "PLANNED WORKOUT" (`--glow`), line "Prev. 6.6k kgs · 58m" (`--muteink`), "…" round button top right; big front + back figures (muscles of the whole workout, primary `--p`, secondary `--s`); exercise chips centered (first 3 + "+N more"); at the bottom, if the streak is above 0 and this is today and not done: "Keep your 6-day streak going." (Inter 12.5px, `--muteink`).
  - **Finished** (light card): title "Workout Review", workout name under it, eye round button; figures on `fig-l`; three tiles (PRs, Volume, Time): `--inset` bg, radius 18, label + Inter 24px/600 value. Title above turns `--acc-t`. Start Workout disabled.
  - **Rest day** (Day-States): dark teal panel with dot texture, "Rest Day", "Recovery day", large dim moon outline, "Log a workout" outline pill.
  - **Past, nothing**: paper card with dashed 1.5px `#A9AEA3` border, "No Workout", "Nothing logged", dim moon.
  - **Future, nothing planned**: paper card, "Not Planned Yet!", 88px ink round "+" button, "Tap + to plan a workout or add a rest day." Today with nothing planned is the same but Start Workout is enabled.
- Start Workout pill (accent, 56px) sits in the page flow under the pager dots (not floating).

### 5.2 Active workout (Active)
Header: workout name 32px/600 with the running timer under it (Inter 20px/500); right: round danger-outline ✕ (discard, always confirm) and ink "End Workout" pill.
One card per exercise (swipe pager, no peeking), card padding 22px, 14px between blocks, top to bottom:
1. Label "EXERCISE 1 OF 6" and the name (26px/600), "…" menu round button (replace/move/remove, note for next time, permanent note).
2. **Muscle strip right under the name**: front + back 40×93 on `fig-l`, and to the right "● PRIMARY / Chest" and "● SECONDARY / Front delts, Triceps" (dot colors match the figure). No box around it.
3. Permanent note: pin icon + 13.5px `--mute` line.
4. "You have a note for this exercise" (only when a note-for-next-time exists): 40px dashed accent border, 12% accent tint, `--acc-t` text, chevron. Tap opens the note with its date and a Done button.
5. Last / PR strip: one `--inset` panel, radius 14. Left: label "LAST · OCT 27" + the sets on one line (`80×8 · 80×8 · 82.5×6 · 82.5×5`, Inter 13px). Right: label "PR" + best (`92.5×3`, Inter 17px/600). "No history yet" state when empty. PR updates live.
6. "SETS" label row with a small "Unilateral" switch on the right (38×22). When on, each set splits into R and L rows.
7. Set rows, 44px tall: `# | weight field | × | reps field | previous-set chip`.
   - Grid: `20px 1fr 10px 64px 70px`, 6px gaps. Fields 40px tall, radius 10, Inter 17px/600, centered.
   - Logged field (both values filled): `--inset` bg, ink text. Empty field: 1.5px dashed `#14161858` border, gray placeholder showing the latest set logged above (or last session's). The unit sits inside the weight field after the number: `kg ⌄`, 11.5px `--mute`, native `<select>` wheel on iPhone. Bodyweight shows "BW" and an mm:ss field.
   - A set that beats the stored best shows the plain "PR" tag on the weight field's top-right corner.
   - Previous-set chip: tiny repeat icon (accent) + `80×8`, 12px `--mute`; tapping copies it into the row. Row i shows session-ago set i.
   - Number entry: iPhone numeric keypad (`inputmode`), font-size ≥16px on every input.
8. Buttons: Remove Set (danger outline), Drop Set, Add Set (max 4 sets; the last two disable at 4).
Page dots below the card (accent active pill, accent enlarged dot for exercises with a note). Tab bar visible.

### 5.3 Exercise library and detail (Library, Exercise)
- Library: back, "Exercises" 26px/600, "+" (custom exercise). Search field 52px (`--paper`, 1px line, radius 16, placeholder "Search 281 exercises"; matches aliases like "pec deck", "butterfly"). Filter chips: Muscle Group, Primary Muscle, Classification (active chip = ink fill with ✕). List rows 76px on `--paper` with hairlines; 62px rounded tile with the two mini figures (primary/secondary highlighted), name 17px/600, sub-line "Machine · Chest" 13px `--mute`, clock icon when logged recently, chevron. Letter headers (A, C, H…) 34px, Inter 13px/600 `--acc-t`, sticky. No tab bar here.
- Detail: header with back, name centered (24px/600) and "Class: Machine" under it. Ink panel with front + back 104×241 and a Primary / Secondary legend. Card "Last workout · date" with sets on one line, then "PR" and best (28px). Card "PR Progress": segmented PR | Vol. and Month | Year | All Time; line chart (accent line 2.5px, hollow dots, last point filled with a label; dashed hairline gridlines; Inter 11px axis labels; light accent area fill at 10%). Empty state: "No Data / Log this exercise to activate insights and data." Card with "Primary muscles:" and "Secondary muscles:" rows (label left, value `--mute` right). Accent "Add Exercise" button in the page flow at the end (custom exercises show a pencil in the top bar instead).

Charts: Recharts is the stack; style it to match (stroke `--acc-t`, grid `--line` dashed, tick font Inter 11px `--mute`).

### 5.4 Review and Summary (Review, Summary)
- Review: back, workout name centered (22px/600), pencil right. Note "Review your workout before you finish. You can go back to edit your sets." Two tiles side by side (Total time, Volume; paper, 1px line, radius 20, Inter 30px/600). Ink panel with the figures (92×213) and muscle chips. Card "New PRs · N" with accent star icon (filled `--acc-t`), exercise name and `92.5 kg × 3` per row. One card per exercise with ledger rows (R/L rows for unilateral). Buttons in the page flow at the end: outline "Save Workout", accent "End Workout".
- Summary: back, "Workout Summary" centered. One tall ink card (fills the screen): label "FINISHED · Tue, Nov 3", workout name 36px/600, big figures 108×251, two translucent tiles (Time, Volume; `#ffffff12`, radius 18, Inter 30px/600) at the bottom. "Back to Home" accent pill below. No Share button.

### 5.5 Profile (Profile)
Greeting as the screen title: "Good afternoon, Diego" on two lines (30px/600, time-of-day aware, name from Settings, empty = no name), gear round button right. Then: totals card (three centered stats separated by hairlines: clock/time, plate/volume, calendar/workouts; Inter 20px/600 value, 11px label) → ink "Muscles this week" card (label, huge `--glow` percent, expand button, figures 104×241 with everything trained since Monday, caption "14 of 39 muscle regions trained since Monday" which doubles as the formula) → "Week Overview" card (title, small accent "Start Workout" pill, line `6-day streak · Best: 9` as plain text, week strip). Nothing else.

---

## 6. Implementation notes for Claude Code
1. Add the tokens and fonts first; delete old tokens (`--accent #2F5BFF`, `--accent-soft`, old radii). Grep for hard-coded colors afterwards.
2. Replace the old `MuscleMap` component with the new sprite-based one (§4). Keep the `<MuscleMap primary={[]} secondary={[]} />` API; keep `/dev/muscles`.
3. Re-skin screen by screen in this order: Workout home → Active workout → Library/Detail → Review/Summary → Profile. Behavior does not change.
4. Layout is a ~390px phone frame (max 430, centered). Respect `safe-area-inset-*`. Only `<main>` scrolls.
5. Keep numbers in Inter with tabular-nums everywhere, including calendar days and chart labels.

## 7. Copy
English, plain. No celebratory wording. Examples: "Keep your 6-day streak going.", "No history yet", "Nothing logged", "Not Planned Yet!".

## 8. Open items
- Some tap targets are under 44px in the mock (Unilateral switch 22px, previous-set chip text, kg ⌄): pad the hit area to 44px in code without changing the look.
- Fonts could not be previewed in the design tool; confirm Instrument Sans 600 and Inter numbers on a device.
- Screens still to design: plan-the-day sheet, Workouts list, create/edit workout, Stats, Settings, dialogs, full-screen muscle map.
