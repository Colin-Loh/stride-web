# Architecture

Chase (package `stride-web`) is a React 19 + Vite + TypeScript PWA. All state lives in `localStorage` behind repository interfaces. There is no router and no backend.

## Navigation

`src/hooks/useAppFlow.ts` owns a single `view` state (`name`, `home`, `status`, `baseline`, `plan`, `workout`, `run`, `complete`, `past-complete`, `shop`). `src/App.tsx` maps each view to one screen. `home` and `status` render the same `StatusScreen`. `HomeNav` is shown on status, plan and shop. `src/App.nav.test.tsx` covers the view-to-screen mapping.

## Layout

| Path | Role |
| --- | --- |
| `src/main.tsx` | Entry. Picks the storage implementation, registers the service worker, imports the stylesheets. |
| `src/App.tsx` | View switch. |
| `src/hooks/` | `useAppFlow` (app state machine), `useRunSession` and `useRunAudio` (run screen), `startView` (first view from stored data). |
| `src/screens/` | One file per screen: Name, Baseline, Status, Plan, Workout, Run, Complete, Shop. |
| `src/components/` | Shared UI: nav, inputs, quest badge, pixel art (`StatusArt`, `ShopArt`, `RunArt`, `PixelArt`). |
| `src/plan/` | Training model. `vdot.ts` holds the Daniels equations and plan constants; `questions.ts` defines onboarding as data; `generate.ts`, `trainingPlan.ts`, `edit.ts` build and edit workouts and plans. |
| `src/run/` | Run engine and session state, free of React. |
| `src/progression/` | Currency, health and quest rules. |
| `src/cosmetics/` | Catalog, shop transactions, run overlays, and `legacy.ts` (one-time refund migration). |
| `src/dashboard/` | Charts and summary maths for the plan and complete screens. |
| `src/share/` | Share card layout, canvas render, Web Share wrapper. |
| `src/domain/` | Shared types, runtime guards, preferences. |
| `src/storage/` | `repository.ts` interfaces, `localStorage.ts` implementation, user-facing notices. |
| `src/retro/` | Retro-pixel theme: tokens, per-area stylesheets, fonts. `src/index.css` holds structural layout. |
| `public/` | Static art: `sprites/` (character sheets), `cosmetics/run/` (overlay sheets), icons, `celebration.wav`. |
| `docs/` | Design notes and screenshots for each redesign area. |

## Persistence and migrations

Keys use the `stride.` prefix. Loaders validate with `src/domain/guards.ts` and discard unreadable or outdated records with a notice (`src/storage/notice.ts`). The progression loader runs, in order: shape conversion, the one-time legacy accessory refund (`LEGACY_MIGRATION_ID`, recorded in `grantsApplied`), removal of unknown items, and equipped-slot normalisation. These paths read stored data from older versions, so they stay even though no current code writes that data.

## Dead-code policy

- Compatibility and migration code stays while stored data of that shape can exist.
- An export is public only if another module or test imports it. Everything else is module-private.
- Assets are removed when no source file, stylesheet, test or manifest references them. Overlay and sprite files under `public/` are loaded by computed name (`runOverlay.ts`, `sprites.ts`) and are guarded by `src/cosmetics/art-files.test.ts`.

## Cleanup record

Evidence: `npx knip` (unused files, exports, dependencies), `git grep` on every candidate, a scan of every CSS class selector against all `.ts`, `.tsx` and `.html` sources, then `tsc -b`, tests, lint and build.

Removed:

- `src/assets/pixel-clock.svg`, `pixel-pace.svg`, `pixel-runner.svg`, `pixel-treadmill.svg`: no references anywhere. `PlanScreen` uses the `.png` icons.
- CSS with no matching element in any component: `.home-stage`, `.home-health`, `.home-balance`, `.session-pace`, `.zone-letter`, `.quest-icon`, `.plan-weeks-title`, `.shop-mirror-icon`.
- Re-exports from `src/plan/generate.ts` that nothing imports: `validateWorkout`, `setSectionPace`, `setSectionTargetValue`, `planToSchema`. Tests import `planToSchema` from `./schema`; the components import the setters from `./edit`.
- Unreferenced run overlay sheets `public/cosmetics/run/{chase,shooshy}-sushi-hat-{healthy,obese}.png`: `runOverlay.ts` loads the `-status.png` variant for sushi hats, so the plain variants are never requested. Sushi hats keep `-healthy-status.png` and `-obese-status.png`.
- `export` keyword on symbols used only inside their own module: `COSMETIC_IDS`, `TAPER_FRACTIONS`, `HEALTH_WINDOW_DAYS`, `BRAND`, `ESTIMATE_NOTE`, `TAGLINE`, `downloadFile`, `isAsked`.

Kept:

- Dynamic selectors: `.run-layer-*` (built in `RunArt.tsx`) and `.shop-card-unaffordable` (built from `ShopScreen` item state).
- Overlay PNGs in `public/cosmetics/run/` and `public/sprites/`: loaded by computed filename.
- `src/cosmetics/legacy.ts` and the progression migration chain.
- `src/retro/atkinson-hyperlegible-latin-{400,700}-normal.woff2`: no reference on this branch, kept for the font work in PR #49.
- Exported types with no importers (`HomeDestination`, `ShopFailure`, `SectionRow`, `ZoneTime`, `Condition`, `RunnerState`): they document public function signatures.

No component was split. The largest files (`vdot.ts` 633 lines, `localStorage.ts` 266, `ShopScreen.tsx` 252) are cohesive, and splitting them would add churn without a separation benefit.
