# Retro-pixel foundation (Status and Shop)

The retro-pixel theme is a scoped layer over the existing app. `App.tsx` sets `data-theme="retro"` on `<main class="shell">` while the Status (home) or Shop view is showing. Every rule lives in `src/retro/retro.css` under `[data-theme='retro']`, so other screens keep their current look until they are migrated. Behavior, routes, labels, prices, persistence and the character lock are unchanged.

## Files

- `src/retro/tokens.css`: design tokens and the `@font-face`.
- `src/retro/retro.css`: panel, button, focus, status, shop, confirm and nav treatments.
- `src/retro/field-tile.png`: 16 x 16 field tile.
- `src/retro/PixelifySans.ttf`, `src/retro/OFL.txt`: font and its SIL Open Font License.
- `src/App.tsx`: sets `data-theme`. `src/main.tsx`: imports the two stylesheets.
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
- Other screens (plan, workout, run, complete, name) still use the previous theme.
