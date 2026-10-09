# Stride

A mobile-first running planner with timed or distance-based sections, repeated rep/recovery intervals, treadmill speed controls, and section sounds. Distance is estimated from entered speed, not GPS or treadmill measurements.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL. Choose **Test run** for three fixed 30-second sections (90 seconds total). No running questionnaire is needed for this test. It works without a known speed; distance then remains unknown. The old `?quick=1` mode has been removed.

## Planning and speeds

- Generated and edited treadmill speeds round **up** to 0.1 km/h: 8.21 becomes 8.3; 8.20 stays 8.2.
- Internal time and distance calculations retain precision. Pace remains minutes:seconds per kilometre.
- Paces and session sizes come from the VDOT model, which lives entirely in `src/plan/vdot.ts` (equations, E/M/T/I/R zones, volume limits, plan-structure constants, each with its source). Edit that one file to change the formula.
- Onboarding asks only the core VDOT and plan inputs, defined as data in `src/plan/questions.ts` and rendered generically:
  1. Fitness method: a recent race, an estimated race, or a conversational easy pace.
  2. The inputs for that method only: race distance and finish time, an estimated distance and time, or the easy pace.
  3. Training focus (Base or a race distance).
  4. Current weekly distance (km).
  5. Running days per week (1-7).
  6. Training effort (Base, Base Quality, Advanced Quality).
  7. Goal race date, asked only for a race focus and optional.

  An easy pace sets easy running only (no published mapping to VDOT), so speed sessions then run by effort.
- Pace cards: the plan screen shows all five VDOT paces as cards: E (Easy), M (Marathon), T (Threshold), I (Interval) and R (Repetition), each with min/km, the treadmill speed (rounded up to 0.1 km/h) and a one-line purpose. With only an easy pace (no race result) just E is shown, with a note that the other paces need a race result. All values come from `src/plan/vdot.ts`.
- Workouts (single sessions are chosen from the session list; the plan screen uses the same builders):
  - **Long run** at E pace: the lesser of 25% of the week and 150 minutes.
  - **Threshold run** (T): easy warm-up, one steady block at T pace of 20 minutes (or 10% of the week at T pace if shorter), easy cool-down.
  - **Interval run** (I): warm-up, 3-minute reps at I pace with an equal jog, cool-down. Total I running is capped at the lesser of 8% of the week and 10 km; if one rep does not fit, a single shorter rep (at least 1 minute) is used.
  - **Repetition run** (R): warm-up, short reps at R pace (400 m, or 2 minutes at most) with recovery of twice the work time, cool-down. R running is capped at the lesser of 5% of the week and 5 miles.
  - **Test run**: three fixed 30-second sections.
  - There is no separate easy run or cruise-interval workout. In a plan week, the distance left after the long run and speed sessions is filled with E running.
  - Without a race result, speed sessions have no target pace and run by effort (RPE). Warm-up and cool-down are 10 minutes of easy running each (`TODO(verify)` in `vdot.ts`).
- A time target keeps its duration when speed changes. A distance target finishes when estimated distance reaches its target.
- Unknown-speed timed sections work by effort; distance and overall pace stay unknown. Distance targets require known speeds.
- Speed adjustments carry forward as an offset to subsequent target speeds, limited to 0.5–25 km/h. Change the setting to match your treadmill.

## Progression and the training plan

- **My training plan** builds at least 12 weeks (or until the goal race date, up to 52 weeks) from your answers. The plan screen lists every week with its target distance and sessions, highlights the current week, and opens any session in the normal run flow. Editing a session on the workout screen is saved into the plan. Changing your answers rebuilds the plan from today.
- Weekly distance follows the VDOT mileage progression, in `PROGRESSION` and `weeklyVolumes(startKm, runsPerWeek, weeks)` in `vdot.ts`: hold a level for 4 weeks, then add one mile (1.609 km) per weekly run, never more than 10 miles per step. The 10% rule is deliberately not used. Example, 15 km a week on 3 runs: weeks 1-4 at 15 km, 5-8 at 19.8 km, 9-12 at 24.7 km.
- Each week has one long run, the speed sessions your training effort allows (Base 0, Base Quality 1, Advanced Quality 2) and E running for the rest of the target. At least one E run is kept besides the long run, so a three-day runner on Advanced Quality gets one speed day. Speed sessions rotate R, I, T by 4-week level.
- The long-run rule (25% of the week or 150 minutes) is not relaxed, so on few runs a week your E runs can be longer than the long run. The plan says so in a note.
- Not modelled because the research could not verify them (`TODO(verify)` in `vdot.ts`): down weeks, a smaller step for new runners, and a peak weekly volume.

## Storage

- Data stays in this browser's localStorage, behind repository interfaces in `src/storage/repository.ts`: `PlanRepository`, `AnswersRepository` and `RunSessionRepository` (async `load`, `save`, `list`, `delete`) and `PreferencesRepository`. Screens and hooks use only these interfaces; `src/main.tsx` is the one place that picks `createLocalStorageRepositories()` from `src/storage/localStorage.ts`. To move to a database, implement the same interfaces and change that line.
- Stored records are the plain JSON types in `src/domain/types.ts` (`TrainingPlan`, `Week`, `Session`, `PaceSet`, `Answers`, `RunSession`). Each has a stable string `id`, a `schemaVersion` and ISO `createdAt`/`updatedAt`; there are no functions, Dates or class instances.
- Records that fail validation (old workout ids such as easy, tempo or cruise, the older single-plan shape, a missing or different `schemaVersion`) are discarded with an "outdated or invalid" notice. Nothing is migrated.

## Recovery, sounds, and limits

- A run saves its own plan snapshot, pause state, and speed-change history. Refreshing restores progress using that history.
- On returning from an inactive tab, elapsed time is replayed across every section and run/walk boundary using the planned speeds and saved adjustments.
- The app cannot detect treadmill changes you did not enter. A powered-off device cannot execute the app. Locked/backgrounded browsers may suspend timers and sound; missed sounds are not replayed in a burst.
- Screen wake lock is requested while running. Availability depends on the browser and device.
- There is no looping cue. A chime marks section or run/walk transitions; celebration plays at completion. **Mute sounds** silences both automatic sounds; **Play celebration** explicitly replays the finish sound.
- Completion shows actual active time and estimated distance, excluding pauses.
- Old sessions without a speed history cannot be recovered accurately. They are ignored with a notice; valid profiles remain available. Running answers saved in an older format, including answers to questions since removed, are discarded with a notice and asked again.
- Corrupt records and storage failures produce notices rather than blank screens.

## Checks and deployment

```bash
npm test
npm run lint
npm run build
npm run preview
```

GitHub Pages: push to `main`, then choose **GitHub Actions** under repository **Settings → Pages**. The workflow runs tests, lint, and build before deployment. The relative Vite base supports a repository subpath.

The production offline cache includes app code, install icons, animal sprites, and celebration audio. Visit once online before testing offline. Browser playback and mobile lock/unlock behaviour still require device testing.

## Planning limits and code organization

- Interval and repetition sessions never bypass their session allowance. If an edit pushes them over it, Start is disabled with an explanation. Threshold volume is guidance and is not enforced.
- The 150-minute ceiling applies to the whole Long run or E run, including warm-up and cool-down. Edited plans are checked too.
- Section countdowns use the same speed-change history and run/walk phases as the overall finish forecast. Forecasts refresh when speeds or the plan change.
- Partial final intervals count as a repetition and retain their exact duration in exported steps.
- Planning is separated into `vdot.ts` (model), `questions.ts` (onboarding data), `baseline.ts` (answers to facts), `generate.ts`/`repeats.ts` (sessions), `trainingPlan.ts` (weeks), `paces.ts` (pace cards), metrics, validation, editing and explanations. The tested step exporter remains isolated in `src/plan/schema.ts`.
- Duration formatters explicitly name their units: `formatDurationMs` for timers and `formatDurationSeconds` for entered times.
