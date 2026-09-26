# Stride

A static, mobile-first running web app: name, experience level, then Easy / Tempo / Long. Each session is warm-up, a steady section, and cool-down. The clock follows the **prescribed** km/h for each segment (not GPS).

Host this on **GitHub Pages**. Azure App Service **F1 is not a good fit** (no Always On, idle unload, 60 CPU minutes/day). If you later want Azure, use Static Web Apps Free instead of F1.

## Limits (read this)

- The phone **powered off** cannot run the workout.
- With the screen **locked**, browsers often freeze JavaScript. Elapsed time is stored as a wall-clock timestamp, so when you open Stride again the bar jumps to the right place.
- While a run is active, Stride requests **screen wake lock**. A chime plays at section changes, followed by celebration audio at completion. Mute section chimes from the run screen if you want.

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints. Add `?quick=1` to compress each workout to a few seconds (for checking completion and the celebration track).

## GitHub Pages

1. Create a GitHub repo and push `main`.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Pushing to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): `npm ci`, `npm run build`, deploy `dist`.
4. On your phone, open the Pages URL, then **Add to Home Screen** for the PWA.

The Vite `base` is `./`, so the app works at `https://<user>.github.io/stride-web/`.

## Profile data

Name, level, mute preference, and an in-progress run are stored in `localStorage` only. There is no server.
