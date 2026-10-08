# Stride

A mobile-first running planner with timed or distance-based sections, optional run/walk intervals, treadmill speed controls, and section sounds. Distance is estimated from entered speed, not GPS or treadmill measurements.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL. Choose **Test run** for three fixed 30-second sections (90 seconds total). No running questionnaire is needed for this test. It works without a known speed; distance then remains unknown. The old `?quick=1` mode has been removed.

## Planning and speeds

- Generated and edited treadmill speeds round **up** to 0.1 km/h: 8.21 becomes 8.3; 8.20 stays 8.2.
- Internal time and distance calculations retain precision. Pace remains minutes:seconds per kilometre.
- Paces come from Jack Daniels' VDOT formulas: from a recent race, your comfortable pace, or a 9:00/km beginner default. Session sizes follow Daniels' volume rules as a share of your weekly distance (long-run main distance at most 25–30%, the entire easy/long workout at most 150 minutes, threshold work at most 10%, fast reps at most 5%). The Easy run is your week split across your running days. Warm-up lengths and the defaults are editable product choices, not validated training advice.
- Run/walk sessions alternate editable run and walk durations. The initial suggestion is two minutes running, one minute walking.
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
- Old sessions without a speed history cannot be recovered accurately. They are ignored with a notice; valid profiles and running answers remain available.
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

- Minimum hard-workout sizes never bypass weekly distance limits. If the proposed minimum exceeds the allowance, Start is disabled with an explanation. Shorten the work block or choose an easier workout.
- The 150-minute ceiling includes warm-up and cool-down, including run/walk time. Edited plans are checked too.
- Section countdowns use the same speed-change history and run/walk phases as the overall finish forecast. Forecasts refresh when speeds or the plan change.
- Partial final intervals count as a repetition and retain their exact duration in exported steps.
- Planning is separated into metrics, validation, editing, explanations, interval/cruise builders, and shared builder helpers. The tested step exporter remains isolated in `src/plan/schema.ts`.
- Duration formatters explicitly name their units: `formatDurationMs` for timers and `formatDurationSeconds` for entered times.
