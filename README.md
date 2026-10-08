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
- Paces and session sizes come from Jack Daniels' VDOT model, which lives entirely in `src/plan/daniels.ts` (equations, E/M/T/I/R zones, volume limits, plan-structure constants, each with its source). Edit that one file to change the formula.
- Onboarding asks only the questions in `src/plan/questions.ts`, defined as data and rendered generically. Fitness comes from a recent race, an estimated race, or a conversational easy pace. An easy pace sets easy running only (no published mapping to VDOT), so speed sessions then run by effort. Weekly distance, running days, training effort and focus size the sessions; the remaining optional answers are stored but not yet used (see `TODO(verify)` in the code).
- Sessions: Easy and Long runs at E pace (long run capped at 25% of the week and 150 minutes), Tempo at T pace (20 minutes or 10% of the week if shorter), Cruise intervals of 5-minute T reps with a 1-minute jog, Interval runs of 3-minute I reps with an equal jog, capped at the lesser of 8% of the week or 10 km. Warm-up and cool-down are easy running.
- A time target keeps its duration when speed changes. A distance target finishes when estimated distance reaches its target.
- Unknown-speed timed sections work by effort; distance and overall pace stay unknown. Distance targets require known speeds.
- Speed adjustments carry forward as an offset to subsequent target speeds, limited to 0.5–25 km/h. Change the setting to match your treadmill.

## Recovery, sounds, and limits

- A run saves its own plan snapshot, pause state, and speed-change history. Refreshing restores progress using that history.
- On returning from an inactive tab, elapsed time is replayed across every section and run/walk boundary using the planned speeds and saved adjustments.
- The app cannot detect treadmill changes you did not enter. A powered-off device cannot execute the app. Locked/backgrounded browsers may suspend timers and sound; missed sounds are not replayed in a burst.
- Screen wake lock is requested while running. Availability depends on the browser and device.
- There is no looping cue. A chime marks section or run/walk transitions; celebration plays at completion. **Mute sounds** silences both automatic sounds; **Play celebration** explicitly replays the finish sound.
- Completion shows actual active time and estimated distance, excluding pauses.
- Old sessions without a speed history cannot be recovered accurately. They are ignored with a notice; valid profiles remain available. Running answers saved in the old question format are discarded with a notice and asked again.
- Data stays in this browser's local storage. Corrupt records and storage failures produce notices rather than blank screens.

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

- Interval sessions never bypass the weekly allowance. If even one rep exceeds it, Start is disabled with an explanation. Threshold volume is guidance and is not enforced.
- The 150-minute ceiling applies to the whole Easy or Long workout. Edited plans are checked too.
- Section countdowns use the same speed-change history and run/walk phases as the overall finish forecast. Forecasts refresh when speeds or the plan change.
- Partial final intervals count as a repetition and retain their exact duration in exported steps.
- Planning is separated into `daniels.ts` (model), `questions.ts` (onboarding data), `baseline.ts` (answers to facts), `generate.ts`/`repeats.ts` (sessions), metrics, validation, editing and explanations. The tested step exporter remains isolated in `src/plan/schema.ts`.
- Duration formatters explicitly name their units: `formatDurationMs` for timers and `formatDurationSeconds` for entered times.
