# Retro-pixel system

The retro-pixel theme covers every screen. `App.tsx` sets `data-theme="retro"` on `<main class="shell">` for all views, including the loading shell. Every rule lives in `src/retro/retro.css` under `[data-theme='retro']`; `src/index.css` holds the structural layout the theme builds on. Behavior, routes, labels, prices, persistence and the character lock are untouched.

## Files

- `src/retro/tokens.css`: design tokens and the `@font-face`.
- `src/retro/retro.css`: panel, button, focus, status, shop, confirm and nav treatments.
- `src/retro/field-tile.png`: 16 x 16 field tile.
- `src/retro/PixelifySans.ttf`, `src/retro/OFL.txt`: font and its SIL Open Font License.
- `src/App.tsx`: sets `data-theme` on every view. `src/main.tsx`: imports the two stylesheets.
- `src/screens/ShopScreen.tsx`: the fitting-room emoji becomes a pixel SVG glyph (`MirrorIcon`). The button text is unchanged.

## Design tokens

Palette (DB32-inspired indexed set). Ratios are WCAG 2.x contrast, computed from relative luminance.

| Token | Value | Use | Measured contrast |
| --- | --- | --- | --- |
| `--px-night` | `#101b2d` | page field, text on mint | 11.24:1 on mint |
| `--px-panel` | `#222034` | panels, nav | |
| `--px-well` | `#171b2a` | buttons, product cards | |
| `--px-shade` | `#0b101b` | drop shadow, pressed edge | |
| `--px-edge` | `#7b7d86` | borders (non-text) | 3.87:1 on panel, 4.17:1 on well |
| `--px-edge-soft` | `#4b5362` | disabled border | decorative |
| `--px-light` | `#cbdbfc` | secondary text | 11.39:1 on panel |
| `--px-white` | `#fff4e8` | primary text | 14.62:1 on panel |
| `--px-mint` | `#99e550` | active tab, focus border, progress | 10.33:1 on panel |
| `--px-mint-dark` | `#37946e` | active tab shade | |
| `--px-gold` | `#f2c35e` | currency, focus ring | 10.39:1 on well |
| `--px-danger` | `#e87566` | notice border | 5.41:1 on panel |
| `--px-disabled` | `#8a8d99` | disabled labels | 4.80:1 on panel, 5.18:1 on well |

State tokens: `--px-hover` (`#2d2a45`), `--px-pressed` (`#0f1320`), `--px-selected` (mint). Loading uses `cursor: progress` and the 70% opacity of an in-flight Daily Food claim; error uses the danger border on notices.

Grid and shape: `--px-1..6` (4, 8, 12, 16, 24, 32 px), `--px-stroke` 3 px, `--px-corner` 9 px stepped corners (clip-path polygon), `--px-drop` 4 px hard shadow, `--px-target` 44 px (buttons are 48 px).

Type: Pixelify Sans, body 18 px (`--px-text-body`), small 16 px, title 28 px. Below 360 px the body drops to 16 px and the title to 24 px; labels wrap and are never truncated.

Focus: `--px-focus-ring` is a 3 px gold outline with a 3 px offset, plus a mint border on bordered buttons.

## Asset inventory and licensing

| Asset | Source | License |
| --- | --- | --- |
| `PixelifySans.ttf` | Pixelify Sans Project Authors, https://github.com/eifetx/Pixelify-Sans | SIL OFL 1.1, text in `src/retro/OFL.txt`, copyright notice retained |
| `field-tile.png` | Authored for this repo from a script (two flat colours, 2 px dither), no external source | Repo license |
| `MirrorIcon` (inline SVG, 8 x 8 grid, crisp edges) | Authored for this repo | Repo license |
| Character stills, run sheets, accessory overlays | Existing files under `public/` | Unchanged |
| Brick wall and currency glyphs | Existing inline SVG, unchanged | Unchanged |

No image-generation model produced any asset.

## Differences from the concept

- Brand reads "Chase" (the concept still says "Stride"). Labels, prices and item names come from the live catalog.
- The concept's "Switch to Shooshy" focus example is not a live default. The control still exists in code as an optional prop, and this change does not add or remove it.
- Shop cards show the product preview and price only, as the app does, with the item name in the button's accessible name. The concept's visible item names are not added because card content is covered by existing tests.
- The shop keeps its brick wall and sign. The wall colors stay as shipped.
- The concept's CSS dotted field is replaced by the `field-tile.png` tile.
- While the confirm dialog is open the stepped panel corners are dropped, because `clip-path` would crop the fixed overlay.
- Desktop keeps the 440 px centered shell and the bottom bar.

## Verification

Commands on the branch:

- `npm run test`: 476 passed (476).
- `npm run lint`: exit 0.
- `npm run build`: built, PWA precache 19 entries.

Browser checks (real Chrome via CDP, dev server, Chase profile with 20 bones):

- Horizontal overflow, `scrollWidth` against `innerWidth`: Status 320/320 and 375/375; Shop 320/320 and 375/375; Shop with fitting room open 305 to 320 and 360 to 375 (no overflow).
- Hover (`rgb(45, 42, 69)` with a light border) and pressed (`rgb(15, 19, 32)`, `:active` true) were captured with real CDP mouse events on Update answers. The unaffordable shop state (1 bone, both cards disabled) was captured.
- Tab order, Status: Daily Food, Switch to Shooshy, Update answers, My plan, Shop, Status. "View past run" is disabled and skipped.
- Tab order, Shop: Buy Black sunglasses for 2 bones, Buy Sushi hat for 3 bones, Fitting Room, My plan, Shop.
- Focus ring computed: solid, 3 px, `rgb(242, 195, 94)`.
- Interactive targets: no button under 44 x 44 on either screen.
- Buy flow: confirm opens with focus on the dialog, Tab goes to Cancel, Escape cancels with balance unchanged at 20 bones. Confirm took the balance to 18 bones and the card to "Equip Black sunglasses". Equip gave "Unequip Black sunglasses". After a reload the balance (18) and equipped state persisted. Unequip restored "Equip Black sunglasses".

Screenshots are in `docs/retro-ui/screenshots/`.

| State | Before | After |
| --- | --- | --- |
| Status 375 | before-status-375.png | after-status-375.png |
| Status desktop | before-status-desktop.png | after-status-desktop.png |
| Status focus 375 | | after-status-focus-375.png |
| Shop 375 | before-shop-375.png | after-shop-375.png |
| Shop desktop | before-shop-desktop.png | after-shop-desktop.png |
| Fitting room 375 | before-shop-fitting-375.png | after-shop-fitting-375.png |
| Confirm 375 | before-shop-confirm-375.png | after-shop-confirm-375.png |
| Status hover 375 | | after-status-hover-375.png |
| Status pressed 375 | | after-status-pressed-375.png |
| Shop unaffordable 375 | | after-shop-unaffordable-375.png |
| Shop focus 375 | | after-shop-focus-375.png |
| Confirm focus 375 | | after-shop-confirm-focus-375.png |
| Owned 375 | | after-shop-owned-375.png |
| Equipped 375 | | after-shop-equipped-375.png |
| Fitting room, equipped 375 | | after-shop-fitting-equipped-375.png |

## Known gaps

- Safari/iOS and a real touch device were not tested. 375 px captures use Chrome with a 375 px viewport, not device emulation (mobile emulation cropped the page top in capture).
- See the app-wide gaps below.

# Remaining screens

## Screen inventory and coverage matrix

Views come from `useAppFlow` (`View` type) plus the dialogs and states inside them.

| Screen or dialog | View | Themed | Evidence (stage-2 screenshots, `screenshots-stage2/`) |
| --- | --- | --- | --- |
| Loading shell | `ready === false` | yes | not captured (renders for one frame) |
| Onboarding / name | `name` | yes | name-375, name-desktop |
| Questions | `baseline` | yes | questions-375, questions-desktop, questions-error-375, questions-focus-375 |
| Status (home) | `home`, `status` | stage 1 | home-375, home-claimed-375, quest-ready-375, quest-claimed-375 |
| Quest badge (Daily Food) | inside Status | stage 1 | quest-ready-375, quest-claimed-375 |
| My plan | `plan` | yes | plan-375, plan-desktop, plan-focus-375 |
| Workout editor | `workout` | yes | workout-375, workout-desktop, workout-invalid-375 |
| Run (ready, active, paused) | `run` | yes | run-ready-375/desktop, run-active-375/desktop, run-paused-375 |
| Completion | `complete` | yes | complete-375, complete-desktop, complete-320 |
| Past run | `past-complete` | yes | past-complete-375 |
| Shop, fitting room, confirm | `shop` | stage 1 | shop-equipped-375, plus stage-1 captures |
| Save-error notice | any | yes | not captured; style shared with stage 1 notice |
| Share (busy / status) | inside Completion | yes | idle only |

Every `before-*` image is the same build with `data-theme` removed, which reproduces the previous look.

## Token mapping

No new tokens, fonts or image assets. New rules reuse `tokens.css`.

| Legacy surface | Retro treatment |
| --- | --- |
| `.primary` | mint plate, `--px-night` text, `--px-white` border, `--px-mint-dark` bottom shade, 48 px |
| `.link` | `--px-light` text, hover `--px-hover`, 44 px target |
| `.field input/select` | `--px-well` fill, 3 px `--px-edge` border, inset shade, 48 px; invalid uses `--px-danger` |
| `.choice`, `.character` | well button with shade; selected uses mint border and double inset |
| `.week`, `.plan-step`, `.tile` | well panel, 3 px edge; current week uses mint border |
| `.week-badge` | outlined chip, mint (This week) or gold (Taper) |
| `.stat-value`, `.hero`, `.tile dd` | `--px-gold` numerals |
| `.stat-line`, `.bar` | 20 px stepped bar, square ends; segment bar is gold |
| `.milestones li` | done = `--px-mint-dark` with `--px-night` text; current = mint; upcoming = well |
| `.speed-adjust .step` | 56 px square buttons |
| Legacy vars (`--text`, `--muted`, `--accent`, `--bar`, `--rule`) | re-pointed to retro tokens inside the theme, so SVG charts and tables follow |

Session rows in My plan keep a left edge coloured by training zone (E, M, T, I, R). The zone letter is also in the text and pace line, so colour is not the only cue. Chart and zone-bar fills keep the existing `ZONE_COLORS`, which carry a letter label.

Decorative versus actionable: the character sprites, still frames, cosmetic overlays, chart SVG and zone bar are decorative or described by adjacent text. Buttons, inputs, selects, summary, week toggles and the speed stepper are the actionable controls and all carry the focus ring.

Added contrast measurements (WCAG 2.x): `--px-night` on `--px-mint` 11.24:1; `--px-night` on `--px-mint-dark` 4.62:1; `--px-gold` on `--px-well` 10.39:1; `--px-light` on `--px-well` 12.29:1; `--px-white` on `--px-well` 15.78:1; `--px-danger` on `--px-well` 5.84:1; `--px-disabled` on `--px-well` 5.18:1.

## Verification

Commands on the branch: `npm run test` 476 passed (476), `npm run lint` exit 0, `npm run build` built with 19 precache entries.

Browser checks (real Chrome via CDP, Vite dev server, Shooshy profile, fresh localStorage):

- First use: onboarding, Shooshy selected, Continue to Status. Stored profile `{"name":"Colin","character":"shooshy"}`.
- Questions: filled with a 35:00 5K, 15 km/week, 3 days; invalid time `abc` showed the error state; Save enabled only when valid.
- Plan edit: first section distance changed to 1.5 km, total distance 5.50 to 5.90 km; blank pace disabled Start; restoring it re-enabled Start.
- Run: Start, speed 7.1 to 7.2 km/h, Pause, Resume label shown. Persisted run session stored.
- Completion: reached by moving the stored session start time back (a test shortcut; the run timer itself was not waited out). Distance 5.90 km, 47:43 active time, +1 bone/fish reward, then Back to workouts returned to Status.
- Quest one-claim: stored progression backdated so 3 units were pending; the first click took the balance 21 to 24 with "Collected 3 fish", the second click left it at 24 and the button reported "Daily Food done today".
- Shop: buy sunglasses (confirm showed 24 to 22), Equip, reload; balance 22 and "Unequip Black sunglasses" persisted.
- Character lock: the runner buttons only render on the name screen while no character is stored. After onboarding no control opens that screen (Update answers opens the questions), so the lock was not exercised in the browser. `NameScreen.test.tsx` covers the locked variant (`storedCharacter`) and passes. Status keeps its existing Switch control, unchanged.
- Overflow, `scrollWidth` against `innerWidth`: name, questions, plan, workout, run and complete are 320/320, 375/375 and 1280/1280, apart from the scrollbar width the browser reports (305/320, 360/375, 1265/1280 mean a 15 px scrollbar, no horizontal scroll). Completion at 320 initially overflowed by 11 px from the five-column recap table; a 320 px rule fixed it.
- Touch targets: no button, input, select or summary under 44 px on questions, plan, workout, run and complete.
- Focus ring: solid 3 px `rgb(242, 195, 94)` on a question choice and a week toggle.

## App-wide gaps

- Safari/iOS and real touch devices were not tested.
- Hover and pressed states were verified on Status in stage 1 and use the shared rules; they were not captured per screen in this stage.
- The Share button's busy label and status text and the save-error notice were not captured.
- The Pause run screen was captured; the audio cues were not listened to, and run timing and audio code are unchanged.
- Run completion was reached through a stored-time shortcut, not a 48 minute run.
- The loading shell is not captured.
- The locked name-screen variant is not reachable from the UI, so its themed look is not captured; it uses the same field and primary-button rules as the onboarding capture.
- Status, quest and shop screenshots in this folder are from the stage-1 theme; their `before-*` images remove `data-theme` and show the pre-redesign look.
- Contrast was measured from token values, not from a pixel sample of each screenshot.
